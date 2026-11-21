(() => {
  'use strict';
  const key='rated420-editorial-v1';
  const checked='2026-11-20';
  const products=[
    ['puffco-peak','Puffco','Peak','Electronic rig','A portable electronic concentrate rig.','https://www.puffco.com/products/the-peak'],
    ['houseplant-glass-grinder','Houseplant','Glass Grinder','Grinder','A glass grinder for preparing flower.','https://www.houseplant.com/products/glass-grinder'],
    ['grav-three-piece','GRAV','GRAV® 3-Piece Grinder','Grinder','A three-piece grinder for preparing flower.','https://grav.com/products/2-5-grav-3-piece-grinder'],
    ['heir-waterpipe','Heir','Waterpipe','Water pipe','A water pipe from Heir’s glassware range.','https://smokeheir.com/products/waterpipe']
  ].map(([id,manufacturer,name,category,description,url])=>({id,manufacturer,name,category,description,url,checked,placement:'Independent editorial',disclosure:'',published:true,image:'',imageApproval:''}));
  const defaults=()=>({
    products,
    team:[
      {id:'shen',name:'Shenny',title:'',responsibilities:'',bio:'',image:'',imageApproval:''},
      {id:'al',name:'Al',title:'',responsibilities:'',bio:'',image:'',imageApproval:''},
      {id:'team-slot-three',name:'Greg',title:'',responsibilities:'',bio:'',image:'',imageApproval:''}
    ],
    group:{image:'images/carousel-4.webp',imageApproval:'Existing Rated420 homepage photograph',caption:'Rated420 on location at Treehouse.'},
    story:'Rated420 is an independent New York cannabis community built around a simple idea: five categories, 84 points each, one score out of 420.'
  });
  const placements=['Independent editorial','Affiliate link','Sponsored placement','Manufacturer partnership'];
  const read=()=>{
    const state=JSON.parse(localStorage.getItem(key)||JSON.stringify(defaults()));
    for(const member of state.team){
      if(member.id==='shen'&&member.name==='Shen')member.name='Shenny';
      if(member.id==='team-slot-three'&&(!member.name||member.name==='Team member 3'))member.name='Greg';
    }
    return state;
  };
  const clean=(value,max)=>String(value??'').trim().slice(0,max);
  function productUrl(value){
    let url;
    try{url=new URL(value);}catch{throw Error('Enter a complete HTTPS product URL.');}
    if(url.protocol!=='https:'||url.username||url.password)throw Error('Enter a complete HTTPS product URL.');
    return url.href;
  }
  function imageFields(row,previous){
    let image=previous?.image??'',imageApproval=previous?.imageApproval??'';
    if(row.removeImage){image='';imageApproval='';}
    if(row.image){
      if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(row.image)||row.image.length>280000)throw Error('Use an approved JPG, PNG, or WebP image under 200 KB.');
      imageApproval=clean(row.imageApproval,240);
      if(!imageApproval)throw Error('Record the approval or rights source for this image.');
      image=row.image;
    }
    return {image,imageApproval};
  }
  function session(guard){
    return {
      async saveProduct(input,id){
        await guard();
        const state=read(), old=state.products.find(row=>row.id===id);
        if(id&&!old)throw Error('This catalog entry is missing.');
        const row={id:id||crypto.randomUUID(),name:clean(input.name,120),manufacturer:clean(input.manufacturer,80),
          category:clean(input.category,60),description:clean(input.description,600),url:productUrl(input.url),
          placement:input.placement,disclosure:clean(input.disclosure,500),published:Boolean(input.published),...imageFields(input,old)};
        row.checked=old?.url===row.url&&old?.name===row.name&&old?.manufacturer===row.manufacturer?old.checked:'';
        if(!row.name||!row.manufacturer||!row.category||!row.description)throw Error('Enter the manufacturer, product name, category and description.');
        if(!placements.includes(row.placement))throw Error('Choose an editorial or disclosed commercial placement.');
        if(row.placement!=='Independent editorial'&&!row.disclosure)throw Error('Enter the commercial disclosure before saving.');
        if(state.products.some(item=>item.id!==row.id&&item.url===row.url))throw Error('A catalog entry already uses that product link.');
        state.products=old?state.products.map(item=>item.id===id?row:item):[...state.products,row];
        localStorage.setItem(key,JSON.stringify(state));
      },
      async saveTeam(id,input){
        await guard();
        const state=read(), old=state.team.find(row=>row.id===id);
        if(!old)throw Error('This team slot is missing.');
        const row={id,name:clean(input.name,100),title:clean(input.title,100),responsibilities:clean(input.responsibilities,500),
          bio:clean(input.bio,2400),...imageFields(input,old)};
        state.team=state.team.map(item=>item.id===id?row:item);
        localStorage.setItem(key,JSON.stringify(state));
      },
      async saveStory(input){
        await guard();
        const state=read();
        state.story=clean(input.story,3000);
        state.group={caption:clean(input.caption,180),...imageFields(input,state.group)};
        localStorage.setItem(key,JSON.stringify(state));
      }
    };
  }
  window.Rated420EditorialStore={read,session,placements,key};
})();
