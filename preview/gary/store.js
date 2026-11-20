(() => {
  'use strict';

  const classifications = ['Farm','Cultivator','Grower','Processor','Manufacturer','Distributor','Dispensary','Brand',
    'Industry organization','Event operator','Ancillary business','Technology or data partner'];
  const stages = ['Research','Qualified prospect','Drafted','Contacted','Responded','In discussion','Confirmed','Completed','Declined','Archived'];
  const founders = ['Founder · Partnerships','Founder · Media'];
  const key = 'rated420-gary-preview-v1';
  const sources = ['NY Office of Cannabis Management','Weedmaps','Leafly','Dutchie','Jane Technologies','CannMenus',
    'Direct brand and manufacturer feeds','Other authorized sources'];
  const today = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0,10);
  const timestamp = () => new Date().toISOString();
  const normalized = t => String(t ?? '').trim().toLowerCase().replace(/\s+/g,' ');
  const uuid = () => 'g-' + crypto.randomUUID();

  function fixtures() {
    return {
      stages:[...stages],
      organizations:[
        {id:'org-farm',name:'Hudson Lantern Farm',legal:'Hudson Lantern Farm LLC',classes:['Farm','Cultivator','Grower'],city:'Hudson, NY',license:'SIM-CULT-001',website:'https://hudson-lantern.example',social:'@hudson-lantern-demo',related:['org-brand'],verification:'Synthetic fixture',source:'Demo research notes',notes:'Prefers weekday farm tours.',reference:'Synthetic interview notes'},
        {id:'org-brand',name:'Field Signal',legal:'Field Signal Studio LLC',classes:['Brand','Manufacturer'],city:'Kingston, NY',license:'SIM-MFG-002',related:['org-farm','org-shop'],verification:'Synthetic fixture',source:'Demo partner referral'},
        {id:'org-shop',name:'North Loop Dispensary',legal:'North Loop Retail LLC',classes:['Dispensary'],city:'Albany, NY',license:'SIM-RET-003',related:['org-brand'],verification:'Synthetic fixture',source:'Demo directory'}
      ],
      contacts:[
        {id:'contact-maya',name:'Maya Vale',email:'maya.vale@example.test',phone:'555-0101',owner:founders[0],
          roles:[{org:'org-farm',role:'Partnerships lead'},{org:'org-brand',role:'Media advisor'}],notes:'Shared liaison for the farm and its brand.'},
        {id:'contact-dnc',name:'Riley West',email:'riley.west@example.test',phone:'555-0102',owner:founders[1],
          roles:[{org:'org-shop',role:'Retail operations'}],dnc:true,notes:'Do not contact.'}
      ],
      threads:[{id:'thread-welcome',subject:'Farm tour introduction',org:'org-farm',contact:'contact-maya',owner:founders[0],
        messages:[{id:'msg-intro',direction:'Inbox',body:'Thanks for the introduction. I can share more about our farm and production process.',at:timestamp(),state:'Received'}]}],
      campaigns:[{id:'campaign-tour',name:'Hudson Valley farm tours',objective:'Book one farm visit for a Vault feature.',classes:['Cultivator'],owner:founders[0],
        status:'Active',sequence:'Day 3: check availability. Day 7: check the production calendar.',recipients:[
          {id:'recipient-riley',org:'org-shop',contact:'contact-dnc',draft:'Would you be open to a visit?',state:'Approved'}
        ]}],
      opportunities:[{id:'opp-tour',name:'Hudson Lantern farm feature',type:'Media collaboration',stage:'Research',org:'org-farm',contact:'contact-maya',owner:founders[0],notes:'Explore an on-site cultivation interview.'}],
      production:[{id:'project-idea',name:'Field Signal product feature',type:'Brand feature',date:today(5),org:'org-brand',contact:'contact-maya',owner:founders[1],status:'Concept',notes:'Draft the episode outline.'}],
      products:[{id:'product-amber',name:'Amber Trail Flower',category:'Flower',brand:'org-brand',cultivator:'org-farm',manufacturer:'org-brand',
        distributor:'',retailer:'org-shop',strain:'Synthetic Amber Trail',cannabinoids:'THC 20% (synthetic)',terpenes:'Limonene, myrcene (synthetic)',
        lab:'Synthetic lab reference LAB-101',imagery:'Bundled Rated420 artwork',reviews:'Synthetic community review DEMO-REV-101',
        verification:'Demo approved',source:'Synthetic brand feed',approval:[founders[1]+' · Fixture seeded']}],
      integrations:sources.map((name,index)=>({id:'source-'+index,name,state:'Mock disconnected',categories:index===0?'Licenses, organizations':'Organizations, products, locations',
        terms:'Access, usage and redistribution terms unverified.',imports:[]})),
      imports:[],
      documents:[{id:'doc-kit',name:'Hudson Lantern media kit',category:'Media kit',org:'org-farm',contact:'contact-maya',opportunity:'opp-tour',
        versions:[{file:'hudson-lantern-media-kit.txt',at:timestamp(),owner:founders[1],note:'Synthetic sample overview and production permissions checklist.'}]}],
      tasks:[{id:'task-intro',name:'Review farm tour introduction',due:today(1),org:'org-farm',contact:'contact-maya',owner:founders[0],done:false,thread:'thread-welcome'},
        {id:'task-outline',name:'Draft Field Signal episode outline',due:today(5),org:'org-brand',contact:'contact-maya',owner:founders[1],done:false}],
      activity:[{id:'activity-demo',text:'Synthetic workspace initialized',owner:founders[0],at:timestamp()}]
    };
  }

  function openStore(assertAccess) {
    function read() {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fixtures();
    }
    function find(state, collection, id) {
      const item = state[collection]?.find(row => row.id === id);
      if (!item) throw Error('That record no longer exists.');
      return item;
    }
    function history(state, text, owner) {
      state.activity.unshift({id:uuid(),text,owner,at:timestamp()});
      state.activity.splice(100);
    }
    function appendMessage(thread, direction, body, owner, extra={}) {
      thread.messages.push({id:uuid(),direction,body,owner,at:timestamp(),...extra});
    }
    function correspondence(state, value, owner) {
      if (!value.subject?.trim() || !value.body?.trim()) throw Error('Add a subject and message.');
      if (value.contact) find(state,'contacts',value.contact);
      if (value.org) find(state,'organizations',value.org);
      if(value.attachment) find(state,'documents',value.attachment);
      const thread = value.thread ? find(state,'threads',value.thread) :
        {id:uuid(),subject:value.subject,org:value.org,contact:value.contact,owner,messages:[]};
      if (!value.thread) state.threads.push(thread);
      appendMessage(thread,'Drafts',value.body,owner,{state:'Draft',attachment:value.attachment,schedule:value.schedule});
      return thread.id;
    }

    async function dispatch(action, data, owner) {
      await assertAccess();
      if (!founders.includes(owner)) throw Error('Choose a founder for attribution.');
      if(action==='reset') {localStorage.removeItem(key);return;}
      const state=read();
      let result;
      let description=action;
      switch(action) {
        case 'save': {
          const {collection,id,...fields}=data;
          if (!['organizations','contacts','campaigns','opportunities','production','products','documents','tasks'].includes(collection)) throw Error('Unsupported edit.');
          if (!fields.name?.trim()) throw Error('Enter a name.');
          for(const name of ['org','brand','cultivator','manufacturer','distributor','retailer']) if(fields[name]) find(state,'organizations',fields[name]);
          if(fields.contact) find(state,'contacts',fields.contact);
          if(fields.document) find(state,'documents',fields.document);
          if(fields.opportunity) find(state,'opportunities',fields.opportunity);
          const old=id ? find(state,collection,id) : null;
          if(collection==='products'&&state.products.some(p=>p.id!==id&&normalized(p.name)===normalized(fields.name)&&p.brand===fields.brand)) throw Error('Review the matching product before saving.');
          const row={...old,...fields,id:id || uuid(),owner:fields.owner || owner};
          if(collection==='contacts') {
            row.roles=[];
            for(const key of Object.keys(fields).filter(name=>/^org[0-9]+$/.test(name))){
              const roleKey='role'+key.slice(3);
              const org=fields[key];
              const title=fields[roleKey]?.trim();
              delete row[key];
              delete row[roleKey];
              if(!org&&!title)continue;
              if(!org||!title||row.roles.some(relationship=>relationship.org===org)) {
                throw Error('Enter one role per represented organization and complete both fields.');
              }
              find(state,'organizations',org);
              row.roles.push({org,role:title});
            }
          }
          if(collection==='documents') {
            row.versions=[...(old?.versions ?? [])];
            if(fields.file) row.versions.unshift({file:fields.file,at:timestamp(),owner,note:fields.versionNote});
            delete row.file;delete row.versionNote;
          }
          if(collection==='campaigns') row.recipients=old?.recipients ?? [];
          if(collection==='products'){
            const changed=old && ['name','brand','category','cultivator','manufacturer','distributor','retailer','strain','cannabinoids','terpenes','imagery','lab'].some(name=>fields[name]!==old[name]);
            row.verification=changed||!old?'Pending review':old.verification;
            row.approval=old?.approval??[];
            if(changed) row.approval.push(owner+' · '+timestamp()+' · Manual correction');
          }
          if(old) Object.assign(old,row);else state[collection].push(row);
          result=row.id;description='Saved '+row.name;break;
        }
        case 'official-prospect': {
          const intelligence=window.Rated420Intelligence;
          const row=intelligence?.record(data.record);
          if(!row||row.licenseStatus!=='Active'||!row.name)throw Error('Select a named source-verified record marked Active.');
          if(state.opportunities.some(item=>item.officialRecordId===row.id))throw Error('An outreach prospect already exists for this license location.');
          const matches=state.organizations.filter(org=>[org.name,org.legal].some(name=>name&&[row.name,row.dba].filter(Boolean).some(value=>intelligence.fold(value)===intelligence.fold(name))));
          if(matches.length&&!matches.some(item=>item.id===data.org))throw Error('Resolve the potential CRM duplicate first.');
          if(!matches.length&&data.org)throw Error('This CRM association could not be verified.');
          const org=data.org||uuid();
          if(!data.org)state.organizations.push({id:org,name:row.dba||row.name,legal:row.name,city:row.city||row.county||row.region||'',
            classes:[],license:row.sourceId,source:'Official public · '+row.version,verification:'Source verified',officialRecordId:row.id});
          const name=(row.dba||row.name)+' · regional outreach';
          const id=uuid();
          state.opportunities.push({id,name,type:'Brand partnership',stage:'Research',owner,org,notes:'Local prospect from '+row.version+' · '+(row.region||'Region not reported'),
            officialRecordId:row.id});
          result=id;description='Created official-data outreach prospect '+name;break;
        }
        case 'stage-add': {
          const name=data.name.trim();
          if(!name||state.stages.some(stage=>normalized(stage)===normalized(name))) throw Error('Choose a new stage name.');
          state.stages.push(name);description='Added stage '+name;break;
        }
        case 'compose': result=correspondence(state,data,owner);description='Saved correspondence draft';break;
        case 'message-state': {
          const thread=find(state,'threads',data.thread);
          const message=thread.messages.find(m=>m.id===data.id);
          if(!message || message.direction!=='Drafts') throw Error('Only drafts can be approved or delivered.');
          if(data.state==='Approved' && message.state==='Draft')message.state='Approved';
          else if(data.state==='Delivered'&&message.state==='Approved'){
            if(thread.contact&&find(state,'contacts',thread.contact).dnc) throw Error('Delivery blocked: contact opted out or is marked do not contact.');
            if(message.schedule&&message.schedule>today(0)) throw Error('Delivery blocked: the scheduled date has not arrived.');
            message.direction='Sent';message.state='Simulated delivery';message.at=timestamp();
          } else throw Error('Approve the draft before simulating delivery.');
          result=thread.id;description=message.state+' · '+thread.subject;break;
        }
        case 'add-recipient': {
          const campaign=find(state,'campaigns',data.campaign);
          const contact=find(state,'contacts',data.contact);
          const org=find(state,'organizations',data.org);
          if(!contact.roles.some(r=>r.org===org.id))throw Error('Choose an organization represented by this contact.');
          if(campaign.recipients.some(r=>r.contact===contact.id&&r.org===org.id))throw Error('This recipient already belongs to the campaign.');
          campaign.recipients.push({id:uuid(),contact:contact.id,org:org.id,state:'Draft',draft:'',schedule:''});
          result=campaign.id;description='Added campaign recipient '+contact.name;break;
        }
        case 'recipient': {
          const campaign=find(state,'campaigns',data.campaign);
          const r=campaign.recipients.find(row=>row.id===data.id);
          if(!r)throw Error('Recipient missing.');
          const contact=find(state,'contacts',r.contact);
          if(data.step==='edit'){
            if(['Delivered','Responded'].includes(r.state))throw Error('This draft has already been delivered.');
            r.draft=data.draft.trim();r.schedule=data.schedule;r.state='Draft';delete r.approver;
          } else if(data.step==='approve'){
            if(r.state!=='Draft'||!r.draft)throw Error('Save a personalized draft before approval.');
            r.state='Approved';r.approver=owner;
          } else if(data.step==='deliver'){
            if(contact.dnc)throw Error('Delivery blocked: contact opted out or is marked do not contact.');
            if(r.state!=='Approved')throw Error('Approve this recipient’s draft before simulating delivery.');
            if(r.schedule&&r.schedule>today(0))throw Error('Delivery blocked: the scheduled date has not arrived.');
            r.state='Delivered';r.sentAt=timestamp();
            const thread={id:uuid(),subject:campaign.name,org:r.org,contact:r.contact,owner,messages:[]};
            appendMessage(thread,'Sent',r.draft,owner,{state:'Simulated delivery',campaign:campaign.id});
            state.threads.push(thread);r.thread=thread.id;
          } else if(data.step==='respond'){
            if(!['Delivered','Responded'].includes(r.state)||!data.response.trim())throw Error('Simulate delivery and enter a reply first.');
            const thread=find(state,'threads',r.thread);
            appendMessage(thread,'Inbox',data.response.trim(),owner,{state:'Simulated reply',campaign:campaign.id});
            r.state='Responded';
            if(data.due)state.tasks.push({id:uuid(),name:'Follow up with '+contact.name,due:data.due,org:r.org,contact:r.contact,owner,done:false,thread:thread.id});
          } else throw Error('Unknown recipient action.');
          result=campaign.id;description='Campaign '+data.step+' · '+contact.name;break;
        }
        case 'follow-up': {
          const thread=find(state,'threads',data.thread);
          if(!data.due||!data.name?.trim())throw Error('Enter a task and date.');
          state.tasks.push({id:uuid(),name:data.name,due:data.due,org:thread.org,contact:thread.contact,owner,done:false,thread:thread.id});
          description='Scheduled correspondence follow-up';result=thread.id;break;
        }
        case 'mock-connection': {
          const source=find(state,'integrations',data.id);
          source.state=source.state==='Mock disconnected'?'Mock connected':'Mock disconnected';
          description=source.state+' · '+source.name;result=source.id;break;
        }
        case 'mock-sync': {
          const source=find(state,'integrations',data.id);
          if(source.state==='Mock disconnected')throw Error('Connect the mock provider before running intake.');
          const batch={id:uuid(),at:timestamp(),owner,source:source.id,records:[
            {id:uuid(),raw:'  Orchard   Light Gummies  ',name:'Orchard Light Gummies',category:'Edible',brand:'org-brand',status:'Pending'},
            {id:uuid(),raw:' Amber Trail Flower ',name:'Amber Trail Flower',category:'Flower',brand:'org-brand',status:'Pending'},
            {id:uuid(),raw:'(missing name)',name:'',category:'Flower',brand:'org-brand',status:'Pending'}
          ]};
          for(const row of batch.records){
            row.history=[{owner,at:timestamp(),event:'Staged and normalized'}];
            row.status=!row.name?'Invalid':state.products.some(p=>normalized(p.name)===normalized(row.name)&&p.brand===row.brand)?'Duplicate':'Pending';
            if(row.status!=='Pending')row.history.push({owner,at:timestamp(),event:row.status});
          }
          state.imports.unshift(batch);source.imports.unshift(batch.id);source.state='Mock sync complete';
          description='Ran synthetic import for '+source.name;result=source.id;break;
        }
        case 'import-review': {
          const batch=find(state,'imports',data.batch);
          const row=batch.records.find(r=>r.id===data.id);
          if(!row||['Approved','Linked duplicate'].includes(row.status))throw Error('This intake record is already resolved.');
          if(data.step==='correct'){
            row.name=data.name.trim().replace(/\s+/g,' ');
            row.category=data.category.trim();
            row.status=!row.name||!row.category?'Invalid':state.products.some(p=>normalized(p.name)===normalized(row.name)&&p.brand===row.brand)?'Duplicate':'Pending';
          } else {
            const match=state.products.find(p=>normalized(p.name)===normalized(row.name)&&p.brand===row.brand);
            if(!row.name||!row.category)throw Error('Correct invalid fields before approval.');
            if(data.step==='link'){
              if(!match)throw Error('There is no matching product to link.');
              row.status='Linked duplicate';row.product=match.id;
            } else if(data.step==='approve'){
              if(match)throw Error('Resolve the duplicate by linking the existing product or correcting the row.');
              const product={id:uuid(),name:row.name,category:row.category,brand:row.brand,verification:'Demo approved',
                source:find(state,'integrations',batch.source).name,importId:batch.id,importRow:row.id,approval:[owner+' · '+timestamp()+' · Approved import']};
              state.products.push(product);row.status='Approved';row.product=product.id;
            } else throw Error('Unsupported import decision.');
          }
          row.history.push({owner,at:timestamp(),event:data.step+' · '+row.status});
          result=batch.source;description='Reviewed import · '+row.status;break;
        }
        case 'product-approve': {
          const product=find(state,'products',data.id);
          if(!product.name||!product.brand||!product.category||!product.source)throw Error('Add product identity, brand, category, and source before approval.');
          if(product.verification==='Demo approved')throw Error('Product already approved.');
          product.verification='Demo approved';(product.approval??=[]).push(owner+' · '+timestamp()+' · Approved for demo');
          result=product.id;description='Approved synthetic catalog product';break;
        }
        default: throw Error('Unsupported preview action.');
      }
      history(state,description,owner);
      localStorage.setItem(key,JSON.stringify(state));
      return result;
    }
    return {read,dispatch};
  }
  window.GaryStore={openStore,classifications,founders};
})();
