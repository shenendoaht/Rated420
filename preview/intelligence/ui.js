(() => {
  'use strict';
  const data=window.Rated420Intelligence;
  const sources=window.Rated420DataSources;
  const headings={sourceId:'Source identifier',locationId:'Location identifier',category:'License classification',licenseStatus:'License status',issued:'Issued date',expires:'Expiration date',name:'Business name',dba:'Doing business as',city:'Municipality',county:'County',region:'Region'};
  const el=(tag,value,cls)=>{
    const node=document.createElement(tag);
    if(value!=null)node.textContent=value;
    if(cls)node.className=cls;
    return node;
  };
  function action(label,fn){
    const control=el('button',label,'btn btn-outline');
    control.type='button';control.addEventListener('click',fn);return control;
  }
  function link(label,url){
    const control=el('a',label,'btn btn-outline');
    control.href=url;return control;
  }
  function field(parent,label,options,type='text'){
    const wrapper=el('label',label);
    const control=el(options?'select':type==='textarea'?'textarea':'input');
    control.setAttribute('aria-label',label);
    if(options)for(const item of options){
      const [value,name]=Array.isArray(item)?item:[item,item];
      const option=el('option',name);option.value=value;control.append(option);
    }
    else if(type!=='textarea')control.type=type;
    wrapper.append(control);parent.append(wrapper);return control;
  }
  const distinct=(rows,k)=>[...new Set(rows.map(row=>row[k]).filter(Boolean))].sort();
  const date=seconds=>new Date(seconds*1000).toISOString().slice(0,10);
  function countList(pairs,list){
    list.replaceChildren(...pairs.map(([name,count])=>el('li',name+' · '+count.toLocaleString())));
  }
  function dashboard(parent,includeImports=false){
    const section=el('section',null,'build-card');
    section.append(el('h3','Market intelligence · official license snapshot'));
    const tools=el('div',null,'exp-controls');
    const region=field(tools,'Snapshot region',[['','Statewide'],...distinct(data.official,'region'),['__unknown','Region not reported']]);
    const metrics=el('p');const classes=el('ul');const years=el('ul');
    function update(){
      const rows=data.official.filter(row=>!region.value||(row.region||'__unknown')===region.value);
      const s=data.summary(rows);
      metrics.textContent=s.rows+' license/location records · '+s.licenses+' unique license numbers · '+s.active+' records marked Active · '+s.geo+' with reported geography';
      countList(s.classes,classes);countList(s.issued,years);
    }
    region.addEventListener('change',update);update();
    section.append(el('p','OCM source version '+data.snapshot.version+' · updated '+date(data.snapshot.rowsUpdatedAt)+' · retrieved '+data.snapshot.retrievedOn),
      tools,metrics,el('p','Source-verified records: '+data.official.length+' statewide'+(includeImports?' · Unverified local imports: '+data.records().length:'')+'.'));
    if(window.Rated420UX){
      const breakdown=el('details',null,'ref-filter-disclosure');
      breakdown.append(el('summary','License classifications and issuance cohorts'),el('h4','Records by license classification'),classes,el('h4','Issuance cohorts from this snapshot'),years,
        el('p','Cohorts count dated records in the current snapshot. They do not measure historical net market growth. Missing dates and geography remain unknown.'));
      section.append(breakdown);
    }else section.append(el('h4','Records by license classification'),classes,el('h4','Issuance cohorts from this snapshot'),years,
      el('p','Cohorts count dated records in the current snapshot. They do not measure historical net market growth. Missing dates and geography remain unknown.'));
    parent.append(section);
  }
  function businessDetails(parent,row,options={}){
    parent.append(el('h3',row.dba||row.name||'Business name not reported'));
    if(row.dba&&row.name&&row.dba!==row.name)parent.append(el('p','Licensee: '+row.name));
    parent.append(el('p',[row.category,row.licenseStatus||'Status not reported',row.city,row.county,row.region].filter(Boolean).join(' · ')),
      el('p','Official public data · source verified · '+row.version),
      el('p','License '+row.sourceId+(row.locationId?' · Location '+row.locationId:'')+' · Issued '+(row.issued?.slice(0,10)||'not reported')+' · Expires '+(row.expires?.slice(0,10)||'not reported')),
      link('View original OCM record',data.recordUrl(row)));
    if(options.directoryLink)parent.append(link('Open business profile','#businesses/'+encodeURIComponent(row.id)));
    if(options.hq){
      const state=options.hq();
      const matches=state.organizations.filter(org=>[org.name,org.legal].some(name=>name&&[row.name,row.dba].filter(Boolean).some(value=>data.fold(value)===data.fold(name))));
      const opportunity=state.opportunities.find(item=>item.officialRecordId===row.id);
      parent.append(el('p',opportunity?'CRM prospect exists: '+opportunity.name:matches.length?'Potential CRM matches: '+matches.map(item=>item.name).join(', '):'Outreach: no linked demo prospect.'));
      if(opportunity)parent.append(link('Open business development','#hq/gary/opportunities'));
      else if(options.create&&row.licenseStatus==='Active'&&row.name){
        const chooser=matches.length?field(parent,'Associate existing CRM organization',[['','Choose a match'],...matches.map(item=>[item.id,item.name])]):null;
        const status=el('p');status.setAttribute('role','status');
        const create=action('Create local CRM prospect',async()=>{
          create.disabled=true;
          try{
            if(chooser&&!chooser.value)throw Error('Choose an existing CRM match before creating a prospect.');
            await options.create(row.id,chooser?.value||'');
            status.textContent='Prospect created in Business Development. No correspondence sent.';
            parent.append(link('Open business development','#hq/gary/opportunities'));
          }catch(error){status.textContent=error.message;create.disabled=false;}
        });
        parent.append(create,status);
      }
    }
  }
  function directory(parent,{territory=false,territoryRegion='',hq,create}={}){
    const card=el('section',null,'build-card ri-directory');
    card.append(el('h3',territory?'Official license locations':'Official public licensing directory'),
      el('p',territory?'Browse records with state-reported municipalities, counties or regions. The schematic map is not a street-level map.':'Source-reported license and location records. Community scores and Rated420 content remain separate.'));
    const base=territory?data.official.filter(row=>(row.city||row.county||row.region)&&(!territoryRegion||data.marketRegion(row.region)===territoryRegion)):data.official;
    const tools=el('div',null,'exp-controls');
    const filterRows=hq?[...base,...data.records()]:base;
    const search=field(tools,'Search official licenses',null,'search');
    let refinements=tools;
    if(window.Rated420UX){
      const disclosure=el('details',null,'ref-filter-disclosure');
      refinements=el('div',null,'exp-controls');
      disclosure.append(el('summary','Advanced filters'),refinements);
      disclosure.open=matchMedia('(min-width: 761px)').matches;
      const help=el('details',null,'ref-filter-disclosure');
      help.append(el('summary','About status and verification'),el('p','License status is reported by New York. Source verified means the record can be traced to the state snapshot. Outreach and community ratings are separate.'));
      card.append(tools,disclosure,help);
      const density=field(tools,'Record layout',[['cards','Cards'],['compact','Compact']]);
      const pref='rated420-ux-license-layout';
      try{density.value=localStorage.getItem(pref)==='compact'?'compact':'cards';}catch{}
      const setDensity=()=>{
        card.dataset.density=density.value;
        try{localStorage.setItem(pref,density.value);}catch{}
      };
      density.addEventListener('change',setDensity);
      card.dataset.density=density.value;
    }

    const region=field(refinements,'Official region',[['','All reported regions'],...distinct(filterRows,'region'),['__unknown','Not reported']]);
    const category=field(refinements,'Official license classification',[['','All classifications'],...distinct(filterRows,'category')]);
    const status=field(refinements,'Official license status',[['','All statuses'],...distinct(filterRows,'licenseStatus')]);
    const verified=field(refinements,'Verification',[['official','Source verified'],['unverified','Unverified local imports']]);
    if(!hq)verified.options[1].remove();
    const outreach=hq?field(refinements,'Outreach status',[['','All outreach statuses'],...(hq().stages??[]),['none','No CRM opportunity']]):null;
    const summary=el('p');summary.setAttribute('aria-live','polite');
    const grid=el('div',null,'build-grid');const pager=el('div',null,'build-actions');
    let page=0;
    function render(){
      const q=data.fold(search.value);
      const state=hq?.();
      const stages=new Map((state?.opportunities??[]).filter(r=>r.officialRecordId).map(r=>[r.officialRecordId,r.stage]));
      const selected=(verified.value==='unverified'?data.records().filter(row=>!territory||row.city||row.county||row.region):base)
        .filter(row=>(!region.value||(row.region||'__unknown')===region.value)&&(!category.value||row.category===category.value)&&
          (!status.value||row.licenseStatus===status.value)&&(!outreach?.value||(stages.get(row.id)||'none')===outreach.value)&&
          [row.name,row.dba,row.city,row.county,row.sourceId].some(value=>data.fold(value).includes(q)));
      const max=Math.max(0,Math.ceil(selected.length/12)-1);page=Math.min(page,max);
      summary.textContent=selected.length+' records · Page '+(page+1)+' of '+(max+1);
      grid.replaceChildren();
      for(const row of selected.slice(page*12,page*12+12)){
        const entry=el('article',null,'build-card');
        if(row.verified&&window.Rated420UX){
          const record=el('details',null,'build-card ref-license-record');
          const overview=el('summary');
          const label=el('span',row.dba||row.name||'Business name not reported');
          const flag=el('span',row.licenseStatus||'Status not reported','ref-license-status');flag.dataset.active=String(row.licenseStatus==='Active');
          overview.append(label,flag);
          const brief=el('p',[row.category,row.city||row.county||row.region,'Official public'].filter(Boolean).join(' · '));
          record.append(overview,brief);
          const details=el('div');record.append(details);
          const fill=()=>{if(!details.childElementCount)businessDetails(details,row,{directoryLink:true,hq,create});};
          record.addEventListener('toggle',()=>{if(record.open)fill();});
          if(q&&selected.length===1){record.open=true;fill();}
          grid.append(record);continue;
        }
        if(row.verified)businessDetails(entry,row,{directoryLink:true,hq,create});
        else entry.append(el('h3',row.name),el('p','Unverified · '+row.kind+' · '+row.category+' · '+(row.licenseStatus||'Status not supplied')),
          el('p','Source: '+sources.find(s=>s.id===row.source)?.name+' · Record '+row.sourceId+' · Imported '+row.at.slice(0,10)));
        grid.append(entry);
      }
      pager.replaceChildren();
      if(page>0)pager.append(action('Previous page',()=>{page--;render();}));
      if(page<max)pager.append(action('Next page',()=>{page++;render();}));
    }
    tools.addEventListener('input',()=>{page=0;render();});
    if(refinements!==tools)refinements.addEventListener('input',()=>{page=0;render();});
    if(!tools.isConnected&&tools.parentNode!==card)card.append(tools);
    card.append(summary,grid,pager);parent.append(card);render();
  }
  function mount(parent,{guard,writable,hq,create}){
    const root=el('section',null,'expansion ri-center');
    const status=el('p');status.setAttribute('role','status');
    root.append(el('h2','Data Intelligence Center'),el('p',writable?'Official snapshot and browser-local import management.':'Read-only intelligence view for the simulated moderator role.'),status);
    const tabs=el('nav',null,'build-actions');tabs.setAttribute('aria-label','Data intelligence sections');
    const content=el('div');
    root.append(tabs,content);parent.append(root);
    const service=data.session(guard);
    const visible=(error)=>{status.textContent=error.message;};
    function overview(){dashboard(content,true);}
    function datasets(){directory(content,{hq,create:writable?create:null});}
    function directorySources(){
      const proposed=data.read().settings;
      for(const source of sources){
        const card=el('article',null,'build-card');
        const setting=proposed[source.id]??{};
        card.append(el('h3',source.name),el('p',source.kind+' · '+source.status),
          el('p',source.categories),el('p',source.coverage),el('p','Integration: '+source.method),el('p','Conditions: '+source.terms),
          el('p',source.id==='ocm'?'Last retrieved: '+data.snapshot.retrievedOn+' · '+data.snapshot.version:'Last successful sync: none · availability: '+(source.status==='Available locally'?'manual input only':'no active connection')),
          el('p',setting.mode?'Proposed setting: '+setting.mode+' · '+setting.interval:'Proposed setting: manual'));
        if(setting.checkedAt)card.append(el('p','Last local diagnostic: '+setting.checkedAt+' · '+setting.outcome));
        if(source.url)card.append(link('Source website',source.url));
        if(source.policy)card.append(link('Usage conditions',source.policy));
        if(writable){
          const options=el('div',null,'exp-controls');
          const mode=field(options,'Sync mode for '+source.name,['Manual','Scheduled proposal']);mode.value=setting.mode||'Manual';
          const interval=field(options,'Sync interval for '+source.name,['Daily','Weekly','Monthly']);interval.value=setting.interval||'Weekly';
          options.append(action('Save synchronization proposal',async()=>{
            try{await service.settings(source.id,mode.value,interval.value);status.textContent='Proposal saved. No background sync was scheduled.';show('Sources');}catch(error){visible(error);}
          }));
          options.append(action('Check local availability',async()=>{
            try{status.textContent=await service.check(source.id);show('Sources');}catch(error){visible(error);}
          }));
          card.append(options);
        }
        content.append(card);
      }
    }
    function history(){
      const batches=[...data.read().batches].reverse();
      if(!batches.length)content.append(el('p','No local imports have been applied.'));
      for(const batch of batches){
        const card=el('article',null,'build-card');
        card.append(el('h3',batch.label),el('p','Batch '+batch.id+' · '+batch.at+' · '+sources.find(s=>s.id===batch.source)?.name),
          el('p',batch.records.length+' applied · '+batch.rejected+' invalid · '+(batch.skipped-batch.rejected)+' skipped'+(batch.revertedAt?' · Reverted '+batch.revertedAt:'')));
        const changes=el('details');changes.append(el('summary','Audit decisions'));
        for(const change of batch.decisions)changes.append(el('p','Row '+change.line+' · '+change.recordId+' · '+change.decision));
        card.append(changes);
        if(writable&&!batch.revertedAt)card.append(action('Revert '+batch.label,async()=>{
          if(!window.confirm('Revert this local batch? Its audit entry will remain.'))return;
          try{await service.revert(batch.id);status.textContent='Import reverted.';show('History');}catch(error){visible(error);}
        }));
        content.append(card);
      }
    }
    function importer(){
      const editor=el('div',null,'build-card');
      const label=field(editor,'Dataset name');label.maxLength=80;
      const format=field(editor,'Import format',[['csv','CSV'],['json','JSON']]);
      const source=field(editor,'Local source',sources.filter(s=>s.id!=='ocm').map(s=>[s.id,s.name]));source.value='manual';
      const file=field(editor,'Choose CSV or JSON file',null,'file');file.accept='.csv,.json,text/csv,application/json';
      const input=field(editor,'Paste CSV or JSON',null,'textarea');input.maxLength=500000;
      const stage=el('div',null,'build-card');
      const results=el('div');
      file.addEventListener('change',async()=>{
        const selected=file.files[0];if(!selected)return;
        if(selected.size>500000){visible(Error('Choose a file under 500 KB.'));return;}
        try{input.value=await selected.text();format.value=selected.name.toLowerCase().endsWith('.json')?'json':'csv';stage.replaceChildren();results.replaceChildren();}catch(error){visible(error);}
      });
      for(const control of [input,format,source])control.addEventListener('input',()=>{stage.replaceChildren();results.replaceChildren();});
      editor.append(action('Load synthetic sample',()=>{
        label.value='Synthetic license examples';format.value='csv';source.value='manual';
        input.value='company,reference,classification,status,region\nSample Lantern Market,SYNTH-101,Adult-Use Retail,Active,Mid-Hudson\nDuplicate sample,SYNTH-101,Adult-Use Retail,Active,Mid-Hudson\nMissing identifier,,Processor,Active,Capital District';
        stage.replaceChildren();results.replaceChildren();
      }),action('Map fields',()=>{
        try{
          const raw=data.parse(input.value,format.value);
          const headers=[...new Set(raw.flatMap(row=>Object.keys(row)))].filter(h=>!h.startsWith('__'));
          const aliases={name:['entity_name','company','name'],sourceId:['license_number','reference','sourceId','id'],category:['license_type','classification','category'],licenseStatus:['license_status','status'],locationId:['location_id'],issued:['issued_date'],expires:['expiration_date']};
          stage.replaceChildren(el('h3','Field mapping'));results.replaceChildren();
          const inputs={};
          for(const [fieldName,title] of Object.entries(headings)){
            const control=field(stage,title,[['','Do not import'],...headers]);
            control.value=([fieldName,...(aliases[fieldName]??[])]).find(candidate=>headers.includes(candidate))||'';
            inputs[fieldName]=control;
            control.addEventListener('change',()=>results.replaceChildren());
          }
          stage.append(action('Preview normalized records',()=>{
            try{
              const mapping=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value]));
              const preview=data.preview(input.value,format.value,mapping,source.value);
              const expected=JSON.stringify(preview), choices={};
              results.replaceChildren(el('h3','Import preview'),
                el('p',preview.length+' rows · '+preview.filter(r=>r.error).length+' invalid · '+preview.filter(r=>r.duplicate).length+' duplicate candidates. Invalid and unresolved records will be skipped.'));
              preview.forEach((row,i)=>{
                const item=el('div',null,'build-card');
                item.append(el('p','Row '+row.line+' · '+(row.error||[row.row.name,row.row.sourceId,row.row.category,row.duplicate].filter(Boolean).join(' · '))));
                if(['Existing local identity','Possible name match'].includes(row.duplicate)){
                  const option=field(item,'Resolve row '+row.line,[['','Skip'],row.duplicate==='Possible name match'?['distinct','Keep as a distinct local record']:['supersede','Supersede local record']]);
                  option.addEventListener('change',()=>choices[i]=option.value);
                }
                results.append(item);
              });
              results.append(action('Commit eligible records',async()=>{
                try{
                  const count=await service.commit({input:input.value,format:format.value,source:source.value,mapping,choices,
                    label:label.value.trim()||'Untitled import',expected});
                  status.textContent=count+' records imported.';show('History');
                }catch(error){visible(error);}
              }));
            }catch(error){visible(error);}
          }));
        }catch(error){visible(error);}
      }));
      content.append(editor,stage,results);
    }
    const sections={Overview:overview,Datasets:datasets,Sources:directorySources,History:history};
    if(writable)sections.Import=importer;
    function show(name){
      content.replaceChildren();tabs.replaceChildren();
      for(const title of Object.keys(sections)){
        const control=action(title,()=>show(title));control.setAttribute('aria-pressed',String(title===name));tabs.append(control);
      }
      sections[name]();
    }
    show('Overview');
  }
  window.Rated420IntelligenceUI={mount,dashboard,directory,businessDetails};
})();
