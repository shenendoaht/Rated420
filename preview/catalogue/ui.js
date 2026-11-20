(() => {
  'use strict';
  const store=window.Rated420Catalogue;
  const labels=store.types;
  const el=(tag,text,cls)=>{
    const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;
  };
  function link(text,url,external=false){
    const a=el('a',text,'btn btn-outline');a.href=url;
    if(external)a.dataset.editorialExternal='true';
    return a;
  }
  function button(text,fn){
    const b=el('button',text,'btn btn-outline');b.type='button';b.addEventListener('click',fn);return b;
  }
  const path=row=>'#catalogue/'+row.type+'/'+encodeURIComponent(row.id);
  const native=row=>row.reviewId?({strain:'#strains/',dispensary:'#dispensaries/',brand:'#brands/'}[row.type]||'')+row.reviewId:'';
  function field(form,label,name,value='',options=null,type='text'){
    const box=el('label',label);
    const control=el(options?'select':type==='textarea'?'textarea':'input');
    control.setAttribute('aria-label',label);control.name=name;
    if(options){
      if(type==='multiple')control.multiple=true;
      for(const item of options){
        const [id,text]=Array.isArray(item)?item:[item,item];
        const option=el('option',text);option.value=id;
        if(type==='multiple')option.selected=value?.includes(id);
        control.append(option);
      }
      if(type!=='multiple')control.value=value;
    }else{
      if(type!=='textarea')control.type=type;
      if(type!=='file')control.value=value;
      else control.accept='image/png,image/jpeg,image/webp';
    }
    box.append(control);form.append(box);return control;
  }
  function imageFor(row){
    const figure=el('figure',null,'catalogue-image');
    const asset=store.publicAsset(row.id);
    if(asset){
      const img=el('img');img.src=asset.image;img.alt=asset.alt;img.loading='lazy';figure.append(img);
      if(asset.attribution)figure.append(el('figcaption',asset.attribution));
    }else{
      figure.append(el('span','RATED420','catalogue-wordmark'),el('span','Approved imagery pending','catalogue-caption'));
    }
    return figure;
  }
  function provenance(row,parent){
    parent.append(el('p',row.origin+' · '+row.source,'catalogue-meta'));
    const licence=window.Rated420Intelligence.record(row.licenseId);
    if(licence){
      const details=el('details',null,'build-card');
      details.append(el('summary','Regulatory record · '+licence.licenseStatus),
        el('p',[licence.name,licence.city,licence.county,licence.sourceId,licence.version].filter(Boolean).join(' · ')),
        el('p','Status is from the bundled OCM snapshot. Review scores are independent.'),
        link('Open OCM profile','#businesses/'+encodeURIComponent(licence.id)));
      parent.append(details);
    }
  }
  function card(row){
    const card=el('article',null,'build-card catalogue-card');
    card.append(imageFor(row),el('p',[labels[row.type],row.format,row.origin].filter(Boolean).join(' · '),'catalogue-meta'),el('h2',row.name),
      el('p',row.description),link('View '+row.name,path(row)));
    return card;
  }
  function browser(parent,type){
    const nav=el('nav',null,'build-actions');nav.setAttribute('aria-label','Catalogue categories');
    for(const [id,label] of [['','All catalogue'],...Object.entries(labels)]){
      const a=link(label,'#catalogue'+(id?'/'+id:''));if(id===(type||''))a.setAttribute('aria-current','page');nav.append(a);
    }
    nav.append(link('Accessories','#accessories'),link('Strain scorecards','#strains'),link('Dispensary scorecards','#dispensaries'));
    const tools=el('div',null,'exp-controls');
    const search=field(tools,'Search catalogue','search','',null,'search');
    const format=field(tools,'Product format','format','',[['','All formats'],...store.formats]);
    const view=field(tools,'Catalogue layout','layout','cards',[['cards','Cards'],['compact','Compact']]);
    const grid=el('div',null,'build-grid catalogue-grid');const summary=el('p');summary.setAttribute('aria-live','polite');
    const draw=()=>{
      const query=search.value.trim().toLowerCase();
      const rows=store.published().filter(row=>(!type||row.type===type)&&(!format.value||row.format===format.value)&&
        [row.name,row.description,row.format,row.origin].some(value=>String(value||'').toLowerCase().includes(query)));
      grid.dataset.layout=view.value;
      grid.replaceChildren(...rows.map(card));summary.textContent=rows.length+' catalogue records';
      if(!rows.length)grid.append(el('p','No catalogue records match those filters.'));
    };
    tools.addEventListener('input',draw);
    parent.append(el('p','Browse finished products, cultivars, brands and licensed locations. Manufacturer imagery appears after permission review.'),nav,tools,summary,grid);draw();
  }
  async function score(parent,row){
    const host=el('section',null,'build-card');
    const heading=el('h3','Community reviews');
    const status=el('p','A product-specific scorecard has not been published for this record.');
    host.append(heading,status);parent.append(host);
    const href=native(row);
    if(!href){
      if(row.type!=='product')status.textContent='There is no linked community scorecard for this record.';
      return;
    }
    host.append(link('Open community scorecard',href));
    const api=window.supabase.createClient();
    if(row.type==='brand'){
      const result=await api.rpc('rated420_build01',{operation:'item',payload:{kind:'brand',id:row.reviewId}});
      status.textContent=result.data?.count?Math.round(result.data.average)+' / 420 · '+result.data.count+' reviews':'No brand reviews yet.';
    }else{
      const kind=row.type==='strain'?'strain':'dispensary';
      const result=await api.from(kind+'_community_stats').select('*').eq(kind+'_id',row.reviewId);
      const grade=result.data?.find(item=>kind!=='strain'||item.product_type===null);
      status.textContent=grade?Math.round(grade.avg_total)+' / 420 · '+grade.review_count+' reviewers':'No reviews yet.';
    }
  }
  function stash(parent,row,options){
    if(row.type!=='product')return;
    const strain=store.publicRecord(row.strain);
    if(!strain?.reviewId)return;
    const brand=store.publicRecord(row.brand);
    const status=el('p');status.setAttribute('role','status');
    parent.append(button('Add linked cultivar to Stash',async()=>{
      try{
        const actor=window.RatedComplete.actor();
        const repo=window.RatedExpansionStore.session('stash',async()=>{
          await options.memberGuard(actor);
        },actor);
        const entries=await repo.list();
        if(entries.some(item=>item.productId===strain.reviewId||item.product===strain.name))throw Error('This cultivar is already in your Stash.');
        await repo.save({product:strain.name,productId:strain.reviewId,brand:brand?.name||'',status:'Wishlist',
          favorite:false,flavor:'',cultivar:strain.name,format:row.format,scores:[],date:new Date().toISOString().slice(0,10)});
        status.textContent='Linked cultivar added to your wishlist. The finished product remains a separate catalogue record.';
      }catch(error){status.textContent=error.message;}
    }),status);
  }
  function detail(parent,row,options){
    const article=el('article',null,'build-card catalogue-profile');
    article.append(imageFor(row),el('p',labels[row.type],'catalogue-meta'),el('p',row.description));
    for(const [key,label] of [['format','Format'],['category','Category'],['manufacturer','Manufacturer'],['cannabinoids','Reported cannabinoids'],['terpenes','Reported terpenes'],['cultivation','Cultivation or production']]){
      if(row[key])article.append(el('p',label+' · '+row[key]));
    }
    if(row.url)article.append(link('Open official website',row.url,true));
    if(row.media)article.append(link('Watch Rated420 coverage',row.media,true));
    provenance(row,article);stash(article,row,options);
    parent.append(link('Back to catalogue','#catalogue/'+row.type),article);
    const records=store.published();
    const relations=records.filter(item=>store.linkedIds(row).includes(item.id)||store.linkedIds(item).includes(row.id));
    const related=el('section',null,'build-card');
    related.append(el('h3','Related catalogue records'));
    if(relations.length)for(const item of relations)related.append(link(item.name,path(item)));
    else related.append(el('p','Related records will appear when their associations are verified or published as demo fixtures.'));
    parent.append(related);
    void score(parent,row).catch(()=>parent.append(el('p','Community scores are temporarily unavailable.')));
  }
  async function readImage(file){
    if(!file)return '';
    if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8000000)throw Error('Select a JPG, PNG or WebP file under 8 MB.');
    let bitmap;
    try{bitmap=await createImageBitmap(file);}catch{throw Error('This file could not be decoded as an image.');}
    try{
      const scale=Math.min(1,900/Math.max(bitmap.width,bitmap.height));
      const canvas=el('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
      const context=canvas.getContext('2d');context.fillStyle='#211b2c';context.fillRect(0,0,canvas.width,canvas.height);
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/webp',.78);
    }finally{bitmap.close();}
  }
  function formBox(parent,heading,submit,build,commit){
    const section=el('section',null,'build-card');
    const form=el('form',null,'build-form');
    build(form);
    const status=el('p');status.setAttribute('role','status');
    const save=el('button',submit,'btn btn-primary');save.type='submit';
    form.append(save,status);
    form.addEventListener('submit',async event=>{
      event.preventDefault();save.disabled=true;
      const values=new FormData(form);
      try{
        await commit({...Object.fromEntries(values),dispensaries:values.getAll('dispensaries'),image:await readImage(form.elements.image?.files?.[0])});
        status.textContent='Saved in this browser.';
      }catch(error){status.textContent=error.message;}
      finally{save.disabled=false;}
    });
    section.append(el('h3',heading),form);parent.append(section);
  }
  function assetFields(form,prefix=false){
    for(const [title,name] of [['Asset name',prefix?'assetName':'name'],['Image source','source'],['Rights holder','owner'],['Credit or attribution','attribution'],['Alternative text','alt']])field(form,title,name);
    if(!prefix){field(form,'Acquisition date','acquired','',null,'date');field(form,'Permission','permission','Pending',['Pending','Authorized']);}
    field(form,'Approved image file','image','',null,'file');
  }
  function business(parent,{guard,actor,entity}){
    const state=store.read();
    const eligible=store.published().filter(row=>row.type==='product'&&(!row.brand||row.brand===entity));
    const status=el('section',null,'build-card');
    const history=el('ul');
    const refresh=()=>{
      const proposals=store.read().proposals.filter(row=>row.actor===actor&&row.entity===entity);
      history.replaceChildren(...(proposals.length?proposals.map(row=>el('li',row.changes.name+' · '+row.state+' · '+row.at.slice(0,10))):[el('li','No catalogue proposals yet.')]));
    };
    status.append(el('h3','Your catalogue proposals'),history);refresh();
    parent.append(el('p',"Ratings and reviews can't be bought.",'editorial-statement'),el('p','Suggest changes to your own business presence. Staff review and publication are required.'),status);
    formBox(parent,'Propose catalogue updates','Submit for editorial review',form=>{
      field(form,'Proposed business or brand name','name');
      field(form,'Proposed brand description','description','',null,'textarea');
      field(form,'Proposed official website','url','',null,'url');
      field(form,'Proposed product association','product','',[['','No association'],...eligible.map(row=>[row.id,row.name])]);
      field(form,'Proposed product description','productDescription','',null,'textarea');
      field(form,'Correction or supporting note','note','',null,'textarea');
      const media=el('details');media.append(el('summary','Propose an authorized image'));assetFields(media,true);form.append(media);
    },async values=>{await store.propose(guard,actor,entity,values);refresh();});
  }
  function manager(parent,{guard,actor}){
    const service=store.manager(guard,actor);
    const status=el('p');status.setAttribute('role','status');
    const nav=el('nav',null,'build-actions');nav.setAttribute('aria-label','Catalogue manager sections');
    const content=el('div');
    let view='Overview',selected='',type='',filter='',query='',sort='Name';
    parent.append(el('h2','Catalogue Manager'),el('p','Review linked records, rights, and business proposals before browser-local publication.'),
      link('Data Intelligence Center','#hq/intelligence'),link('Founder workspace','#hq/gary'),nav,status,content);
    const set=async(action,message)=>{
      try{await action();status.textContent=message;draw();}
      catch(error){status.textContent=error.message;}
    };
    function recordForm(state,row={}){
      formBox(content,row.id?'Edit '+row.name:'Create catalogue draft','Save draft',form=>{
        const kind=row.type||type;
        field(form,'Entity type','type',kind,Object.entries(labels));
        if(row.id)form.elements.type.disabled=true;
        field(form,'Record name','name',row.name);
        field(form,'Description','description',row.description,null,'textarea');
        field(form,'Source attribution','source',row.source);
        field(form,'Official website or source link','url',row.url,null,'url');
        if(kind==='product'){
          const choices=(type)=>[['','None'],...state.records.filter(item=>item.type===type&&item.state!=='Archived').map(item=>[item.id,item.name])];
          field(form,'Format','format',row.format||'Flower',store.formats);
          field(form,'Product category','category',row.category);
          field(form,'Manufacturer','manufacturer',row.manufacturer);
          field(form,'Reported cannabinoids','cannabinoids',row.cannabinoids);
          field(form,'Reported terpenes','terpenes',row.terpenes);
          field(form,'Cultivation notes','cultivation',row.cultivation);
          field(form,'Associated brand','brand',row.brand,choices('brand'));
          field(form,'Associated strain','strain',row.strain,choices('strain'));
          field(form,'Producer or processor','producer',row.producer,choices('cultivator'));
          field(form,'Associated dispensaries','dispensaries',row.dispensaries||[],choices('dispensary').slice(1),'multiple');
        }
        if(kind==='dispensary'){
          field(form,'Official OCM license location','licenseId',row.licenseId,
            [['','No association'],...window.Rated420Intelligence.official.filter(item=>/dispensary/i.test(item.category||'')).map(item=>[
              item.id,(item.dba||item.name||item.sourceId)+' · '+(item.city||item.county||item.region||'Location not supplied')+' · '+item.sourceId
            ])]);
        }
      },async values=>{
        if(!row.id&&values.type!==type)throw Error('Choose the entity type on the Records screen before opening a new draft.');
        await service.save(values,row.id);selected='';status.textContent='Draft saved. Review and approve it before publication.';draw();
      });
      content.append(button('Back to records',()=>{selected='';draw();}));
    }
    function records(state){
      if(selected==='new'){recordForm(state);return;}
      if(selected){const row=state.records.find(item=>item.id===selected);if(row){recordForm(state,row);return;}}
      const tools=el('div',null,'exp-controls');
      const kind=field(tools,'Entity type','type',type,[['','All types'],...Object.entries(labels)]);
      const search=field(tools,'Search records','query',query,null,'search');
      const phase=field(tools,'Publication state','state',filter,[['','All states'],'Draft','Published','Archived']);
      const order=field(tools,'Sort records','sort',sort,['Name','State']);
      const results=el('div',null,'build-grid');
      const add=button('Create draft',()=>{
        if(!type){status.textContent='Choose an entity type before opening a new draft.';return;}
        selected='new';draw();
      });
      function refresh(){
        type=kind.value;query=search.value;filter=phase.value;sort=order.value;
        const rows=state.records.filter(row=>(!type||row.type===type)&&(!filter||row.state===filter)&&
          [row.id,row.name,row.source].some(value=>String(value||'').toLowerCase().includes(query.toLowerCase())));
        rows.sort((a,b)=>sort==='State'?a.state.localeCompare(b.state)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
        results.replaceChildren();
        if(!rows.length)results.append(el('p','No records match these filters.'));
        for(const row of rows){
          const card=el('article',null,'build-card');
          card.append(el('h3',row.name),el('p',labels[row.type]+' · '+row.state+(row.approved?' · Approved':'')),el('p',row.origin+' · '+row.source),
            button('Edit '+row.name,()=>{selected=row.id;draw();}));
          const preview=el('details');
          preview.append(el('summary','Preview '+row.name),el('p',row.description));
          for(const id of store.linkedIds(row))preview.append(el('p',state.records.find(item=>item.id===id)?.name||'Unresolved association'));
          provenance(row,preview);card.append(preview);
          if(row.state==='Draft'){
            if(!row.approved)card.append(button('Approve '+row.name,()=>void set(()=>service.transition(row.id,'Approve'),'Draft approved.')));
            else card.append(button('Publish '+row.name,()=>void set(()=>service.transition(row.id,'Publish'),'Published in this browser.')));
          }
          if(row.state!=='Archived')card.append(button('Archive '+row.name,()=>void set(()=>service.transition(row.id,'Archive'),'Archived. Existing reviews were retained.')));
          results.append(card);
        }
      }
      tools.addEventListener('input',refresh);content.append(tools,add,results);refresh();
    }
    function media(state){
      formBox(content,'New or replacement media asset','Save media draft',form=>{
        field(form,'Associated entity','entity','',[['','Select entity'],...state.records.map(row=>[row.id,row.name])]);
        assetFields(form);
      },async values=>{await service.addAsset(values);status.textContent='Media draft saved. Publication is a separate action.';draw();});
      const grid=el('div',null,'build-grid');
      for(const row of state.media){
        const card=el('article',null,'build-card');
        const img=el('img',null,'catalogue-admin-preview');img.src=row.image;img.alt=row.alt;img.loading='lazy';
        card.append(el('h3',row.name),img,el('p',[row.permission,row.state,row.owner,row.source,row.acquired].join(' · ')));
        if(row.permission==='Pending')card.append(button('Authorize '+row.name,()=>void set(()=>service.assetAction(row.id,'Authorize'),'Authorization recorded.')));
        if(row.permission==='Authorized'&&row.state==='Draft')card.append(button('Publish '+row.name,()=>void set(()=>service.assetAction(row.id,'Publish'),'Image published in this browser.')));
        if(row.state!=='Archived')card.append(button('Archive '+row.name,()=>void set(()=>service.assetAction(row.id,'Archive'),'Image archived.')));
        grid.append(card);
      }
      if(!state.media.length)grid.append(el('p','No locally uploaded assets. Public cards use Rated420 placeholders until approved images are published.'));
      content.append(grid);
    }
    function proposals(state){
      if(!state.proposals.length){content.append(el('p','No business proposals yet.'));return;}
      for(const row of [...state.proposals].reverse()){
        const card=el('article',null,'build-card');
        card.append(el('h3',row.changes.name),el('p',row.state+' · '+row.at.slice(0,10)),el('p',row.changes.description),el('p',row.note));
        if(row.product)card.append(el('p','Requested product: '+(state.records.find(item=>item.id===row.product)?.name||row.product)),el('p',row.productDescription));
        if(row.asset)card.append(el('p','Proposed asset: '+row.asset.name+' · '+row.asset.owner+' · separate rights approval required'));
        if(row.state==='Pending review')card.append(button('Approve proposal',()=>void set(()=>service.decide(row.id,true),'Proposal approved as a draft. Review Records to publish.')),
          button('Decline proposal',()=>void set(()=>service.decide(row.id,false),'Proposal declined.')));
        content.append(card);
      }
    }
    function dashboard(state){
      const counts=el('div',null,'build-grid');
      for(const key of ['Published','Draft','Archived']){
        const card=el('article',null,'build-card');
        card.append(el('h3',key),el('p',state.records.filter(row=>row.state===key).length+' records'));counts.append(card);
      }
      const rows=store.published();
      content.append(counts,el('h3','Catalogue completeness'),
        el('p',rows.filter(row=>!store.publicAsset(row.id)).length+' public records awaiting approved imagery'),
        el('p',rows.filter(row=>row.type==='product'&&(!row.brand||!row.strain||!row.dispensaries?.length)).length+' products with a missing brand, cultivar, or retailer association'),
        el('p',rows.filter(row=>row.licenseId).length+' public profiles with an OCM license link'),
        el('p',state.proposals.filter(row=>row.state==='Pending review').length+' business proposals awaiting review'),
        link('Research licensing and providers','#hq/intelligence'),link('Plan outreach in Territory Explorer','#hq/gary/territory'));
    }
    function draw(){
      const state=store.read();
      nav.replaceChildren();content.replaceChildren();
      for(const name of ['Overview','Records','Media','Proposals','History','Accessories']){
        const control=button(name,()=>{view=name;selected='';draw();});control.setAttribute('aria-pressed',String(name===view));nav.append(control);
      }
      if(view==='Overview')dashboard(state);
      else if(view==='Records')records(state);
      else if(view==='Media')media(state);
      else if(view==='Proposals')proposals(state);
      else if(view==='Accessories')window.Rated420Editorial.mountHQ(content,guard,{section:'Accessories',locked:true});
      else{
        const list=el('ul');for(const entry of state.history)list.append(el('li',entry.at+' · '+entry.action+' · '+entry.target+' · '+entry.actor));
        content.append(el('h3','Catalogue change history'),state.history.length?list:el('p','No local edits yet.'));
      }
    }
    draw();
  }
  function open(parent,type,id,options){
    if(id){
      const row=store.publicRecord(id);
      if(!row||row.type!==type){parent.append(el('h2','Catalogue record unavailable'),link('Back to catalogue','#catalogue'));return;}
      options.title.textContent=row.name;detail(parent,row,options);
    }else browser(parent,Object.hasOwn(labels,type)?type:'');
  }
  window.Rated420CatalogueUI={open,card,path,manager,business,dashboard:(parent)=>parent.append(link('Catalogue overview and gaps','#hq/catalogue'))};
})();
