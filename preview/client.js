/* UI test double, not database security. Included only by this feature preview build. */
(function installCommunityDemo() {
  'use strict';
  const key='rated420-community-demo-v1';
  const actorKey=key+'-actor';
  const users=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','aaaa0000-0000-4000-8000-000000000002','aaaa0000-0000-4000-8000-000000000003','aaaa0000-0000-4000-8000-000000000004'];
  const complete=typeof COMPLETE_ACCOUNTS!=='undefined';
  if(complete)users.splice(0,users.length,...COMPLETE_ACCOUNTS.map(account=>account.id));
  const callbacks=[];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const read=()=>{
    let state;
    try{state=JSON.parse(localStorage.getItem(key));}catch{}
    if(!state)return clone(COMMUNITY_DEMO_SEED);
    if(complete&&window.Rated420CatalogueFixtures){
      const additions=window.Rated420CatalogueFixtures.licensed;
      for(const row of COMMUNITY_DEMO_SEED.dispensaries){
        if(additions.some(item=>item.reviewId===row.id)&&!state.dispensaries.some(item=>item.id===row.id))state.dispensaries.push({...row});
      }
    }
    return state;
  };
  const save=data=>localStorage.setItem(key,JSON.stringify(data));
  const photoBlobs = new Map();
  const photoUrls = new Map();
  const photoDb = new Promise((resolve, reject) => {
    const opening = indexedDB.open(key + '-photos', 1);
    opening.onupgradeneeded = () => opening.result.createObjectStore('photos');
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error);
    opening.onblocked = () => reject(new Error('Another tab is blocking demo photo storage.'));
  });
  async function photoTransaction(mode, operation) {
    const database = await photoDb;
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('photos', mode);
      operation(transaction.objectStore('photos'));
      transaction.oncomplete = resolve;
      transaction.onabort = () => reject(transaction.error);
    });
  }
  const loadedPhotos = photoTransaction('readonly', store => {
    const cursor = store.openCursor();
    cursor.onsuccess = () => {
      if (!cursor.result) return;
      photoBlobs.set(cursor.result.key, cursor.result.value);
      cursor.result.continue();
    };
  }).catch(() => {});
  function forgetPhoto(photoKey) {
    if (photoUrls.has(photoKey)) URL.revokeObjectURL(photoUrls.get(photoKey));
    photoUrls.delete(photoKey);
    photoBlobs.delete(photoKey);
  }
  function photoUrl(bucket, path) {
    const photoKey = bucket + '/' + path;
    if (photoBlobs.has(photoKey) && !photoUrls.has(photoKey)) {
      photoUrls.set(photoKey, URL.createObjectURL(photoBlobs.get(photoKey)));
    }
    return photoUrls.get(photoKey) || read().photos?.[path];
  }
  const photoFailure = failure => ({
    data:null, error:{message:failure?.name === 'QuotaExceededError'
      ? 'Demo image storage is full. Try a smaller image or reset the demo.'
      : 'Demo image storage is unavailable. Check your browser settings and try again.'}
  });
  const ownsPhoto = path => Boolean(actor && path.split('/')[0] === actor);
  let actor=localStorage.getItem(actorKey)||'';
  const accounts=()=>complete?[...COMPLETE_ACCOUNTS,...(read().localAccounts||[])]:[];
  const account=id=>accounts().find(entry=>entry.id===id);
  const user=()=>actor?{id:actor,email:account(actor)?.email||'demo-'+(users.indexOf(actor)+1)+'@example.test',created_at:'2026-01-01T00:00:00Z',user_metadata:{}}:null;
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
    id, username: ['demo_a','demo_b','demo_admin','demo_staff','demo_member'][users.indexOf(id)] || 'demo_member', display_name: 'Demo reviewer',
    created_at: '2026-01-01T00:00:00Z', avatar_choice: id === users[0] ? 2 : 3,
    show_review_identity: true, ...(account(id)?{username:account(id).username,display_name:account(id).name}:{}), ...state.demoProfiles?.[id]
  });
  function roles(){
    return complete?Object.fromEntries(COMPLETE_ACCOUNTS.filter(entry=>entry.role).map(entry=>[entry.id,entry.role])):undefined;
  }
  const reviewFields=categories.strain_reviews;
  function visibleReviews(state){
    return state.strain_reviews.filter(row=>!state.build02?.archive?.includes('strain:'+row.strain_id));
  }
  if(complete)window.RatedComplete={
    actor:()=>actor,
    founder:()=>Boolean(account(actor)?.founder),
    business:()=>account(actor)?.organization,
    entities:COMPLETE_ENTITIES,
    formats:COMPLETE_REVIEW_FORMATS,
    products(){const state=read();return state.strains.filter(row=>!state.build02?.archive?.includes('strain:'+row.id));},
    publish(row,text,owner){
      if(!actor||actor!==owner)throw Error('Sign in as the journal owner to publish.');
      if(account(actor)?.organization)throw Error('Business personas use catalogue proposals. Community scoring requires a reviewer persona.');
      if(row.status!=='Tried'||!COMPLETE_REVIEW_FORMATS.includes(row.format)||row.scores.length!==5||
        row.scores.some(n=>!Number.isInteger(n)||n<0||n>84)||text.length>1200)throw Error('Complete a valid strain scorecard before publishing.');
      const state=read();
      const product=state.strains.find(item=>row.productId?item.id===row.productId:item.name.toLowerCase()===row.product.toLowerCase());
      if(!product||state.build02?.archive?.includes('strain:'+product.id))throw Error('Choose an active Rated420 strain before publishing.');
      const brand=row.brand.trim()||'Unbranded';
      const reviews=state.strain_reviews;
      const linked=reviews.find(item=>item.user_id===actor&&item.journal_id===row.id);
      const same=reviews.find(item=>item.user_id===actor&&item.strain_id===product.id&&item.product_type===row.format&&item.brand.toLowerCase()===brand.toLowerCase());
      if(same&&same!==linked)throw Error('A scorecard for this product, brand and format already exists. Edit it from your account.');
      const now=new Date().toISOString();
      const review={id:linked?.id||crypto.randomUUID(),user_id:actor,strain_id:product.id,brand,product_type:row.format,
        notes:text,photo_path:linked?.photo_path??null,journal_id:row.id,total:row.scores.reduce((sum,n)=>sum+n,0),
        created_at:linked?.created_at||now,updated_at:now,...Object.fromEntries(reviewFields.map((key,i)=>[key,row.scores[i]]))};
      state.strain_reviews=[...reviews.filter(item=>item!==linked),review];
      save(state);
      window.dispatchEvent(new Event('rated420:journal-published'));
    },
    publicReviews(){
      const state=read();
      return visibleReviews(state).filter(row=>row.journal_id).map(row=>({
        product:state.strains.find(item=>item.id===row.strain_id)?.name,productId:row.strain_id,
        format:row.product_type,total:row.total,text:row.notes
      }));
    }
  };
  const normalized=row=>({...row,brand_key:row.brand?.trim().toLowerCase(),name_key:row.name?.trim().toLowerCase(),location_key:row.location?.trim().toLowerCase()});
  class Query {
    constructor(table){this.table=table;this.filters=[];this.operation='read';this.max=Infinity;this.orders=[];}
    select(columns,options={}){this.columns=columns;this.options=options;return this;}
    range(from,to){this.start=from;this.max=to+1;return this;}
    is(field,value){this.filters.push(row=>normalized(row)[field]==null);return this;}
    eq(field,value){this.filters.push(row=>String(normalized(row)[field])===String(value));return this;}
    order(field,{ascending=true}={}){this.orders.push([field,ascending]);return this;}
    limit(n){this.max=n;return this;}
    maybeSingle(){this.one='maybe';return this;}
    single(){this.one='required';return this;}
    insert(value){this.operation='insert';this.value=value;return this;}
    update(value){this.operation='update';this.value=value;return this;}
    delete(){this.operation='delete';return this;}
    then(resolve,reject){return loadedPhotos.then(()=>this.run()).then(resolve,reject);}
    run(){
      const state=read();let rows=state[this.table]||[];
      if(complete&&this.operation==='read'&&this.table==='strains')rows=rows.filter(item=>!state.build02?.archive?.includes('strain:'+item.id));
      if(complete&&this.operation==='read'&&this.table==='dispensaries')rows=rows.filter(item=>!state.build02?.archive?.includes('dispensary:'+item.id));
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
        if(complete&&account(actor)?.organization&&categories[this.table])return error('Business personas cannot change community scores.');
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
  window.supabase={createClient:()=>({from:table=>new Query(table),
    rpc:async(name,{operation,payload})=>{
      if(!['rated420_build01','rated420_build02'].includes(name))return error('Unknown fixture operation.');
      try {
        const state=read();
        if(name==='rated420_build02'){
          await loadedPhotos;
          if(payload.photo && !photoBlobs.has('catalog-submissions/'+payload.photo))return error('Upload your supporting image first.');
          const data=runBuild02Fixture(operation,payload,state,actor,complete?accounts().map(entry=>entry.id):users,demoProfile,aggregate,roles());
          if(['submit','moderate','catalog_edit','library_save','staff_role'].includes(operation))save(state);
          return {data,error:null};
        }
        if(complete&&account(actor)?.organization&&operation==='review')return error('Business personas cannot change community scores.');
        const data=runBuild01Fixture(operation,payload,state,actor,users,demoProfile);
        if(['favorite','review','vote','publish','close'].includes(operation))save(state);
        return {data,error:null};
      } catch(failure) { return error(failure.message); }
    },auth:{
    getUser:async()=>({data:{user:user()},error:null}),
    onAuthStateChange:cb=>{callbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}};},
    signOut:async()=>{activate('');return {error:null};},
    signInWithPassword:async({email,password})=>{
      if(!complete)return error('Use the demo reviewer selector above. Do not enter real credentials.');
      const entry=accounts().find(item=>item.email===email.toLowerCase());
      if(!entry||password!=='demo-only-420')return error('Use a synthetic email and the shared demo password shown on this page.');
      activate(entry.id);return {data:{user:user(),session:{}},error:null};
    },
    signUp:async({email,password,options})=>{
      if(!complete)return error('Real signups are disabled. Use the demo reviewer selector.');
      const name=options.data.requested_username;
      if(!/^[^@ ]+@example\.test$/i.test(email)||password!=='demo-only-420')return error('Use an @example.test address and the shared demo password.');
      if(accounts().some(entry=>entry.email===email.toLowerCase()||entry.username.toLowerCase()===name.toLowerCase()))return error('That synthetic email or username is already in use.');
      const entry={id:crypto.randomUUID(),label:'Local member · '+name,username:name,name,email:email.toLowerCase()};
      const state=read();state.localAccounts??=[];state.localAccounts.push(entry);save(state);
      addOption(entry.id,entry.label);activate(entry.id);return {data:{user:user(),session:{}},error:null};
    },
    resetPasswordForEmail:async()=>error('Email is disabled in this preview.'),updateUser:async()=>error('Credential changes are disabled in this preview.')
  },storage:{from:bucket=>({
    upload:async(path,file)=>{
      if (!ownsPhoto(path)) return error('This demo image belongs to another account.');
      try {
        await loadedPhotos;
        const photoKey=bucket+'/'+path;
        await photoTransaction('readwrite', store=>store.add(file,photoKey));
        photoBlobs.set(photoKey,file);
        return {data:{path},error:null};
      } catch(failure) { return photoFailure(failure); }
    },
    getPublicUrl:path=>({data:{publicUrl:bucket==='member-avatars' ? '' : photoUrl(bucket,path) || ''}}),
    remove:async paths=>{
      if (!paths.every(ownsPhoto)) return error('This demo image belongs to another account.');
      try {
        await loadedPhotos;
        await photoTransaction('readwrite', store=>{for (const path of paths) store.delete(bucket+'/'+path);});
        const data=read();
        for (const path of paths) {
          forgetPhoto(bucket+'/'+path);
          if (data.photos) delete data.photos[path];
        }
        if (data.photos) save(data);
        return {data:[],error:null};
      } catch(failure) { return photoFailure(failure); }
    },
    createSignedUrl:async path=>{
      if (bucket==='catalog-submissions' && !ownsPhoto(path) && !(
        (read().build02?.roles ?? roles() ?? {[users[0]]:'staff',[users[2]]:'administrator',[users[3]]:'staff'})[actor] &&
        (read().build02?.roles ?? {})[actor]!=='member'))return error('This submission photo is private.');
      if (bucket==='member-avatars' && !ownsPhoto(path)) return error('This demo image belongs to another account.');
      await loadedPhotos;
      const signedUrl=photoUrl(bucket,path);
      return signedUrl ? {data:{signedUrl},error:null} : error('Demo image is unavailable.');
    }
  })}})};
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);return url.hostname==='rated420-demo.invalid'||url.hostname.endsWith('.supabase.co')?Promise.resolve(Response.json({ready:false,success:false},{status:503})):nativeFetch(input,init);};
  const banner=document.createElement('aside');banner.setAttribute('aria-label','Synthetic data preview');banner.style.cssText='padding:14px;background:#253925;color:#eff7e8;position:relative;z-index:10;font:14px sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
  const label=document.createElement('label');label.textContent='SYNTHETIC DATA PREVIEW · Simulated roles and records. Demo reviewer: ';
  const select=document.createElement('select');select.id='demoReviewer';select.style.cssText='padding:8px;background:#111711;color:#eff7e8;max-width:100%';
  function addOption(value,text){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);}
  const choices=complete?accounts().map(entry=>[entry.id,entry.label]):[[users[0],'Reviewer A'],[users[1],'Reviewer B'],[users[4],'Regular member'],[users[3],'Staff member'],[users[2],'Administrator']];
  for(const [value,text] of [['','Logged-out visitor'],...choices])addOption(value,text);
  function activate(id){
    actor=id;select.value=actor;
    if(actor)localStorage.setItem(actorKey,actor);else localStorage.removeItem(actorKey);
    if(complete&&select.value!==id)select.value='';
    emit(actor?'SIGNED_IN':'SIGNED_OUT');
  }
  select.value=actor;select.addEventListener('change',()=>activate(select.value));label.append(select);banner.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Reset demo data';reset.style.cssText='padding:8px;background:#c7ea86;color:#111711';reset.addEventListener('click',async()=>{
    try {
      await photoTransaction('readwrite', store=>store.clear());
      localStorage.removeItem(key);
      if(complete){
        localStorage.removeItem(actorKey);
        for(const name of Object.keys(localStorage))if(/^rated420-(?:expansion-v1:|gary-preview-v1$|hq-profile-examples-v1$|complete-contact-v1$|intelligence-v1$|editorial-v1$|catalogue-v1$)/.test(name))localStorage.removeItem(name);
        history.replaceState(null,'',location.pathname);
      }
      location.reload();
    } catch {
      reset.textContent='Could not reset demo images. Try again.';
    }
  });banner.append(reset);
  const note=document.createElement('span');note.textContent='Scores and edits persist only in this browser. No real emails or accounts.';banner.append(note);
  document.getElementById('siteShell').prepend(banner);
})();
