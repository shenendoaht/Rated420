(() => {
  'use strict';
  const key='rated420-catalogue-v1';
  const base=window.Rated420CatalogueFixtures.records;
  const types={strain:'Strains',product:'Products',brand:'Brands',dispensary:'Dispensaries',cultivator:'Cultivators and processors'};
  const formats=['Flower','Pre-Roll','Infused Pre-Roll','Vape Cartridge','Disposable Vape','Concentrate','Edible','Tincture','Topical','Other'];
  const editorialPhoto={id:'asset-rated420-treehouse',entity:'treehouse',name:'Rated420 at Treehouse',image:'images/carousel-4.webp',
    alt:'Rated420 group outside Treehouse',source:'Existing Rated420 homepage photograph',owner:'Rated420-supplied editorial photograph',
    attribution:'Rated420 original coverage',acquired:'',permission:'Authorized',state:'Published'};
  const read=()=>JSON.parse(localStorage.getItem(key)||JSON.stringify({records:base,media:[editorialPhoto],proposals:[],history:[]}));
  const fold=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
  const str=(value,n=120)=>String(value??'').trim().slice(0,n);
  const url=value=>{
    if(!str(value))return '';
    try{const p=new URL(value);if(p.protocol==='https:'&&!p.username&&!p.password)return p.href;}catch{}
    throw Error('Use a complete HTTPS link.');
  };
  function record(state,id){return state.records.find(row=>row.id===id);}
  function validEntity(state,id,type){
    if(id&&record(state,id)?.type!==type)throw Error('Choose an existing '+type+' record.');
    return id||'';
  }
  function live(row){return row?.state==='Published'?row:row?.live;}
  function staging(row){if(!row?.live&&row?.state==='Published')return {...row};return row?.live;}
  function linkedIds(row){return [row.brand,row.strain,row.producer,...(row.dispensaries||[])].filter(Boolean);}
  function patch(state,input,old={}){
    const type=old.type||input.type;
    if(!Object.hasOwn(types,type))throw Error('Choose a catalogue type.');
    const name=str(input.name),description=str(input.description,1200),source=str(input.source,240);
    if(!name||!description||!source)throw Error('Name, description and attribution are required.');
    if(state.records.some(row=>row.id!==old.id&&row.state!=='Archived'&&row.type===type&&fold(row.name)===fold(name)))throw Error('Possible duplicate. Review the existing record or archive it before saving this name.');
    const shared={...old,id:old.id||crypto.randomUUID(),type,name,description,source,url:url(input.url),origin:old.origin||'Browser-local editorial record'};
    if(type==='dispensary'){
      const licenseId=input.licenseId??old.licenseId??'';
      if(licenseId&&!/dispensary/i.test(window.Rated420Intelligence.record(licenseId)?.category||''))throw Error('Select an official OCM dispensary location.');
      if(licenseId&&state.records.some(row=>row.id!==old.id&&row.licenseId===licenseId&&row.state!=='Archived'))throw Error('That official license and location already has a profile.');
      return {...shared,licenseId};
    }
    if(type!=='product')return shared;
    const format=str(input.format);
    if(!formats.includes(format))throw Error('Select a product format.');
    return {...shared,format,category:str(input.category,80),cannabinoids:str(input.cannabinoids,400),
      terpenes:str(input.terpenes,400),cultivation:str(input.cultivation,400),manufacturer:str(input.manufacturer,160),
      brand:validEntity(state,input.brand,'brand'),strain:validEntity(state,input.strain,'strain'),producer:validEntity(state,input.producer,'cultivator'),
      dispensaries:[...new Set(Array.from(input.dispensaries||[]).filter(Boolean).map(id=>validEntity(state,id,'dispensary')))]};
  }
  function asset(state,input,entity){
    if(!record(state,entity))throw Error('Choose an existing associated entity.');
    const fields={name:str(input.name),source:str(input.source,250),owner:str(input.owner,200),attribution:str(input.attribution,250),alt:str(input.alt,250)};
    if(!fields.name||!fields.source||!fields.owner||!fields.alt)throw Error('Enter asset name, source, ownership and alt text.');
    if(input.acquired&&!/^\d{4}-\d{2}-\d{2}$/.test(input.acquired))throw Error('Choose an acquisition date.');
    if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image||'')||input.image.length>360000)throw Error('Provide a valid optimized image.');
    if(!['Pending','Authorized'].includes(input.permission))throw Error('Record the asset permission status.');
    return {...fields,id:crypto.randomUUID(),entity,acquired:input.acquired||new Date().toISOString().slice(0,10),image:input.image,permission:input.permission,state:'Draft'};
  }
  function write(state,action,target,actor){
    state.history.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action,target,actor});
    state.history=state.history.slice(0,120);
    localStorage.setItem(key,JSON.stringify(state));
  }
  function manager(guard,actor){
    function assertRecord(state,id){const row=record(state,id);if(!row)throw Error('Record is missing.');return row;}
    return {
      async save(input,id){
        await guard();const state=read(),old=id?assertRecord(state,id):undefined;
        const row=patch(state,input,old);
        row.live=staging(old);row.state='Draft';row.approved=false;row.revision=crypto.randomUUID();
        state.records=old?state.records.map(existing=>existing.id===id?row:existing):[...state.records,row];
        write(state,'Saved draft',row.id,actor);return row.id;
      },
      async transition(id,action){
        await guard();const state=read(),row=assertRecord(state,id);
        if(action==='Approve'){
          if(row.state!=='Draft')throw Error('Save a draft before approval.');
          row.approved=true;
        }else if(action==='Publish'){
          if(row.state!=='Draft'||!row.approved)throw Error('Editorial approval is required.');
          if(linkedIds(row).some(id=>!live(record(state,id))))throw Error('Publish the linked entities first.');
          row.state='Published';delete row.live;
          for(const proposal of state.proposals.filter(item=>item.state==='Approved · publication pending')){
            if((proposal.targets||[]).every(target=>record(state,target)?.state==='Published'))proposal.state='Published by staff';
          }
        }else if(action==='Archive'){
          if(row.state==='Archived')throw Error('This record is already archived.');
          row.state='Archived';row.approved=false;delete row.live;
        }else throw Error('Unknown action.');
        row.revision=crypto.randomUUID();write(state,action,id,actor);
      },
      async addAsset(input){
        await guard();const state=read();const row=asset(state,input,input.entity);
        state.media.push(row);write(state,'Asset saved as draft',row.id,actor);
      },
      async assetAction(id,action){
        await guard();const state=read(),row=state.media.find(item=>item.id===id);
        if(!row)throw Error('Asset is missing.');
        if(action==='Authorize'){row.permission='Authorized';row.state='Draft';}
        else if(action==='Publish'){
          if(row.permission!=='Authorized'||!live(record(state,row.entity)))throw Error('Authorization and a published entity are required.');
          row.state='Published';delete row.live;
          for(const proposal of state.proposals.filter(item=>item.state==='Approved · publication pending')){
            if((proposal.targets||[]).every(target=>record(state,target)?.state==='Published'))proposal.state='Published by staff';
          }
        }else if(action==='Archive')row.state='Archived';
        else throw Error('Unknown asset action.');
        write(state,'Asset '+action,id,actor);
      },
      async decide(id,approve){
        await guard();const state=read(),proposal=state.proposals.find(row=>row.id===id&&row.state==='Pending review');
        if(!proposal)throw Error('This request was already decided.');
        if(approve){
          const old=assertRecord(state,proposal.entity);
          if((old.revision||'')!==proposal.revision)throw Error('The target changed after submission. Ask for a refreshed proposal.');
          const changes={...old,...proposal.changes};
          if(proposal.product){
            const item=assertRecord(state,proposal.product);
            if(item.type!=='product'||item.brand&&item.brand!==old.id||item.state!=='Published'||(item.revision||'')!==proposal.productRevision)
              throw Error('The product changed after submission or is no longer eligible.');
            const liveProduct=staging(item);
            Object.assign(item,{brand:old.id,description:proposal.productDescription||item.description,live:liveProduct,
              state:'Draft',approved:true,revision:crypto.randomUUID()});
          }
          const liveEntity=staging(old);
          Object.assign(old,patch(state,changes,old),{live:liveEntity,state:'Draft',approved:true,revision:crypto.randomUUID()});
          proposal.targets=[old.id,proposal.product].filter(Boolean);
          if(proposal.asset)state.media.push(proposal.asset);
        }
        proposal.state=approve?'Approved · publication pending':'Declined';proposal.decided=new Date().toISOString();
        write(state,'Proposal '+proposal.state,id,actor);
      }
    };
  }
  async function propose(guard,actor,entity,input){
    await guard();
    const state=read(),target=record(state,entity);
    if(!target||target.type!=='brand')throw Error('This simulated business account has no catalogue entity.');
    const note=str(input.note,500);
    const changes={name:str(input.name)||target.name,description:str(input.description,1200)||target.description,
      url:input.url?url(input.url):target.url,source:'Business submission · editorial review required'};
    const product=input.product||'';
    const item=product?record(state,product):null;
    if(product&&(!item||item.type!=='product'||item.brand&&item.brand!==entity||item.state!=='Published'))throw Error('Select an eligible unassigned or owned product.');
    const productDescription=str(input.productDescription,1200);
    if(productDescription&&!product)throw Error('Select an associated product for the proposed description.');
    if(!note&&!str(input.description)&&!str(input.name)&&!input.url&&!input.image&&!product)throw Error('Add changes or a correction note.');
    const id=crypto.randomUUID();
    const image=input.image?asset(state,{...input,name:str(input.assetName),permission:'Pending'},entity):null;
    state.proposals.push({id,actor,entity,changes,note,asset:image,product,productDescription,productRevision:item?.revision||'',revision:target.revision||'',state:'Pending review',at:new Date().toISOString()});
    write(state,'Business proposal submitted',id,actor);
  }
  const published=()=>read().records.map(live).filter(Boolean);
  window.Rated420Catalogue={read,key,types,formats,manager,propose,published,linkedIds,
    publicRecord:id=>published().find(row=>row.id===id),
    publicAsset:id=>read().media.findLast(row=>row.entity===id&&row.permission==='Authorized'&&row.state==='Published')};
})();
