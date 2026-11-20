(() => {
  'use strict';
  const adapters=window.RatedExpansionStore;
  const {regions}=window.RatedExpansionFixtures;
  const currency=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
  const money=n=>currency.format(n/100);
  const keys=['Aesthetic','Aroma','Flavor','Effects','Overall'];
  const title={finance:'Financial Command Center',market:'Territory Explorer',stash:'The Stash',public:'Community review preview'};
  const headings={finance:'Transaction',market:'Business',stash:'Journal entry'};
  const el=(tag,text,cls)=>{
    const result=document.createElement(tag);
    if(text!==undefined)result.textContent=text;
    if(cls)result.className=cls;
    return result;
  };
  function button(name, run){
    const b=el('button',name,'btn '+(/^(Delete|Reset) /.test(name)?'btn-danger':/^Add /.test(name)?'btn-primary':'btn-outline'));b.type='button';b.addEventListener('click',run);return b;
  }
  function box(parent, text, message){
    const card=el('article',undefined,'exp-card');
    card.append(el('h3',text));
    if(message)card.append(el('p',message));
    parent.append(card);return card;
  }
  function field(parent,name,value='',options,type='text'){
    const label=el('label',name);
    let control;
    if(options){
      control=el('select');
      for(const pair of options){
        const [v,t]=Array.isArray(pair)?pair:[pair,pair];
        const option=el('option',t);option.value=v;control.append(option);
      }
      if(value!=='')control.value=value;
    }else{
      control=el(type==='textarea'?'textarea':'input');
      if(type!=='textarea')control.type=type;
      if(type==='checkbox')control.checked=Boolean(value);else control.value=value??'';
    }
    control.setAttribute('aria-label',name);label.append(control);parent.append(label);return control;
  }
  function mount(parent,area,{guard=async()=>{},actor='offline-member',hq,createProspect}={}){
    const node=el('section',undefined,'expansion');
    parent.append(node);
    const status=el('p');status.setAttribute('role','status');
    const content=el('div');
    const dialog=el('dialog');dialog.setAttribute('aria-label','Record editor');
    node.append(el('h2',title[area]),el('p',area==='stash'?'Private synthetic journal · saved in this browser':area==='public'?'Synthetic public projection · only explicitly confirmed reviews appear here':'Synthetic demonstration data · saved in this browser'),status,content,dialog);
    const repository=adapters.session(area,guard,area==='stash'?actor:'');
    let rows=[], territoryProspects, officialView={};
    const current=new Date().toISOString().slice(0,7);
    let region='',category='',search='',sort='Name A–Z',time='Month',month=current,favorites=false,brandFavorites=false,detail='';
    const territoryKey='rated420-ux-territory:'+(window.RatedComplete?.actor()||'');
    if(area==='market'&&window.RatedComplete){
      try{
        const view=JSON.parse(sessionStorage.getItem(territoryKey)||'{}');
        region=regions.some(row=>row.id===view.region)?view.region:'';
        detail=view.detail||'';category=view.category||'';search=view.search||'';officialView=view.officialView||{};
      }catch{}
    }
    function saveTerritory(){
      if(area!=='market'||!window.RatedComplete)return;
      try{sessionStorage.setItem(territoryKey,JSON.stringify({region,detail,category,search,officialView}));}catch{}
    }
    const report=()=>{ if(node.isConnected)render(); };
    async function refresh(){rows=await repository.list();report();}
    const error=e=>{status.textContent=e.message;const slot=dialog.querySelector('[data-error]');if(slot)slot.textContent=e.message;};
    const run=fn=>async()=>{try{await fn();}catch(e){error(e);}};
    function formDialog(heading,build,submitLabel,handle){
      const form=el('form');
      const result=el('p');result.dataset.error='';result.setAttribute('role','status');
      build(form);
      const controls=el('div',undefined,'exp-controls');
      const submit=el('button',submitLabel,'btn '+(/^(Reset|Delete) /.test(submitLabel)?'btn-danger':'btn-primary'));submit.type='submit';
      controls.append(submit,button('Cancel',()=>dialog.close()));
      form.append(result,controls);
      form.addEventListener('submit',async event=>{
        event.preventDefault();submit.disabled=true;
        try{await handle();dialog.close();}catch(e){error(e);}finally{submit.disabled=false;}
      });
      dialog.replaceChildren(el('h3',heading),form);dialog.showModal();
    }
    function edit(row={}){
      let collect;
      formDialog((row.id?'Edit ':'Add ')+headings[area],form=>{
        const pairs={};
        const add=(k,label,options,type)=>pairs[k]=field(form,label,row[k],options,type);
        if(area==='finance'){
          add('name','Description').required=true;
          add('type','Type',['Income','Expense','Budget']);
          add('category','Category',['Sponsorship','Partnership','Merchandise','Production','Marketing','Subscription','Operations','Other']);
          const amount=field(form,'Amount (USD)',row.cents?row.cents/100:'',null,'number');
          amount.min='.01';amount.step='.01';amount.required=true;
          const date=add('date','Date',null,'date');date.required=true;date.min='1900-01-01';date.max='2200-12-31';
          add('status','Status',['Posted','Outstanding','Planned']);
          add('repeat','Frequency',['Once','Monthly']);
          const links=[['contact','contacts','CRM contact'],['campaign','campaigns','CRM campaign'],['production','production','Production'],['opportunity','opportunities','Opportunity']];
          for(const [key,collection,label] of links)add(key,label,[['','None'],...(hq()?.[collection]??[]).map(record=>[record.id,record.name])]);
          return collect=()=>({...values(pairs),cents:Math.round(Number(amount.value)*100)});
        }
        if(area==='market'){
          add('name','Business name').required=true;
          add('region','Region',regions.map(r=>[r.id,r.name]));
          add('category','Category',['Dispensary','Cultivator','Processor','Brand']);
          add('relationship','Relationship',['Prospective','Existing']);
          add('outreach','Outreach stage',['Research','Qualified','Drafted','Contacted','Responded','In discussion','Confirmed']);
          add('product','Product intelligence');
          add('org','CRM organization',[['','None'],...(hq()?.organizations??[]).map(r=>[r.id,r.name])]);
          add('filming','Potential filming location',null,'checkbox');
          for(const [key,label,max] of [['rating','Average score',420],['reviews','Reviews',1000000],['engagement','Engagement',1000000]]){
            const input=add(key,label,null,'number');input.min=0;input.max=max;input.step=1;
          }
          return collect=()=>({...values(pairs),rating:Number(pairs.rating.value),reviews:Number(pairs.reviews.value),engagement:Number(pairs.engagement.value)});
        }
        const product=window.RatedComplete?.products();
        if(product){
          const selected=row.productId||product.find(item=>item.name===row.product)?.id;
          pairs.product=field(form,'Product',selected?String(selected):'', [['','Select a Rated420 strain'],...product.map(item=>[String(item.id),item.name])]);
          pairs.product.required=true;
        }else add('product','Product').required=true;
        add('brand','Brand');add('status','Status',['Tried','Wishlist']);
        add('favorite','Favorite product',null,'checkbox');add('favoriteBrand','Favorite brand',null,'checkbox');add('flavor','Flavor preference');add('cultivar','Cultivar');
        add('format','Format',window.RatedComplete?.formats??['Flower','Pre-Roll','Infused Pre-Roll','Vape Cartridge','Disposable Vape','Concentrate','Edible','Tincture','Topical','Other']);
        add('notes','Private tasting notes',null,'textarea');
        const scoring=el('fieldset');scoring.append(el('legend','Optional scorecard · all five scores required to publish'));
        const scores=keys.map((label,i)=>field(scoring,label,row.scores?.[i],null,'number'));
        for(const input of scores){input.min=0;input.max=84;input.step=1;}
        form.append(scoring);
        return collect=()=>{
          if(pairs.favoriteBrand.checked&&!pairs.brand.value.trim())throw Error('Enter the brand before marking it as a favorite.');
          if(scores.some(s=>s.value!=='')&&scores.some(s=>s.value===''))throw Error('Complete all five scores or leave them blank.');
          const chosen=product?.find(item=>String(item.id)===pairs.product.value);
          if(product&&!chosen)throw Error('Choose an active Rated420 strain.');
          return {...values(pairs),...(chosen?{product:chosen.name,productId:chosen.id}:{}),scores:scores[0].value===''?[]:scores.map(s=>Number(s.value)),date:row.date||new Date().toISOString().slice(0,10)};
        };
      },'Save record',async()=>{
        const fields=collect();
        if(!(fields.name||fields.product))throw Error('Enter a name.');
        if(fields.date&&!/^\d{4}-\d{2}-\d{2}$/.test(fields.date))throw Error('Enter a four-digit year.');
        await repository.save(fields,row.id);await refresh();status.textContent='Record saved.';
      });
    }
    function values(pairs){return Object.fromEntries(Object.entries(pairs).map(([k,c])=>[k,c.type==='checkbox'?c.checked:c.value.trim()]));}
    function remove(row){
      formDialog('Delete record?',form=>form.append(el('p',row.name||row.product)),'Delete record',async()=>{await repository.remove(row.id);detail='';await refresh();status.textContent='Record deleted.';});
    }
    function publish(row){
      let text,confirm;
      formDialog('Preview public review',form=>{
        form.append(el('p',row.product+' · '+row.format+' · '+adapters.total(row.scores)+' / 420'));
        form.append(el('p',keys.map((label,i)=>label+' '+row.scores[i]+'/84').join(' · ')));
        text=field(form,'Public review text', '',null,'textarea');text.maxLength=1200;
        confirm=field(form,'I confirm this review may appear in the public demo',false,null,'checkbox');
        confirm.required=true;
      },'Confirm publication',async()=>{
        if(!confirm.checked)throw Error('Confirm publication first.');
        await repository.publish(row,text.value);status.textContent='Review published to the community review preview.';
      });
    }
    function addActions(card,row){
      card.append(button('Edit '+(row.name||row.product),()=>edit(row)),button('Delete '+(row.name||row.product),()=>remove(row)));
    }
    function finance(container){
      const controls=el('div',undefined,'exp-controls');
      const period=field(controls,'Report period',time,['Month','Year']);
      const date=field(controls,'Report month',month,null,'month');
      date.min='1900-01';date.max='2200-12';
      period.addEventListener('change',()=>{time=period.value;report();});
      date.addEventListener('change',()=>{if(date.value&&date.validity.valid){month=date.value;report();}});
      container.append(controls);
      const start=time==='Year'?month.slice(0,4)+'-01':month;
      const stop=time==='Year'?month.slice(0,4)+'-12':month;
      const entries=adapters.project(rows,start+'-01',stop+'-31');
      const sum=(type,which)=>entries.filter(r=>r.type===type&&which(r)).reduce((n,r)=>n+r.cents,0);
      const income=sum('Income',r=>r.status==='Posted');
      const expense=sum('Expense',r=>r.status==='Posted');
      const projectedIncome=sum('Income',()=>true);
      const projectedExpense=sum('Expense',()=>true);
      const metrics=el('div',undefined,'exp-grid');
      for(const [name,amount] of [['Posted revenue',income],['Posted expenditure',expense],['Profit / loss',income-expense],['Outstanding receivables',sum('Income',r=>r.status==='Outstanding')],['Outstanding payables',sum('Expense',r=>r.status==='Outstanding')],['Projected net',projectedIncome-projectedExpense]])box(metrics,name,money(amount));
      container.append(metrics);
      const chart=box(container,'Income and expenditure');
      const scale=Math.max(1,projectedIncome,projectedExpense);
      for(const [label,value,data] of [['Posted income',income,'Posted'],['Posted expenditure',expense,'Posted'],['Projected income',projectedIncome,'Projection'],['Projected expenditure',projectedExpense,'Projection']]){
        const line=el('div',undefined,'exp-chart');
        const bar=el('progress');bar.max=scale;bar.value=value;bar.setAttribute('aria-label',label);
        line.append(button(label,()=>{category=data;report();}),bar,el('strong',money(value)));chart.append(line);
      }
      const budgets=box(container,'Production budgets');
      for(const budget of rows.filter(r=>r.type==='Budget')){
        const spent=rows.filter(r=>r.production&&r.production===budget.production&&r.type==='Expense'&&r.status==='Posted').reduce((n,r)=>n+r.cents,0);
        budgets.append(el('p',budget.name+' · '+money(spent)+' posted of '+money(budget.cents)));
      }
      if(!rows.some(r=>r.type==='Budget'))budgets.append(el('p','No production budgets.'));
      if(category==='Projection')return entries;
      return rows.filter(r=>r.date.slice(0,7)>=start&&r.date.slice(0,7)<=stop);
    }
    function territory(container){
      const map=box(container,'New York territory map','Choose a region to filter the business queue and official licensing directory.');
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('viewBox','0 0 390 245');svg.setAttribute('aria-hidden','true');
      for(const r of regions){
        const shape=document.createElementNS(svg.namespaceURI,'polygon');
        shape.setAttribute('points',r.shape);shape.setAttribute('class',region===r.id?'selected':'');
        shape.addEventListener('click',()=>choose(r.id));
        const name=document.createElementNS(svg.namespaceURI,'text');
        name.setAttribute('x',r.label[0]);name.setAttribute('y',r.label[1]);
        name.textContent=String(regions.indexOf(r)+1);svg.append(shape,name);
      }
      const filters=el('div',undefined,'exp-controls territory-regions');
      function choose(id,restoreFocus=false){
        if(region!==id)officialView={};
        region=id;detail='';saveTerritory();report();
        if(restoreFocus)content.querySelector('.territory-regions [aria-pressed=true]')?.focus({preventScroll:true});
      }
      for(const r of [{id:'',name:'All regions'},...regions]){
        const label=r.id?(regions.indexOf(r)+1)+' · '+r.name:r.name;
        const control=button(label,event=>choose(r.id,event.detail===0));
        control.setAttribute('aria-pressed',String(region===r.id));filters.append(control);
      }
      const selected=regions.find(row=>row.id===region);
      const intelligence=window.Rated420Intelligence;
      const official=intelligence?.official.filter(row=>(row.city||row.county||row.region)&&(!region||intelligence.marketRegion(row.region)===region));
      const snapshot=official&&intelligence.summary(official);
      const licenseIds=new Set(official?.map(row=>row.id));
      const context=el('div',undefined,'territory-context');
      context.append(el('h4',selected?.name||'All regions'));
      if(snapshot){
        const prospects=el('p');
        const refreshProspects=()=>{
          const count=(hq?.().opportunities||[]).filter(row=>licenseIds.has(row.officialRecordId)).length;
          prospects.textContent=count+' linked local CRM prospects';
        };
        refreshProspects();territoryProspects=refreshProspects;
        context.append(el('p',snapshot.rows+' official license locations · '+snapshot.active+' marked Active'),prospects);
        const breakdown=el('details');breakdown.append(el('summary','Official classifications'));
        for(const [label,count] of snapshot.classes)breakdown.append(el('p',label+' · '+count));
        context.append(breakdown,button('Jump to official license records',()=>{
          const licenses=content.querySelector('#territory-licenses');
          licenses?.focus();licenses?.scrollIntoView({block:'start'});
        }));
      }
      map.append(svg,filters,context);
    }
    content.addEventListener('rated420:prospect-created',()=>territoryProspects?.());
    function render(){
      content.replaceChildren();
      if(area==='public'){
        const reviews=adapters.publicReviews();
        if(!reviews.length)content.append(el('p','No published demo reviews.'));
        for(const row of reviews){
          const card=box(content,row.product,row.format+' · '+row.total+' / 420');
          if(row.text)card.append(el('p',row.text));
          if(row.productId){const link=el('a','Open strain and community scores');link.href='#strains/'+row.productId;card.append(link);}
        }
        return;
      }
      if(area==='market')territory(content);
      const periodRows=area==='finance'?finance(content):rows;
      const tools=el('div',undefined,'exp-controls');
      const searchBox=field(tools,'Search records',search,null,'search');
      const sorts=field(tools,'Sort',sort,area==='stash'?['Name A–Z','Newest','Highest score']:area==='finance'?['Name A–Z','Newest','Largest amount']:['Name A–Z','Highest score','Most engagement']);
      const options=area==='finance'?['','Posted','Outstanding','Planned','Projection','Income','Expense','Budget']:area==='market'?['','Dispensary','Cultivator','Processor','Brand','Prospective','Existing','Filming locations']:['','Tried','Wishlist'];
      const filter=field(tools,'Filter',category,options.map(x=>[x,x||'All records']));
      const starred=area==='stash'?field(tools,'Favorite products only',favorites,null,'checkbox'):null;
      const starredBrands=area==='stash'?field(tools,'Favorite brands only',brandFavorites,null,'checkbox'):null;
      tools.append(button('Add '+headings[area],()=>edit()),button('Reset '+title[area],()=>{
        formDialog('Reset demo records?',f=>f.append(el('p','This restores the original synthetic records for this view.')), 'Reset records',async()=>{
          await repository.reset();detail='';region='';category='';search='';officialView={};month=current;
          await refresh();status.textContent='Demo records reset.';
        });
      }));
      const list=el('div',undefined,'exp-grid');
      const summary=el('p');
      content.append(tools,summary,list);
      const name=r=>r.name||r.product;
      function draw(){
        search=searchBox.value;sort=sorts.value;category=filter.value;saveTerritory();favorites=starred?.checked??false;brandFavorites=starredBrands?.checked??false;
        const query=search.toLowerCase().trim();
        const data=periodRows.filter(r=>(!region||r.region===region)&&(!favorites||r.favorite)&&(!brandFavorites||r.favoriteBrand)&&
          (!category||[r.category,r.status,r.type,r.relationship].includes(category)||(category==='Filming locations'&&r.filming)||(category==='Projection'&&r.type!=='Budget'))&&
          [name(r),r.brand,r.category,r.product,r.flavor,r.cultivar,r.notes,r.outreach].join(' ').toLowerCase().includes(query));
        data.sort((a,b)=>sort==='Newest'?b.date.localeCompare(a.date):sort==='Largest amount'?b.cents-a.cents:
          sort==='Highest score'?(b.rating??adapters.total(b.scores||[]))-(a.rating??adapters.total(a.scores||[])):
          sort==='Most engagement'?b.engagement-a.engagement:name(a).localeCompare(name(b)));
        list.replaceChildren();
        summary.textContent=data.length+(area==='market'?' synthetic business records':' records');
        if(area==='market'){
          const n=data.reduce((sum,row)=>sum+row.reviews,0);
          const weighted=data.reduce((sum,row)=>sum+row.rating*row.reviews,0);
          summary.textContent+=' · '+n+' synthetic ratings · '+(n?Math.round(weighted/n)+' / 420 weighted average':'No average')+
            ' · '+data.reduce((sum,row)=>sum+row.engagement,0)+' synthetic engagements · '+data.filter(row=>row.outreach!=='Research').length+' with outreach underway';
        }
        for(const row of data){
          const desc=area==='finance'?[row.date,row.type,row.category,money(row.cents),row.status,row.repeat]:
            area==='market'?[regions.find(r=>r.id===row.region)?.name,row.category,row.relationship,row.outreach]:
            [row.brand,row.status,row.flavor,row.cultivar,row.favorite?'Favorite product':'',row.favoriteBrand?'Favorite brand':'',row.scores.length?adapters.total(row.scores)+' / 420':''];
          const card=box(list,name(row),desc.filter(Boolean).join(' · '));
          if(area==='market'){
            const disclosure=el('details');const label=el('summary','Business profile');disclosure.open=detail===row.id;
            disclosure.addEventListener('toggle',()=>{if(disclosure.open)detail=row.id;else if(detail===row.id)detail='';saveTerritory();});
            const org=hq()?.organizations.find(o=>o.id===row.org);
            disclosure.append(label,el('p',row.product||'No product intelligence'),el('p',row.filming?'Potential filming location':'No filming location recorded'),el('p',row.reviews+' ratings · '+row.rating+' / 420 · '+row.engagement+' engagements'));
            if(org){
              disclosure.append(el('p','CRM · '+org.name+' · '+org.city));
              const record=el('a','Open CRM organization','btn btn-tertiary');
              record.href='#hq/gary/organizations/'+encodeURIComponent(org.id)+'/territory';disclosure.append(record);
            }
            card.append(disclosure);
          }
          if(area==='finance'){
            const state=hq();
            const links=[['contact','contacts'],['campaign','campaigns'],['production','production'],['opportunity','opportunities']].map(([key,group])=>state?.[group].find(item=>item.id===row[key])?.name).filter(Boolean);
            if(links.length)card.append(el('p','HQ links · '+links.join(' · ')));
          }
          if(area==='stash'&&row.notes)card.append(el('p',row.notes));
          if(row.forecast)card.append(el('p','Projected recurrence'));else addActions(card,row);
          if(area==='stash'&&row.status==='Tried'&&row.scores.length===5)card.append(button('Preview public review',()=>publish(row)));
        }
      }
      if(area==='market')window.Rated420IntelligenceUI?.directory(content,{territory:true,territoryRegion:region,hq,create:createProspect,view:officialView,saveView:saveTerritory});
      tools.addEventListener('input',event=>{
        if(area==='finance'&&event.target===filter&&(category==='Projection'||filter.value==='Projection')){category=filter.value;report();return;}
        draw();
      });draw();
    }
    if(area==='public')render();else void refresh().catch(error);
  }
  window.mountRatedExpansion=mount;
})();
