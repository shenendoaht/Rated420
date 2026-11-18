/* UI test double, not database security. Included only by this feature preview build. */
(function installCommunityDemo() {
  'use strict';
  const key='rated420-community-demo-v1';
  const actorKey=key+'-actor';
  const users=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  const callbacks=[];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const read=()=>{try{return JSON.parse(localStorage.getItem(key))||clone(COMMUNITY_DEMO_SEED);}catch{return clone(COMMUNITY_DEMO_SEED);}};
  const save=data=>localStorage.setItem(key,JSON.stringify(data));
  let actor=localStorage.getItem(actorKey)||'';
  const user=()=>actor?{id:actor,email:actor===users[0]?'demo-a@example.test':'demo-b@example.test',created_at:'2026-01-01T00:00:00Z',user_metadata:{}}:null;
  const error=message=>({data:null,error:{message}});
  const categories={strain_reviews:['aesthetic','aroma','flavor','effects','overall'],dispensary_reviews:['aesthetic','accessibility','staff','menu','overall']};
  function aggregate(rows,idField,fields,format=null) {
    const contributions=new Map();
    for(const row of rows){
      if(format!==null&&row.product_type!==format)continue;
      const key=String(row[idField])+'/'+row.user_id;
      if(!contributions.has(key))contributions.set(key,[]);
      contributions.get(key).push(row);
    }
    const listings=new Map();
    for(const values of contributions.values()){
      const id=values[0][idField];if(!listings.has(id))listings.set(id,[]);
      listings.get(id).push(Object.fromEntries(['total',...fields].map(f=>[f,values.reduce((sum,row)=>sum+Number(row[f]),0)/values.length])));
    }
    return [...listings].map(([id,values])=>({[idField]:id,...(idField==='strain_id'?{product_type:format}:{}),review_count:values.length,
      ...Object.fromEntries(['total',...fields].map(f=>['avg_'+f,values.reduce((sum,row)=>sum+row[f],0)/values.length]))}));
  }
  const demoProfile = (state, id) => ({
    id, username: id === users[0] ? 'demo_a' : 'demo_b', display_name: 'Demo reviewer',
    created_at: '2026-01-01T00:00:00Z', avatar_choice: id === users[0] ? 2 : 3,
    show_review_identity: true, ...state.demoProfiles?.[id]
  });
  const normalized=row=>({...row,brand_key:row.brand?.trim().toLowerCase(),name_key:row.name?.trim().toLowerCase(),location_key:row.location?.trim().toLowerCase()});
  class Query {
    constructor(table){this.table=table;this.filters=[];this.operation='read';this.max=Infinity;this.orders=[];}
    select(columns,options={}){this.columns=columns;this.options=options;return this;}
    range(from,to){this.start=from;this.max=to+1;return this;}
    eq(field,value){this.filters.push(row=>String(normalized(row)[field])===String(value));return this;}
    order(field,{ascending=true}={}){this.orders.push([field,ascending]);return this;}
    limit(n){this.max=n;return this;}
    maybeSingle(){this.one='maybe';return this;}
    single(){this.one='required';return this;}
    insert(value){this.operation='insert';this.value=value;return this;}
    update(value){this.operation='update';this.value=value;return this;}
    delete(){this.operation='delete';return this;}
    then(resolve,reject){return Promise.resolve().then(()=>this.run()).then(resolve,reject);}
    run(){
      const state=read();let rows=state[this.table]||[];
      if(this.table==='strain_community_stats')rows=[...aggregate(state.strain_reviews,'strain_id',categories.strain_reviews),
        ...[...new Set(state.strain_reviews.map(r=>r.product_type))].flatMap(format=>aggregate(state.strain_reviews,'strain_id',categories.strain_reviews,format))];
      if(this.table==='dispensary_community_stats')rows=aggregate(state.dispensary_reviews,'dispensary_id',categories.dispensary_reviews);
      if(this.table==='member_profiles')rows=actor?[demoProfile(state,actor)]:[];
      if(this.table==='strain_community_reviews')rows=state.strain_reviews.map(review=>{
        const {username,avatar_choice,show_review_identity}=demoProfile(state,review.user_id);
        const {id,strain_id,product_type,total,created_at}=review;
        return {id,strain_id,product_type,total,created_at,
          username: show_review_identity ? username : null,
          avatar_choice: show_review_identity && username ? avatar_choice : null};
      });
      const matches=row=>this.filters.every(filter=>filter(row));
      if(this.operation!=='read'){
        if(!actor)return error('Choose a demo reviewer in the preview toolbar first.');
        if(this.table==='member_profiles'&&this.operation==='update'&&rows.some(matches)){
          state.demoProfiles||={};
          state.demoProfiles[actor]={...rows[0],...this.value};
          save(state);
          return {data:clone(state.demoProfiles[actor]),error:null};
        }
        if(!['strains','dispensaries','strain_reviews','dispensary_reviews'].includes(this.table))return error('This action is disabled in the community preview.');
        if(this.operation==='insert'){
          let row={...this.value};
          if(categories[this.table]){
            if(row.user_id&&row.user_id!==actor)return error('Cannot write another demo account’s review.');
            row.user_id=actor;row.total=categories[this.table].reduce((sum,f)=>sum+Number(row[f]),0);
          }
          const duplicate=other=>this.table==='strain_reviews'?other.user_id===row.user_id&&Number(other.strain_id)===Number(row.strain_id)&&other.brand.trim().toLowerCase()===row.brand.trim().toLowerCase()&&other.product_type===row.product_type:
            this.table==='dispensary_reviews'?other.user_id===row.user_id&&Number(other.dispensary_id)===Number(row.dispensary_id):other.name.trim().toLowerCase()===row.name.trim().toLowerCase()&&(this.table!=='dispensaries'||other.location.trim().toLowerCase()===row.location.trim().toLowerCase());
          if(rows.some(duplicate))return {data:null,error:{code:'23505',message:'Duplicate demo review or listing.'}};
          row.id=categories[this.table]?crypto.randomUUID():Math.max(0,...rows.map(r=>Number(r.id)))+1;
          row.created_at=new Date().toISOString();row.updated_at=row.created_at;state[this.table]=[...rows,row];rows=[row];
        }else{
          const selected=rows.filter(row=>matches(row)&&row.user_id===actor);
          if(this.operation==='delete')state[this.table]=rows.filter(row=>!selected.includes(row));
          else{
            for(const row of selected){Object.assign(row,this.value);if(categories[this.table])row.total=categories[this.table].reduce((sum,f)=>sum+Number(row[f]),0);row.updated_at=new Date().toISOString();}
            const identities=rows.map(row=>this.table==='strain_reviews'?[row.user_id,row.strain_id,row.brand.trim().toLowerCase(),row.product_type].join('/'):[row.user_id,row.dispensary_id].join('/'));
            if(new Set(identities).size!==identities.length)return {data:null,error:{code:'23505',message:'Duplicate demo review.'}};
            state[this.table]=rows;
          }
          rows=selected;
        }
        save(state);
      }else rows=rows.filter(matches);
      for(const [field,asc] of [...this.orders].reverse())rows=[...rows].sort((a,b)=>String(a[field]).localeCompare(String(b[field]))*(asc?1:-1));
      const count=this.options?.count==='exact'?rows.length:null;
      rows=rows.slice(this.start||0,this.max);
      if(this.columns&&this.columns!=='*')rows=rows.map(row=>Object.fromEntries(this.columns.split(',').map(f=>f.trim()).map(f=>[f,row[f]])));
      if(this.one){if(rows.length>1||(!rows.length&&this.one==='required'))return error('Expected one demo record.');return {data:rows[0]||null,error:null};}
      return {data:this.options?.head?null:clone(rows),count,error:null};
    }
  }
  const emit=event=>callbacks.forEach(cb=>cb(event));
  window.supabase={createClient:()=>({from:table=>new Query(table),auth:{
    getUser:async()=>({data:{user:user()},error:null}),
    onAuthStateChange:cb=>{callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}};},
    signOut:async()=>{actor='';localStorage.removeItem(actorKey);emit('SIGNED_OUT');return {error:null};},
    signInWithPassword:async()=>({error:{message:'Use the demo reviewer selector above. Do not enter real credentials.'}}),
    signUp:async()=>error('Real signups are disabled. Use the demo reviewer selector.'),
    resetPasswordForEmail:async()=>error('Email is disabled in this preview.'),updateUser:async()=>error('Credential changes are disabled in this preview.')
  },storage:{from:()=>({
    upload:async(path,file)=>{const data=read();data.photos||={};data.photos[path]=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});save(data);return {data:{path},error:null};},
    getPublicUrl:path=>({data:{publicUrl:read().photos?.[path]||'images/rated420-logo.png'}}),
    remove:async paths=>{const data=read();for(const path of paths)if(data.photos)delete data.photos[path];save(data);return {error:null};},
    createSignedUrl:async path=>({data:{signedUrl:read().photos?.[path]||'images/rated420-logo.png'}})
  })}})};
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);return url.hostname==='rated420-demo.invalid'||url.hostname.endsWith('.supabase.co')?Promise.resolve(Response.json({ready:false,success:false},{status:503})):nativeFetch(input,init);};
  const banner=document.createElement('aside');banner.setAttribute('aria-label','Synthetic data preview');banner.style.cssText='padding:14px;background:#253925;color:#eff7e8;position:relative;z-index:10;font:14px sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
  const label=document.createElement('label');label.textContent='SYNTHETIC DATA PREVIEW · No production access. Demo reviewer: ';
  const select=document.createElement('select');select.id='demoReviewer';select.style.cssText='padding:8px;background:#111711;color:#eff7e8;max-width:100%';
  for(const [value,text] of [['','Logged-out visitor'],[users[0],'Reviewer A'],[users[1],'Reviewer B']]){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  select.value=actor;select.addEventListener('change',()=>{actor=select.value;localStorage.setItem(actorKey,actor);emit(actor?'SIGNED_IN':'SIGNED_OUT');});label.append(select);banner.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset demo data';reset.style.cssText='padding:8px;background:#c7ea86;color:#111711';reset.addEventListener('click',()=>{localStorage.removeItem(key);location.reload();});banner.append(reset);
  const note=document.createElement('span');note.textContent='Scores and edits persist only in this browser. No real emails or accounts.';banner.append(note);
  document.getElementById('siteShell').prepend(banner);
})();
