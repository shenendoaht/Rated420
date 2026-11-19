/* Browser-only fixtures. The production authorization boundary is the SQL RPC. */
function runBuild02Fixture(operation,payload,state,actor,users,profile,aggregate) {
  const now=new Date().toISOString();
  if(!state.build01)runBuild01Fixture('polls',{},state,actor,users,profile);
  const b=state.build01;
  const h=state.build02??={
    roles:{[users[0]]:'staff',[users[2]]:'administrator',[users[3]]:'staff'},
    submissions:[],archive:[],library:[
      {kind:'episode',id:'episode-one',title:'Rated 420:NY Episode 1 - AETERNA',description:'Verified public destination. Release date to be confirmed.',image:'artwork',url:'https://www.youtube.com/watch?v=_sIMx7bO0MQ',position:1,published:true},
      {kind:'episode',id:'episode-two',title:'Rated 420:NY Episode 2 - TREEHOUSE',description:'Verified public destination. Release date to be confirmed.',image:'artwork',url:'https://www.youtube.com/watch?v=5A0oNueR_SM',position:2,published:true},
      ...[['tee','Rated420 T-shirt'],['hoodie','Rated420 hoodie'],['hat','Rated420 cap'],['sticker','Rated420 sticker']].map(([image,title],i)=>({kind:'merch',id:image,title,image,description:'Rated420 artwork concept · Coming soon.',position:i,published:true}))
    ]
  };
  const role=h.roles[actor]||'member';
  const staff=role!=='member';
  const {kind,id}=payload;
  const hidden=r=>h.archive.includes(r.kind+':'+r.id);
  const score=(r,stats)=>({...r,average:stats?.avg_total??null,count:stats?.review_count??0});
  const strain=aggregate(state.strain_reviews,'strain_id',['aesthetic','aroma','flavor','effects','overall']);
  const disp=aggregate(state.dispensary_reviews,'dispensary_id',['aesthetic','accessibility','staff','menu','overall']);
  const rows=[
    ...state.strains.map(r=>score({...r,kind:'strain',formats:[...new Set(state.strain_reviews.filter(v=>Number(v.strain_id)===Number(r.id)).map(v=>v.product_type))]},strain.find(v=>Number(v.strain_id)===Number(r.id)))),
    ...state.dispensaries.map(r=>score({...r,kind:'dispensary'},disp.find(v=>Number(v.dispensary_id)===Number(r.id)))),
    ...['brand','accessory'].flatMap(kind=>runBuild01Fixture('catalog',{kind},state,actor,users,profile))
  ];
  const same=(row,kind,name,location)=>row.kind===kind&&key(row.name)===key(name)&&key(row.location)===key(location);
  function key(v){return String(v??'').trim().toLowerCase().replace(/\s+/g,' ');}
  function validate(k,n,l,d){
    if(!['strain','dispensary','brand','accessory'].includes(k)||n.length<2||n.length>(k==='strain'?100:120)||d.length>1500||
      (k==='dispensary'?(l.length<2||l.length>120):Boolean(l)))throw Error('Enter a valid listing name, location and supporting details.');
  }
  function source(k){return k==='strain'?state.strains:k==='dispensary'?state.dispensaries:b.items;}
  function recap(row){
    const p=runBuild01Fixture('polls',{},state,actor,users,profile).polls.find(p=>p.closed&&p.id===row.poll);
    return {...row,recap:p?{question:p.question,options:p.options}:null};
  }
  const acts=[
    ...state.strain_reviews.filter(v=>!hidden({kind:'strain',id:v.strain_id})).map(v=>[v.user_id,'reviews',v.created_at,'strain:'+v.strain_id+':'+v.product_type]),
    ...state.dispensary_reviews.filter(v=>!hidden({kind:'dispensary',id:v.dispensary_id})).map(v=>[v.user_id,'reviews',v.created_at,'dispensary:'+v.dispensary_id]),
    ...b.reviews.filter(v=>!rows.some(r=>r.id===v.id&&hidden(r))).map(v=>[v.actor,'reviews',v.activity_at,'item:'+v.id]),
    ...h.submissions.filter(v=>v.created_new&&!hidden({kind:v.kind,id:v.listing})).map(v=>[v.actor,'contributions',v.decided_at]),
    ...b.polls.flatMap(p=>Object.keys(p.votes).map(v=>[v,'polls',p.voteDates?.[v]]))
  ];
  const rankings=users.map(u=>{
    const count=k=>acts.filter(a=>a[0]===u&&a[1]===k).length;
    const reviews=new Set(acts.filter(a=>a[0]===u&&a[1]==='reviews').map(a=>a[3])).size,contributions=count('contributions'),polls=count('polls');
    return {username:profile(state,u).username,reviews,contributions,polls,score:reviews+3*contributions+polls};
  });
  if(operation==='role')return role;
  if(operation==='catalog')return rows.filter(r=>!hidden(r)&&(!kind||r.kind===kind));
  if(operation==='library')return h.library.filter(r=>r.kind===kind&&(r.published||(staff&&payload.manage))).sort((a,b)=>a.position-b.position).map(recap);
  if(operation==='profile'){
    const u=users.find(u=>profile(state,u).username?.toLowerCase()===String(payload.username).toLowerCase());
    if(!u)return null;
    const p=profile(state,u);
    if(!p.show_review_identity)return null;
    const r=rankings.find(r=>r.username===p.username);
    return {username:p.username,avatar_choice:p.avatar_choice,badges:[r.reviews>=5?'Top Reviewer':null,r.contributions>=3?'Catalog Pioneer':null,r.polls>=3?'Community Voice':null,r.score>=12?'Rated420 Elite':null].filter(Boolean)};
  }
  if(!actor)throw Error('Sign in to continue');
  if(operation==='mine')return h.submissions.filter(s=>s.actor===actor);
  if(operation==='submit'){
    const name=String(payload.name??'').trim(), location=String(payload.location??'').trim(), description=String(payload.description??'').trim();
    validate(kind,name,location,description);
    if(payload.photo&&!payload.photo.startsWith(actor+'/'))throw Error('Upload your supporting image first');
    if(rows.some(r=>same(r,kind,name,location)))throw Error('A matching catalog entry already exists');
    if(h.submissions.some(r=>r.id!==id&&['Pending','Needs Revision'].includes(r.status)&&same(r,kind,name,location)))throw Error('A matching suggestion is already pending');
    const entry={kind,name,location,description,status:'Pending'};
    if(!id){
      const created={...entry,id:crypto.randomUUID(),actor,photo:payload.photo,created_at:now};
      h.submissions.push(created);
      return created.id;
    }
    const previous=h.submissions.find(r=>r.id===id&&r.actor===actor&&r.status==='Needs Revision'&&r.kind===kind);
    if(!previous)throw Error('Only your submissions needing revision can be resubmitted');
    Object.assign(previous,entry,{photo:payload.photo??previous.photo});
    return id;
  }
  if(!staff)throw Error('Rated420 HQ access required');
  if(operation==='queue')return h.submissions;
  if(operation==='manage_catalog')return rows.map(r=>({...r,archived:hidden(r)}));
  if(operation==='moderate'){
    const s=h.submissions.find(s=>s.id===id);
    if(!s)throw Error('Submission missing');
    if(['Approved','Rejected'].includes(s.status))return s.listing;
    const {status,note=''}=payload;
    if(!['Approved','Rejected','Needs Revision'].includes(status))throw Error('Choose a moderation decision');
    const {name=s.name,location=s.location,description=s.description}=payload;
    validate(s.kind,name,location,description);
    let listing=null,created_new=false;
    if(status==='Approved'){
      const existing=payload.listing?rows.find(r=>r.kind===s.kind&&String(r.id)===payload.listing):rows.find(r=>same(r,s.kind,name,location));
      if(payload.listing&&!existing)throw Error('Matching listing not found');
      if(existing)listing=existing.id;
      else {
        const list=source(s.kind);
        listing=['strain','dispensary'].includes(s.kind)?Math.max(0,...list.map(r=>Number(r.id)))+1:s.kind+'-'+s.id;
        list.push({id:listing,kind:s.kind,name,location,description,created_at:now});
        created_new=true;
      }
    }
    Object.assign(s,{name,location,description,status,note,listing,created_new,decided_at:now});
    return listing;
  }
  if(operation==='catalog_edit'){
    const row=source(kind).find(r=>String(r.id)===String(id));
    if(!row)throw Error('Listing not found');
    const {name,location='',description=''}=payload;
    validate(kind,name,location,description);
    if(rows.some(r=>String(r.id)!==String(id)&&same(r,kind,name,location)))throw Error('A matching listing exists');
    Object.assign(row,{name,location,description});
    h.archive=h.archive.filter(v=>v!==kind+':'+id);
    if(String(payload.archived)==='true')h.archive.push(kind+':'+id);
    return null;
  }
  if(operation==='library_save'){
    const {title,description='',image='',url='',release_date='',poll='',published,position=0}=payload;
    if(!['episode','merch'].includes(kind)||title.trim().length<2||title.length>120||description.length>1500||
       (url&&!/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(url))||
       (kind==='merch'&&(url||release_date||poll))||
       (poll&&!b.polls.some(p=>p.id===poll&&p.closed)))throw Error('Enter a valid library entry');
    const old=h.library.find(r=>r.id===id&&r.kind===kind);
    if(id&&!old)throw Error('Library entry not found');
    const record={kind,title,description,image,url,release_date,poll,position:Number(position),published:String(published)==='true'};
    if(old)Object.assign(old,record);
    else h.library.push({...record,id:crypto.randomUUID()});
    return old?.id??h.library.at(-1).id;
  }
  if(operation==='staff_role'&&role==='administrator'){
    if(id===actor||!users.includes(id)||!['member','staff'].includes(payload.status))throw Error('Choose another demo account and a valid role');
    h.roles[id]=payload.status;
    return null;
  }
  if(operation==='analytics'){
    const days=[7,30,90].includes(Number(payload.days))?Number(payload.days):30;
    const counts=values=>values.reduce((result,key)=>{result[key]=(result[key]??0)+1;return result;},{});
    const recent=a=>Date.parse(a[2])>=Date.now()-days*86400000;
    const by=k=>acts.filter(a=>a[1]===k);
    const trend=Object.entries(counts(by('polls').filter(recent).map(a=>a[2].slice(0,10)))).sort().map(([day,votes])=>({day,votes}));
    return {days,accounts:users.length,catalog:counts(rows.filter(r=>!hidden(r)).map(r=>r.kind)),
      reviews:by('reviews').length,periodReviews:by('reviews').filter(recent).length,
      formats:counts(state.strain_reviews.filter(r=>!hidden({kind:'strain',id:r.strain_id})).map(r=>r.product_type)),
      submissions:counts(h.submissions.map(r=>r.status)),activePolls:b.polls.filter(p=>!p.closed).length,
      closedPolls:b.polls.filter(p=>p.closed).length,votes:by('polls').length,participants:new Set(by('polls').map(a=>a[0])).size,
      unknownVoteDates:by('polls').filter(a=>!a[2]).length,unknownReviewDates:by('reviews').filter(a=>!a[2]).length,trend,rankings};
  }
  throw Error('Action unavailable');
}
