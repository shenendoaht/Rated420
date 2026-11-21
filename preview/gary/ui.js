(() => {
  'use strict';

  const {openStore,classifications,founders}=window.GaryStore;
  const names={dashboard:'Overview',organizations:'Industry directory',contacts:'Contacts and relationships',threads:'Correspondence',
    campaigns:'Outreach campaigns',opportunities:'Business development',production:'Production planning',products:'Product intelligence',
    integrations:'Data integrations',documents:'Documents',tasks:'Founder tasks',activity:'Activity'};
  const types={
    opportunities:['Prospective client','Brand partnership','Sponsorship','Media collaboration','Data-sharing partnership','Interview','Proposal'],
    production:['Episode concept','Interview','Cultivation tour','Dispensary visit','Brand feature','Event coverage'],
    documents:['Company overview','Media kit','Proposal','Sponsorship','Production document','Internal policy','Correspondence attachment']
  };
  const templates={
    'Farm visit':'Hello, I’m reaching out from Rated420 about a filmed farm visit. Would you be open to discussing dates?',
    'Media kit':'Thanks for connecting. I’ve attached a sample media kit and would welcome your feedback.',
    'Follow-up':'Following up on our earlier note. Is there a good time to continue the conversation?'
  };
  const titles={org:'Organization',contact:'Contact',opportunity:'Opportunity',document:'Document',owner:'Founder',type:'Type',date:'Scheduled date',
    category:'Category',brand:'Brand',cultivator:'Cultivator',manufacturer:'Manufacturer',distributor:'Distributor',retailer:'Dispensary',
    name:'Name',legal:'Legal name',city:'Location',license:'License details',website:'Website reference',social:'Social links',
    source:'Source provenance',verification:'Verification status',related:'Related organizations and brands',notes:'Private notes',
    reference:'Media and review references',dnc:'Do not contact or opted out',email:'Email',phone:'Phone',objective:'Objective',
    sequence:'Follow-up sequence',value:'Optional value',stage:'Stage',status:'Status',strain:'Related strain reference',
    imagery:'Image or asset reference',lab:'Lab documentation reference',media:'Media asset references',
    reviews:'Community review references',cannabinoids:'Cannabinoids',terpenes:'Terpenes',due:'Due date',done:'Completed'};
  const labels={organizations:'organization',contacts:'contact',campaigns:'campaign',production:'production project',opportunities:'opportunity',
    products:'product',documents:'document',tasks:'task'};

  function el(tag,text,attrs={}) {
    const x=document.createElement(tag);
    if(text!==undefined)x.textContent=text;
    for(const [k,v] of Object.entries(attrs))x.setAttribute(k,v);
    return x;
  }
  function btn(text,handler,primary=false) {
    const x=el('button',text,{type:'button',class:'btn '+(primary?'btn-primary':'btn-outline')});
    x.addEventListener('click',handler);
    return x;
  }
  function card(parent,title,text) {
    const x=el('article',undefined,{class:'build-card gary-card'});
    x.append(el('h3',title));
    if(text)x.append(el('p',text));
    parent.append(x);return x;
  }

  function mount(host,{assertAccess,initial='dashboard',initialRecord,backToTerritory}={}) {
    const store=openStore(assertAccess??(()=>{}));
    let selected=Object.hasOwn(names,initial)?initial:'dashboard';
    let detail=initialRecord||'', filter='', query='', order='name', owner=founders[0], folder='Inbox', month=new Date().toISOString().slice(0,7), calendar=false;
    let state=store.read();
    const main=el('section',undefined,{class:'gary-hq'});
    const notice=el('p',undefined,{role:'status',class:'gary-status'});
    const banner=el('div',undefined,{class:'gary-top'});
    const complete=Boolean(window.RatedComplete);
    if(complete)main.classList.add('founder-desk');
    banner.append(el('p',complete?'Founder workspace · synthetic preview':'SYNTHETIC PREVIEW · All delivery, imports, documents, and approvals are simulated.',{class:'gary-preview'}));
    const who=el('label','Acting founder');
    const roles=el('select',undefined,{'aria-label':'Acting founder'});
    for(const name of founders)roles.append(el('option',name,{value:name}));
    roles.addEventListener('change',()=>{owner=roles.value;});
    who.append(roles);
    const reset=btn('Reset founder demo',()=>{if(window.confirm('Reset the synthetic founder workspace?'))void mutate('reset',{},()=>go('dashboard'));});
    reset.className='btn btn-danger';banner.append(who);
    if(complete){
      const tools=el('details',undefined,{class:'founder-demo-tools'});
      tools.append(el('summary','Demo settings'),el('p','Delivery, imports and approvals are simulated.'),reset);
      banner.append(tools);
    }else banner.append(reset);
    const nav=el('nav',undefined,{'aria-label':'Founder workspace',class:'gary-nav'});
    const body=el('div',undefined,{class:'gary-body'});
    const editor=el('dialog',undefined,{class:'gary-dialog'});
    main.append(banner,nav,notice,body,editor);
    host.append(main);
    window.Rated420UX?.workspace(nav,body,'Founder');

    const trail=[];
    function focusHeading(){
      const heading=body.querySelector('h2');
      heading.tabIndex=-1;heading.focus({preventScroll:true});
    }
    function go(view,id='',preset='') {
      if(id&&(view!==selected||id!==detail))trail.push({selected,detail,filter,query,order,folder,calendar});
      if(!id){trail.length=0;query='';order='name';}
      selected=view;detail=id;filter=preset;notice.textContent='';
      if(editor.open)editor.close();
      render();focusHeading();
    }
    function back(){
      const prior=trail.pop();
      if(!prior){go(selected);return;}
      ({selected,detail,filter,query,order,folder,calendar}=prior);
      render();focusHeading();
    }
    async function mutate(action,data,done=()=>render()) {
      try {
        const result=await store.dispatch(action,data,owner);
        if(!main.isConnected)return;
        state=store.read();
        if(editor.open)editor.close();
        done(result);
        notice.textContent=action==='reset'?'Synthetic workspace reset.':'Saved in the synthetic workspace.';
      } catch(error) {
        notice.textContent=error.message;
        if(editor.open)editor.querySelector('[role=status]').textContent=error.message;
      }
    }
    const find=(collection,id)=>state[collection].find(x=>x.id===id);
    const selectValues=collection=>state[collection].map(x=>[x.id,x.name??x.subject]);
    const listing=()=>el('div',undefined,{class:'build-grid gary-grid'});
    function relation(place,collection,id,label) {
      const r=id&&find(collection,id);
      if(r)place.append(btn(label??r.name??r.subject,()=>go(collection,r.id)));
    }
    function relations(place,collection,title,predicate) {
      const rows=state[collection].filter(predicate);
      if(!rows.length)return;
      const section=el('div',undefined,{class:'gary-links'});
      section.append(el('h4',title));
      rows.forEach(r=>relation(section,collection,r.id));
      place.append(section);
    }
    function selectPairs(values){return values.map(x=>Array.isArray(x)?x:[x,x]);}
    function input(form,[id,label,type,options],value) {
      const group=el('label',label);
      const select=type==='select'||type==='multi';
      const control=el(select?'select':type==='textarea'?'textarea':'input',undefined,{name:id,'aria-label':label});
      if(select) {
        if(type==='multi') {
          control.multiple=true;
          group.append(el('small','Choose all that apply.'));
        }
        for(const [v,name] of selectPairs(options)) {
          const option=el('option',name,{value:v});
          if(type==='multi'&&(value??[]).includes(v))option.selected=true;
          control.append(option);
        }
      } else if(type!=='textarea')control.type=type||'text';
      if(type==='checkbox')control.checked=Boolean(value);
      else if(type!=='multi' && (!select || value!=null))control.value=value??'';
      if(id==='name'||id==='subject')control.required=true;
      if(!select && !['checkbox','file','date','number'].includes(type))control.maxLength=type==='textarea'?2500:200;
      group.append(control);
      form.append(group);
      return control;
    }
    function dialog(title,fields,values,action,extra,done,caption='Save') {
      editor.replaceChildren(el('h2',title));
      const form=el('form',undefined,{class:'build-form'});
      const controls=fields.map(spec=>[spec[0],input(form,spec,values[spec[0]])]);
      const error=el('p',undefined,{role:'status'});
      const actions=el('div',undefined,{class:'build-actions'});
      const submit=el('button',caption,{type:'submit',class:'btn btn-primary'});
      actions.append(submit,btn('Cancel',()=>editor.close()));
      form.append(error,actions);
      form.addEventListener('submit',async event=>{
        event.preventDefault();
        const payload={...extra};
        for(const [key,control] of controls){
          payload[key]=control.type==='checkbox'?control.checked:control.multiple?[...control.selectedOptions].map(o=>o.value):
            control.type==='file'?(control.files[0]?.name??''):control.value.trim();
        }
        submit.disabled=true;
        await mutate(action,payload,done);
        submit.disabled=false;
      });
      editor.append(form);
      if(!editor.open)editor.showModal();
    }

    const plain=(k,t='text')=>[k,titles[k]??k,t];
    const enumField=(k,values)=>[k,titles[k]??k,'select',values];
    const setField=(k,label,options)=>[k,label,'multi',options];
    const reference=(k,collection)=>enumField(k,[['','—'],...selectValues(collection)]);
    const assignment=()=>enumField('owner',founders);
    function fieldsFor(collection, row) {
      switch(collection) {
        case 'organizations':return [plain('name'),plain('legal'),setField('classes','Classifications',classifications),plain('city'),
          plain('license'),plain('website'),plain('social'),setField('related',titles.related,selectValues('organizations').filter(x=>x[0]!==row.id)),
          plain('reference'),plain('source'),enumField('verification',['Unverified','Under review','Synthetic fixture']),plain('notes','textarea')];
        case 'contacts':return [plain('name'),plain('email','email'),plain('phone','tel'),assignment(),plain('dnc','checkbox'),plain('notes','textarea'),
          ...Array.from({length:Math.max(2,(row.roles??[]).length+1)},(_,i)=>[
            ['org'+i,'Represented organization '+(i+1),'select',[['','—'],...selectValues('organizations')]],
            ['role'+i,'Professional role '+(i+1),'text']
          ]).flat()];
        case 'campaigns':return [plain('name'),plain('objective','textarea'),setField('classes','Target classifications',classifications),
          assignment(),enumField('status',['Active','Draft','Paused','Completed']),plain('sequence','textarea')];
        case 'opportunities':return [plain('name'),enumField('type',types.opportunities),enumField('stage',state.stages),plain('value'),
          assignment(),reference('org','organizations'),reference('contact','contacts'),plain('notes','textarea')];
        case 'production':return [plain('name'),enumField('type',types.production),plain('date','date'),assignment(),enumField('status',['Concept','Scheduled','In production','Ready','Published']),
          reference('org','organizations'),reference('contact','contacts'),reference('opportunity','opportunities'),reference('document','documents'),plain('media'),plain('notes','textarea')];
        case 'products':return [plain('name'),plain('category'),reference('brand','organizations'),reference('cultivator','organizations'),reference('manufacturer','organizations'),reference('distributor','organizations'),
          reference('retailer','organizations'),plain('strain'),plain('cannabinoids'),plain('terpenes'),plain('imagery'),plain('lab'),plain('reviews'),plain('source')];
        case 'documents':return [plain('name'),enumField('category',types.documents),reference('org','organizations'),reference('contact','contacts'),
          reference('opportunity','opportunities'),['file','Simulated upload (filename only)','file'],['versionNote','Version note','textarea']];
        case 'tasks':return [plain('name'),plain('due','date'),assignment(),reference('org','organizations'),reference('contact','contacts'),plain('done','checkbox')];
      }
    }
    function edit(collection,row={}) {
      const values={owner,...row};
      for(const [i,r] of (row.roles??[]).entries()){values['org'+i]=r.org;values['role'+i]=r.role;}
      dialog((row.id?'Edit ':'Add ')+labels[collection],fieldsFor(collection,row),values,'save',{collection,id:row.id},id=>go(collection,id));
    }
    function details(parent,collection,row) {
      const item=card(parent,row.name);
      const dl=el('dl',undefined,{class:'gary-details'});
      for(const [k,v] of Object.entries(row)) {
        if(!v||!titles[k]||k==='related')continue;
        dl.append(el('dt',titles[k]));
        const value=el('dd');
        const references={org:'organizations',brand:'organizations',cultivator:'organizations',manufacturer:'organizations',distributor:'organizations',retailer:'organizations',contact:'contacts',opportunity:'opportunities'};
        if(references[k])relation(value,references[k],v);
        else value.textContent=Array.isArray(v)?v.join(' · '):v===true?'Yes':v;
        dl.append(value);
      }
      item.append(dl,btn('Edit '+labels[collection],()=>edit(collection,row)));
      if(collection==='organizations'){
        for(const id of row.related??[])relation(item,'organizations',id);
        relations(item,'contacts','Contacts',x=>x.roles.some(role=>role.org===row.id));
        relations(item,'products','Products',x=>['brand','cultivator','manufacturer','distributor','retailer'].some(k=>x[k]===row.id));
      }
      if(collection==='contacts'){
        const roles=el('ul');
        for(const r of row.roles){const li=el('li',r.role+' · ');relation(li,'organizations',r.org);roles.append(li);}
        item.append(roles,btn('Add to campaign',()=>pickCampaign(row)));
      }
      const crossCollections=['threads','opportunities','production','documents','tasks'];
      for(const group of crossCollections.filter(x=>x!==collection)){
        relations(item,group,names[group],x=>(collection==='organizations'&&x.org===row.id)||(collection==='contacts'&&x.contact===row.id)||
          (collection==='opportunities'&&(x.opportunity===row.id||(group==='threads'&&x.org===row.org&&x.contact===row.contact))));
      }
      if(collection==='products'){
        if(row.verification!=='Demo approved')item.append(btn('Simulate publishing approval',()=>void mutate('product-approve',{id:row.id})));
        if(row.approval?.length)item.append(el('p','Approval history: '+row.approval.join(' | ')));
        if(row.importId){
          const batch=find('imports',row.importId);
          const source=batch&&find('integrations',batch.source);
          if(source)relation(item,'integrations',source.id,'Open import provenance');
        }
      }
      if(collection==='documents'){
        item.append(el('h4','Version history'));
        if(row.id==='doc-kit')item.append(el('a','Download synthetic media kit',{href:'synthetic-media-kit.txt',download:'hudson-lantern-media-kit.txt'}));
        for(const v of row.versions)item.append(el('p',v.file+' · '+v.owner+' · '+v.at+' — '+(v.note??'')));
      }
      if(collection==='production'&&row.document)relation(item,'documents',row.document,'Open linked document');
      if(collection==='tasks'&&row.thread)relation(item,'threads',row.thread,'Open correspondence thread');
    }
    function pickCampaign(contact) {
      dialog('Add '+contact.name+' to campaign',[
        ['campaign','Campaign','select',selectValues('campaigns')],
        ['org','Organization','select',contact.roles.map(r=>[r.org,find('organizations',r.org).name])]
      ],{campaign:state.campaigns[0]?.id,org:contact.roles[0]?.org,contact:contact.id},'add-recipient',{contact:contact.id},id=>go('campaigns',id),'Add recipient');
    }
    function campaign(parent,row) {
      details(parent,'campaigns',row);
      const stats=['Draft','Approved','Delivered','Responded'].map(x=>x+': '+row.recipients.filter(r=>r.state===x).length);
      parent.append(el('p',stats.join(' · ')),btn('Add campaign recipient',()=>{
        dialog('Add campaign recipient',[reference('contact','contacts'),reference('org','organizations')],{},'add-recipient',{campaign:row.id},id=>go('campaigns',id),'Add recipient');
      }));
      for(const r of row.recipients) {
        const c=find('contacts',r.contact);
        const target=card(parent,c.name,r.state+(c.dnc?' · Do not contact':'')+(r.schedule?' · Scheduled '+r.schedule:''));
        relation(target,'organizations',r.org);
        relation(target,'contacts',r.contact,'Contact profile');
        if(r.draft)target.append(el('p',r.draft));
        if(r.approver)target.append(el('p','Approved by '+r.approver));
        const payload={campaign:row.id,id:r.id};
        if(!['Delivered','Responded'].includes(r.state)){
          target.append(btn('Personalize draft',()=>dialog('Personalize draft',[
            ['draft','Personalized message','textarea'],['schedule','Delivery date','date']
          ],r,'recipient',{...payload,step:'edit'},id=>go('campaigns',id))));
          if(r.state!=='Approved')target.append(btn('Approve recipient',()=>void mutate('recipient',{...payload,step:'approve'})));
          target.append(btn('Simulate delivery',()=>void mutate('recipient',{...payload,step:'deliver'})));
        } else {
          relation(target,'threads',r.thread,'Open thread');
          target.append(btn('Log reply and follow-up',()=>dialog('Log reply and follow-up',[
            ['response','Simulated reply','textarea'],['due','Follow-up due','date']
          ],{},'recipient',{...payload,step:'respond'},id=>go('campaigns',id),'Record reply')));
        }
      }
    }

    function compose(thread) {
      dialog(thread?'Reply to '+thread.subject:'Compose simulated draft',[
        ['subject','Subject','text'],reference('org','organizations'),reference('contact','contacts'),
        ['template','Template','select',[['','—'],...Object.keys(templates)]],['body','Message','textarea'],
        ['attachment','Simulated attachment','select',[['','—'],...selectValues('documents')]],
        ['schedule','Delivery date','date']
      ],{subject:thread?.subject,org:thread?.org,contact:thread?.contact},'compose',{thread:thread?.id},id=>go('threads',id),'Save draft');
      const form=editor.querySelector('form');
      form.elements.template.addEventListener('change',()=>{
        const t=templates[form.elements.template.value];
        if(t)form.elements.body.value=t;
      });
    }
    function thread(parent,row) {
      const section=card(parent,row.subject,row.owner);
      relation(section,'organizations',row.org);
      relation(section,'contacts',row.contact);
      section.append(btn('Compose reply',()=>compose(row)),btn('Schedule follow-up',()=>dialog('Schedule follow-up',[
        plain('name'),['due','Due date','date']
      ],{},'follow-up',{thread:row.id},id=>go('threads',id))));
      for(const m of row.messages){
        const item=card(parent,m.direction+' · '+m.state,m.body);
        item.append(el('small',[m.owner,m.at].filter(Boolean).join(' · ')));
        if(m.schedule)item.append(el('p','Scheduled for '+m.schedule));
        relation(item,'documents',m.attachment);
        if(m.direction==='Drafts'){
          if(m.state==='Draft')item.append(btn('Approve draft',()=>void mutate('message-state',{thread:row.id,id:m.id,state:'Approved'})));
          item.append(btn('Simulate send',()=>void mutate('message-state',{thread:row.id,id:m.id,state:'Delivered'})));
        }
      }
      relations(parent,'tasks','Scheduled follow-ups',x=>x.thread===row.id);
    }
    function integration(parent,row) {
      const top=card(parent,row.name,row.state+' · '+row.categories);
      top.append(el('p',row.terms+' Authorization required before any live use.'),
        btn(row.state==='Mock disconnected'?'Connect mock provider':'Disconnect mock provider',()=>void mutate('mock-connection',{id:row.id})),
        btn('Run mock product intake',()=>void mutate('mock-sync',{id:row.id})));
      for(const batchId of row.imports){
        const batch=find('imports',batchId);
        const batchCard=card(parent,'Import batch · '+batch.at,batch.owner+' · '+batch.records.length+' staged rows');
        for(const entry of batch.records){
          const item=card(batchCard,(entry.name||'Missing name')+' · '+entry.status,'Raw source value: '+entry.raw);
          item.append(el('p',entry.history.map(x=>x.owner+' · '+x.at+' · '+x.event).join(' | ')));
          if(entry.product)relation(item,'products',entry.product,'Open catalog product');
          if(['Approved','Linked duplicate'].includes(entry.status))continue;
          const payload={batch:batchId,id:entry.id};
          item.append(btn('Correct row',()=>dialog('Correct import row',[plain('name'),plain('category')],entry,'import-review',
            {...payload,step:'correct'},id=>go('integrations',id))));
          if(entry.status==='Duplicate')item.append(btn('Link duplicate',()=>void mutate('import-review',{...payload,step:'link'})));
          item.append(btn('Approve into demo catalog',()=>void mutate('import-review',{...payload,step:'approve'})));
        }
      }
    }

    function legacyDashboard(parent) {
      const metrics=[
        ['Organizations','organizations',state.organizations.length],
        ['Contacts','contacts',state.contacts.length],
        ['Active campaigns','campaigns',state.campaigns.filter(x=>x.status==='Active').length,'Active'],
        ['Pending correspondence','threads',state.threads.filter(x=>x.messages.some(m=>m.direction==='Drafts')).length,'Drafts'],
        ['Upcoming follow-ups','tasks',state.tasks.filter(x=>!x.done&&x.due&&x.due>=new Date().toISOString().slice(0,10)).length,'Upcoming'],
        ['Prospective partnerships','opportunities',state.opportunities.filter(x=>!['Confirmed','Completed','Declined','Archived'].includes(x.stage)).length,'Prospective'],
        ['Confirmed collaborations','opportunities',state.opportunities.filter(x=>x.stage==='Confirmed').length,'Confirmed'],
        ['Scheduled production','production',state.production.filter(x=>x.status==='Scheduled').length,'Scheduled'],
        ['Open founder tasks','tasks',state.tasks.filter(x=>!x.done).length,'Open'],
        ['Recent activity','activity',state.activity.length]
      ];
      const grid=listing();
      for(const [title,view,count,tag] of metrics){
        const item=btn(title,()=>{if(view==='threads')folder='Drafts';go(view,'',tag);});
        item.className='build-card gary-metric';
        item.prepend(el('strong',String(count)));
        grid.append(item);
      }
      parent.append(grid);
      window.Rated420IntelligenceUI?.dashboard(parent,true);
      window.Rated420CatalogueUI?.dashboard(parent);
      const act=card(parent,'Recent activity');
      state.activity.slice(0,5).forEach(x=>act.append(el('p',x.text+' · '+x.owner)));
      act.append(btn('Open activity log',()=>go('activity')));
    }
    function dashboard(parent){
      if(!window.RatedComplete){legacyDashboard(parent);return;}
      const today=new Date().toISOString().slice(0,10);
      const rows=el('div',undefined,{class:'ops-board'});
      const taskQueue=state.tasks.filter(row=>!row.done).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
      const mail=state.threads.filter(row=>row.messages.some(message=>message.direction==='Drafts')||
        row.messages.at(-1)?.direction==='Inbox');
      const pipeline=state.opportunities.filter(row=>!['Completed','Declined','Archived'].includes(row.stage));
      const production=state.production.filter(row=>['Scheduled','In production','Ready'].includes(row.status))
        .sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
      const queue=(title,view,items,description,empty)=>{
        const panel=card(rows,title);
        panel.classList.add('ops-queue');
        const list=el('ul',undefined,{class:'ops-list'});
        for(const row of items.slice(0,4)){
          const item=el('li');
          const control=btn(row.name||row.subject,()=>go(view,row.id));
          control.className='btn btn-tertiary';
          item.append(control,el('span',description(row),{class:'ops-meta'}));list.append(item);
        }
        if(items.length)panel.append(list);
        else panel.append(el('p',empty));
        const open=btn('Open '+names[view],()=>go(view));
        open.className='btn btn-tertiary';panel.append(open);
      };
      queue('Follow-ups','tasks',taskQueue,row=>[row.due?(row.due<today?'Overdue · ':row.due===today?'Due today · ':'Due ')+row.due:'No due date',row.owner].join(' · '),'No open founder tasks.');
      queue('Correspondence to review','threads',mail,row=>row.messages.some(message=>message.direction==='Drafts')?'Draft awaiting action':'Latest message received','No drafts or recent incoming threads.');
      queue('Opportunity pipeline','opportunities',pipeline,row=>[row.stage,row.owner].filter(Boolean).join(' · '),'No open opportunities.');
      queue('Scheduled production','production',production,row=>[row.status,row.date,row.owner].filter(Boolean).join(' · '),'No scheduled or in-progress projects.');
      const approvals=card(rows,'Approvals and import review');
      const catalogue=window.Rated420Catalogue?.read();
      const pending=catalogue?.proposals.filter(row=>row.state==='Pending review').length||0;
      approvals.append(el('a',pending+' catalogue proposals to review',{href:'#hq/catalogue/proposals',class:'btn btn-tertiary'}));
      const intake=state.imports.flatMap(batch=>batch.records).filter(row=>!['Approved','Linked duplicate'].includes(row.status));
      approvals.append(btn(intake.length+' demo intake rows awaiting review',()=>go('integrations')));
      if(pending||intake.length)rows.prepend(approvals);
      const activity=el('details',undefined,{class:'build-card founder-activity'});
      activity.append(el('summary','Recent activity'));rows.append(activity);
      for(const item of state.activity.slice(0,3))activity.append(el('p',item.text+' · '+item.owner));
      if(!state.activity.length)activity.append(el('p','No workspace changes recorded.'));
      activity.append(btn('Open activity log',()=>go('activity')));
      parent.append(rows);
    }
    function calendarView(parent,rows) {
      const controls=el('div',undefined,{class:'gary-tools'});
      const form=el('div');
      const inputMonth=input(form,['month','Calendar month','month'],month);
      inputMonth.addEventListener('change',()=>{month=inputMonth.value||month;render();});
      controls.append(form,btn('Add production project',()=>edit('production')),btn('List view',()=>{calendar=false;render();}));
      parent.append(controls);
      const [year,m]=month.split('-').map(Number);
      const grid=el('div',undefined,{class:'gary-calendar'});
      const offset=new Date(year,m-1,1).getDay();
      for(const day of ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'])grid.append(el('strong',day));
      for(let i=0;i<offset;i++)grid.append(el('span'));
      for(let day=1;day<=new Date(year,m,0).getDate();day++){
        const cell=el('div',String(day));
        const date=month+'-'+String(day).padStart(2,'0');
        for(const row of rows.filter(r=>r.date===date))cell.append(btn(row.name,()=>go('production',row.id)));
        grid.append(cell);
      }
      parent.append(grid,el('p',rows.filter(r=>r.date?.startsWith(month)).length+' entries this month.'));
    }

    function list(parent) {
      const controls=el('div',undefined,{class:'gary-tools'});
      const search=input(controls,['search','Search '+names[selected].toLowerCase(),'search'],query);
      const sorts=input(controls,['sort','Sort','select',[['name','Name A–Z'],['reverse','Name Z–A']]],order);
      const options={
        organizations:classifications,opportunities:[...state.stages,'Prospective'],campaigns:['Active','Draft','Paused','Completed'],
        production:['Scheduled','Concept','In production','Ready','Published'],tasks:['Open','Upcoming','Completed'],
        contacts:['Do not contact',...founders],documents:types.documents,products:['Demo approved','Pending review'],
        integrations:['Mock disconnected','Mock connected','Mock sync complete']
      };
      const filterBox=options[selected]?input(controls,['filter','Filter','select',[['','All'],...options[selected]]],filter):null;
      if(labels[selected])controls.append(btn('Add '+labels[selected],()=>edit(selected),true));
      if(selected==='opportunities')controls.append(btn('Add stage',()=>dialog('Add opportunity stage',[plain('name')],{},'stage-add',{},()=>go('opportunities'))));
      if(selected==='production')controls.append(btn('Calendar view',()=>{calendar=true;render();}));
      if(selected==='threads') {
        addMailboxFilter();
        controls.append(btn('Compose draft',()=>compose(),true));
      }
      function addMailboxFilter(){
        const folders=input(controls,['folder','Mailbox','select',['Inbox','Sent','Drafts']],folder);
        folders.addEventListener('change',()=>{folder=folders.value;update();});
      }
      const result=listing();
      const count=el('p',undefined,{'aria-live':'polite'});
      parent.append(controls,count,result);
      function update() {
        filter=filterBox?.value??'';query=search.value;order=sorts.value;
        const f=filter;
        const searchValue=query.toLowerCase().trim();
        const matches=r=>{
          if(!f)return true;
          if(f==='Prospective')return !['Confirmed','Completed','Declined','Archived'].includes(r.stage);
          if(f==='Open')return !r.done;
          if(f==='Upcoming')return !r.done&&r.due&&r.due>=new Date().toISOString().slice(0,10);
          if(f==='Completed'&&selected==='tasks')return r.done;
          if(f==='Do not contact')return r.dnc;
          return r.classes?.includes(f)||[r.stage,r.status,r.owner,r.category,r.verification,r.state].includes(f);
        };
        const title=r=>r.name??r.subject??r.text;
        const rows=state[selected].filter(r=>matches(r)&&(selected!=='threads'||r.messages.some(m=>m.direction===folder))&&
          [title(r),r.legal,r.city,r.email,r.classes?.join(' '),r.notes,r.description,r.license,r.source,r.category]
            .filter(Boolean).join(' ').toLowerCase().includes(searchValue));
        if(selected!=='activity')rows.sort((a,b)=>title(a).localeCompare(title(b))*(sorts.value==='reverse'?-1:1));
        if(selected==='production'&&calendar){body.replaceChildren(el('h2',names.production));calendarView(body,rows);return;}
        count.textContent=rows.length+' records';
        result.replaceChildren();
        for(const r of rows){
          const sub=[r.classes?.join(' · '),r.city,r.stage,r.status,r.state,r.verification,r.date,r.due,r.owner].filter(Boolean).join(' · ');
          const item=card(result,title(r),sub);
          if(selected!=='activity')item.append(btn('Open '+title(r),()=>go(selected,r.id)));
        }
        if(!rows.length)result.append(el('p','No matching records.'));
      }
      controls.addEventListener('input',update);
      update();
    }
    function render() {
      nav.replaceChildren();
      const controls=Object.fromEntries(Object.entries(names).map(([view,name])=>{
        const link=btn(name,()=>{calendar=false;go(view);});
        link.setAttribute('aria-pressed',String(view===selected));
        return [view,link];
      }));
      if(window.Rated420UX){
        const link=(label,href)=>el('a',label,{href,class:'btn btn-tertiary'});
        window.Rated420UX.sections(nav,[
          ['Today',[controls.dashboard,controls.tasks,controls.threads]],
          ['Business',[controls.organizations,controls.contacts,controls.campaigns,controls.opportunities]],
          ['Intelligence',[controls.products,controls.integrations,link('Territory Explorer','#hq/gary/territory'),link('Data Intelligence Center','#hq/intelligence')]],
          ['Operations',[controls.production,controls.documents,controls.activity,link('Financial Command Center','#hq/gary/finance')]]
        ]);
      }else nav.append(...Object.values(controls));
      body.replaceChildren(el('h2',names[selected]));
      if(selected==='dashboard'){dashboard(body);return;}
      if(selected==='threads')body.append(el('p','rated420.ny@gmail.com · Local simulated mailbox'));
      const row=detail&&find(selected,detail);
      if(!row){list(body);return;}
      if(backToTerritory)body.append(el('a','Back to Territory Explorer',{href:'#hq/gary/territory',class:'btn btn-tertiary'}));
      const previous=trail.at(-1);
      body.append(btn('Back to '+names[previous?.selected||selected],back));
      if(selected==='campaigns')campaign(body,row);
      else if(selected==='threads')thread(body,row);
      else if(selected==='integrations')integration(body,row);
      else details(body,selected,row);
    }
    render();
  }
  window.mountGaryPreview=mount;
})();
