window.createBuild02 = function createBuild02({ client, member, page, login, avatarImage }) {
  const labels = { strain:'Strains',brand:'Brands',dispensary:'Dispensaries',accessory:'Accessories' };
  const paths = { strain:'strains',brand:'brands',dispensary:'dispensaries',accessory:'accessories' };
  const headings = { discover:'Explore the catalog', contribute:'Contribute a listing', hq:'Rated420 HQ', shop:'The Shop', episodes:'The Vault episodes', profile:'Community profile' };
  const area = document.getElementById('hqContent');
  const heading = document.getElementById('hqTitle');
  const tabs = ['Submissions','Catalog','Analytics','Polls','Episodes','Showroom','Access'];
  const art = { artwork:'images/carousel-2.webp',tee:'images/merch-tee.webp',hoodie:'images/merch-hoodie.webp',hat:'images/merch-hat.webp',sticker:'images/merch-sticker.webp' };
  let request = 0;
  let activeTab = 'Submissions';

  function el(tag, text, cls) {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  }
  function link(text, url, cls) {
    const n = el('a', text, cls);
    n.href = url;
    return n;
  }
  function button(text, action) {
    const n = el('button',text,'btn btn-outline');
    n.type='button';
    n.addEventListener('click',action);
    return n;
  }
  function field(form,label,name,{options,value='',type='text',required=false,max=120}={}) {
    const box = el('label',label);
    const input = el(options ? 'select' : type==='textarea' ? 'textarea' : 'input');
    input.name=name;
    input.setAttribute('aria-label',label);
    if (options) {
      for (const [key,caption] of options) {
        const option=el('option',caption);
        option.value=key;
        input.append(option);
      }
    } else if (type!=='textarea') input.type=type;
    if (type==='text'||type==='textarea'||type==='url') input.maxLength=max;
    if (type==='file') input.accept='image/png,image/jpeg,image/webp';
    if (type!=='file') input.value=options && !options.some(([key])=>key===value) ? options[0][0] : value ?? '';
    input.required=required;
    box.append(input);
    form.append(box);
    return input;
  }
  async function api(operation,payload={},rpc='rated420_build02') {
    const {data,error}=await client().rpc(rpc,{operation,payload});
    if (error) throw new Error(error.message);
    return data;
  }
  function formFor(parent,caption,onSend) {
    const form=el('form',undefined,'build-form hq-form');
    const submit=el('button',caption,'btn btn-primary');
    submit.type='submit';
    const status=el('p');
    status.setAttribute('role','status');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      submit.disabled=true;
      status.textContent='Saving…';
      try {
        await onSend(Object.fromEntries(new FormData(form)));
      } catch (error) {
        status.textContent=error.message;
      } finally {
        submit.disabled=false;
      }
    });
    parent.append(form);
    return {form,finish:()=>form.append(submit,status)};
  }
  function card(parent,title,description='') {
    const box=el('article',undefined,'build-card');
    box.append(el('h2',title));
    if(description) box.append(el('p',description));
    parent.append(box);
    return box;
  }
  function grid(parent) {
    const box=el('div',undefined,'build-grid');
    parent.append(box);
    return box;
  }
  function image(src,alt) {
    const n=el('img');
    n.src=src;
    n.alt=alt;
    n.loading='lazy';
    return n;
  }
  function badge(name) {
    const n=el('span',name,'hq-badge');
    n.prepend(image('images/rated420-logo.png',''));
    return n;
  }
  function decorate(anchor,username) {
    if (!username || !client()) return;
    api('profile',{username}).then(profile=>{
      if(!profile || !anchor.isConnected) return;
      const profileLink=link('@'+username,'#profile/'+encodeURIComponent(username));
      anchor.replaceChildren(profileLink,...profile.badges.map(badge));
    }).catch(()=>{});
  }

  async function discover(id) {
    const rows=await api('catalog');
    return parent=>{
      const form=el('form',undefined,'hq-filters discover-filters');
      form.addEventListener('submit',e=>e.preventDefault());
      const search=field(form,'Search listings','query',{type:'search'});
      const kind=field(form,'Category','kind',{options:[['','All categories'],...Object.entries(labels)],value:Object.hasOwn(labels,id)?id:''});
      const format=field(form,'Format from reviews','format',{options:[['','All formats'],...Array.from(new Set(rows.flatMap(r=>r.formats || []))).sort().map(v=>[v,v])]});
      const rating=field(form,'Rating status','rating',{options:[['','Any rating'],['rated','Rated'],['unrated','Unrated']]});
      const sort=field(form,'Sort by','sort',{options:[['name','A–Z'],['average','Community rating'],['count','Review count'],['created_at','Recently added']]});
      parent.append(form,link('Suggest a listing ↗','#contribute','btn btn-outline'));
      const resultCount=el('p');
      resultCount.setAttribute('role','status');
      parent.append(resultCount);
      const results=grid(parent);
      const update=()=>{
        const q=search.value.toLowerCase().trim();
        const rowsToShow=rows.filter(r=>(!kind.value || kind.value===r.kind) && (!format.value || r.formats?.includes(format.value)) &&
          (!rating.value || (rating.value==='rated')===(Number(r.count)>0)) &&
          [r.name,r.description,r.location].join(' ').toLowerCase().includes(q));
        rowsToShow.sort((a,b)=>{
          if(sort.value==='created_at') return String(b.created_at||'').localeCompare(String(a.created_at||''))||a.name.localeCompare(b.name);
          if(sort.value==='average'||sort.value==='count') return (Number(b[sort.value]??-1)-Number(a[sort.value]??-1))||a.name.localeCompare(b.name);
          return a.name.localeCompare(b.name);
        });
        resultCount.textContent=rowsToShow.length+' listings';
        results.replaceChildren();
        for(const row of rowsToShow) {
          const n=card(results,row.name,[labels[row.kind],row.location].filter(Boolean).join(' · '));
          if(row.description)n.append(el('p',row.description));
          n.append(el('p',Number(row.count) ? window.Rated420Scores.display(row.average)+' / 420 · '+row.count+' reviews':'Unrated','build-score'));
          n.append(link('View listing and scorecard ↗','#'+paths[row.kind]+'/'+row.id,'btn btn-outline'));
        }
        if(!rowsToShow.length) results.append(el('p','No matching listings. Try clearing the filters.'));
      };
      form.append(button('Reset filters',()=>{form.reset();kind.value='';update();}));
      form.addEventListener('input',update);
      update();
    };
  }

  function submissionFields(form,row={}) {
    const kind=field(form,'Category','kind',{options:Object.entries(labels),value:row.kind||'strain'});
    if (row.id) kind.disabled=true;
    field(form,'Listing name','name',{required:true,value:row.name});
    const location=field(form,'City or location','location',{value:row.location});
    const updateLocation=()=>{
      location.required=kind.value==='dispensary';
      location.disabled=!location.required;
      location.parentElement.hidden=location.disabled;
    };
    kind.addEventListener('change',updateLocation);
    updateLocation();
    field(form,'Supporting details','description',{type:'textarea',max:1500,value:row.description});
    if (!row.staff) field(form,'Supporting photo (optional)','image',{type:'file'});
  }

  async function contribute() {
    if (!member()) return parent=>parent.append(el('p','Sign in to suggest a catalog listing.'),button('Log in',login));
    const entries=await api('mine');
    return parent=>{
      parent.append(el('p','A staff member reviews each suggestion before it appears in the catalog.'));
      const edit= row=>{
        const {form,finish}=formFor(parent,row.id?'Resubmit for review':'Send for review',async values=>{
          const {image:file,...payload}=values;
          if(row.id) Object.assign(payload,{id:row.id,kind:row.kind});
          if(file?.size){
            const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
            if(!ext||file.size>5242880) throw new Error('Choose a JPG, PNG or WebP image up to 5 MB.');
            payload.photo=member().id+'/'+crypto.randomUUID()+'.'+ext;
            const {error}=await client().storage.from('catalog-submissions').upload(payload.photo,file,{contentType:file.type});
            if(error) throw new Error(error.message);
          }
          await api('submit',payload);
          await route();
        });
        submissionFields(form,row);
        finish();
      };
      edit({});
      const list=grid(parent);
      for(const row of entries) {
        const n=card(list,row.name,row.status+(row.note?' · '+row.note:''));
        if(row.status==='Needs Revision') n.append(button('Revise',()=>edit(row)));
      }
      if(!entries.length) list.append(el('p','Your submissions will appear here.'));
    };
  }

  async function library(kind) {
    const rows=await api('library',{kind});
    return parent=>{
      parent.append(el('p',kind==='merch'?'Concept merchandise · Coming soon.':'Podcast episodes and final results from closed community polls.','build-lede'));
      if(kind==='episode') parent.append(link('Back to Vault polls ↗','#vault','btn btn-outline'));
      const list=grid(parent);
      for(const row of rows) {
        const n=card(list,row.title,row.description);
        if(art[row.image]) n.prepend(image(art[row.image],kind==='merch'?row.title+' concept illustration':'Rated420 podcast artwork'));
        if(row.release_date) n.append(el('p',row.release_date));
        if(row.url) n.append(link('Watch on YouTube (online) ↗',row.url,'btn btn-outline'));
        if(row.recap){
          const total=row.recap.options.reduce((sum,o)=>sum+Number(o.votes),0);
          const recap=el('details');
          recap.append(el('summary','Final poll recap · '+total+' votes'),el('p',row.recap.question));
          const results=el('ul');
          for(const option of row.recap.options)results.append(el('li',option.label+' · '+option.votes+' votes'));
          recap.append(results);
          n.append(recap);
        }
      }
      if(!rows.length) list.append(el('p',kind==='merch'?'There are no concepts on display yet.':'There are no published episodes yet.'));
    };
  }

  async function profile(id) {
    const username=decodeURIComponent(id||'');
    const data=await api('profile',{username});
    return parent=>{
      if(!data){parent.append(el('p','This member has no public profile.'));return;}
      const identity=el('header',undefined,'profile-identity');
      const copy=el('div',undefined,'profile-identity-copy');
      copy.append(el('h2','@'+data.username));
      identity.append(window.Rated420Avatar.create({name:data.username,src:avatarImage(data.avatar_choice)},'large'),copy);
      parent.append(identity);
      const n=card(parent,'Contributor recognition');
      if(!data.badges.length)n.append(el('p','No recognition earned yet.'));
      else n.append(...data.badges.map(badge));
    };
  }

  function table(parent,headers,rows) {
    const wrap=el('div',undefined,'hq-table');
    const t=el('table');
    const head=el('thead');
    const body=el('tbody');
    const header=el('tr');
    headers.forEach(h=>{const cell=el('th',h);cell.scope='col';header.append(cell);});
    head.append(header);
    for(const row of rows){const tr=el('tr');row.forEach(x=>tr.append(el('td',String(x))));body.append(tr);}
    t.append(head,body);wrap.append(t);parent.append(wrap);
  }

  async function analytics(parent,days=30) {
    const a=await api('analytics',{days});
    const inner=el('div');
    const controls=el('div',undefined,'hq-filters');
    const select=field(controls,'Activity period','days',{options:[7,30,90].map(d=>[String(d),'Last '+d+' days']),value:String(days)});
    const refresh=async()=>{
      select.disabled=true;
      try {await analytics(parent,Number(select.value));}
      catch(error){inner.append(el('p',error.message));select.disabled=false;}
    };
    select.addEventListener('change',refresh);
    inner.append(controls);
    const metrics=grid(inner);
    const total=Object.values(a.catalog).reduce((s,n)=>s+Number(n),0);
    const values=[['Accounts',a.accounts],['Published catalog',total],['Published reviews',a.reviews],
      ['Reviews in period',a.periodReviews],['Pending submissions',a.submissions.Pending??0],['Approved submissions',a.submissions.Approved??0],
      ['Active polls',a.activePolls],['Closed polls',a.closedPolls],['Votes',a.votes],['Unique voters',a.participants]];
    for (const [name,value] of values) card(metrics,name,String(value));
    inner.append(el('h2','Catalog by category'));
    table(inner,['Category','Listings'],Object.entries(labels).map(([k,v])=>[v,a.catalog[k]??0]));
    inner.append(el('h2','Strain review formats'));
    if(Object.keys(a.formats).length)table(inner,['Format','Reviews'],Object.entries(a.formats));
    else inner.append(el('p','No format activity recorded.'));
    inner.append(el('h2','Dated poll activity'));
    if(a.unknownVoteDates||a.unknownReviewDates) inner.append(el('p',a.unknownVoteDates+' votes and '+a.unknownReviewDates+' reviews have no recorded activity date.'));
    if(a.trend.length){
      const max=Math.max(...a.trend.map(d=>Number(d.votes)));
      for(const d of a.trend){const label=el('label',d.day+' · '+d.votes+' votes','hq-meter');const meter=el('meter');meter.max=max;meter.value=d.votes;meter.setAttribute('aria-label',label.textContent);label.append(meter);inner.append(label);}
    } else inner.append(el('p','No dated votes in this period.'));
    inner.append(el('h2','Contributor rankings · Lifetime'));
    const rank=el('div');
    const order=field(inner,'Rank by','metric',{options:[['score','Overall'],['reviews','Reviews'],['contributions','Approved new listings'],['polls','Distinct polls']]});
    const show=()=>{
      const key=order.value;
      const rows=[...a.rankings].filter(r=>Number(r[key])>0).sort((x,y)=>Number(y[key])-Number(x[key])||x.username.localeCompare(y.username));
      rank.replaceChildren();
      let place=0;
      if(rows.length) table(rank,['Rank','Member','Reviews','New listings','Polls','Overall'],rows.map((r,i)=>{
        if(!i||Number(rows[i-1][key])!==Number(r[key]))place=i+1;
        return [place,'@'+r.username,r.reviews,r.contributions,r.polls,r.score];
      }));
      else rank.append(el('p','No eligible contributors yet.'));
    };
    order.addEventListener('change',show);
    inner.append(rank);
    show();
    parent.replaceChildren(inner);
  }

  function managementForm(parent,caption,row,kind,polls) {
    const {form,finish}=formFor(parent,caption,async values=>{
      await api('library_save',{...values,...(row.id?{id:row.id}:{}),kind});
      await route();
    });
    field(form,'Title','title',{value:row.title,required:true});
    field(form,'Description','description',{value:row.description,type:'textarea',max:1500});
    field(form,'Artwork','image',{value:row.image,options:kind==='episode'?[['','None'],['artwork','Vault artwork']]:[['','None'],...Object.keys(art).filter(x=>x!=='artwork').map(x=>[x,x])]});
    if(kind==='episode'){
      field(form,'YouTube video URL','url',{value:row.url,type:'url',max:200});
      field(form,'Release date','release_date',{value:row.release_date,type:'date'});
      field(form,'Closed poll recap','poll',{value:row.poll,options:[['','None'],...polls.filter(p=>p.closed).map(p=>[p.id,p.question])]});
    }
    field(form,'Order','position',{value:row.position??0,type:'number',required:true});
    field(form,'Visibility','published',{value:String(Boolean(row.published)),options:[['false','Hidden'],['true','Published']]});
    finish();
  }

  function submission(row,container){
        const detail=el('details',undefined,'build-card');
        detail.append(el('summary',row.name+' · '+row.status));
        container.append(detail);
        if(row.note)detail.append(el('p',row.note));
        if(row.photo)detail.append(button('Open supporting photo',async event=>{
          const target=event.currentTarget;
          const {data,error}=await client().storage.from('catalog-submissions').createSignedUrl(row.photo,60);
          target.after(error?el('p',error.message):image(data.signedUrl,'Private supporting photo'));
        }));
        if(['Approved','Rejected'].includes(row.status))return;
        const {form,finish}=formFor(detail,'Record decision',async values=>{await api('moderate',{...values,id:row.id});await route();});
        submissionFields(form,{...row,staff:true});
        field(form,'Status','status',{options:[['Approved','Approve'],['Needs Revision','Needs Revision'],['Rejected','Reject']]});
        field(form,'Existing listing ID (optional)','listing');
        field(form,'Private decision note','note',{type:'textarea',max:1500});
        finish();
      }

  function mountFounderHQ(parent,render,{role,founder,active}){
    const wide=matchMedia('(min-width:1000px)');
    const frame=el('div',undefined,'founder-unified');
    const header=el('div',undefined,'founder-unified-header');
    const nav=el('nav',undefined,'founder-unified-nav');nav.id='founder-hq-navigation';
    nav.setAttribute('aria-label','Founder HQ areas');
    const main=el('div',undefined,'founder-unified-content');
    const context=el('p',undefined,'founder-unified-context');
    const settings=el('div');
    const toggle=button('Founder HQ navigation',()=>setOpen(nav.hidden));
    toggle.className='btn btn-outline';
    toggle.setAttribute('aria-controls',nav.id);
    const setOpen=open=>{
      nav.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
      frame.classList.toggle('nav-open',open);
    };
    header.append(context,toggle);
    const tools=(...rows)=>founder?rows:[];
    const groups=[
      ['Today',[['#hq','Overview'],['#hq/submissions','Submissions'],...tools(['#hq/gary/tasks','Founder tasks'],['#hq/gary/activity','Recent activity'])]],
      ['Relationships',tools(['#hq/gary/organizations','Industry directory'],['#hq/gary/contacts','Contacts and relationships'],
        ['#hq/gary/threads','Correspondence'],['#hq/gary/campaigns','Outreach campaigns'],['#hq/gary/opportunities','Business development'])],
      ['Intelligence',[['#hq/catalog','Community catalogue'],['#hq/analytics','Analytics'],['#hq/intelligence','Data Intelligence Center'],
        ...tools(['#hq/catalogue','Catalogue Manager'],['#hq/gary/products','Product intelligence'],['#hq/gary/territory','Territory Explorer'],['#hq/gary/integrations','Data integrations'])]],
      ['Operations',[['#hq/polls','Polls'],['#hq/episodes','Episodes'],['#hq/showroom','Showroom'],
        ...tools(['#hq/content','Editorial content'],['#hq/gary/production','Production planning'],['#hq/gary/documents','Documents'],['#hq/gary/finance','Financial Command Center']),
        ...(role==='administrator'?[['#hq/access','Staff access']]:[])]]
    ];
    const entries=[];
    for(const [label,destinations] of groups){
      const disclosure=el('details');
      disclosure.append(el('summary',label));
      for(const [url,name] of destinations){
        const item=link(name,url);entries.push({url,label,name,item,disclosure});disclosure.append(item);
      }
      if(!destinations.length)disclosure.append(el('p','Relationship tools require founder or administrator access.'));
      disclosure.querySelector('summary').addEventListener('click',()=>{
        if(!disclosure.open)for(const other of nav.querySelectorAll('details[open]'))if(other!==disclosure&&!settings.contains(other))other.open=false;
      });
      nav.append(disclosure);
    }
    nav.append(settings);
    const returnLink=link('Return to Founder HQ','#hq','btn btn-tertiary');header.append(returnLink);
    function select(path){
      if(path==='#hq/gary'||path==='#hq/overview')path='#hq';
      const current=entries.filter(({url})=>path===url||path.startsWith(url+'/')).sort((a,b)=>b.url.length-a.url.length)[0]||entries[0];
      for(const row of entries){
        if(row===current)row.item.setAttribute('aria-current','page');else row.item.removeAttribute('aria-current');
        if(row.disclosure!==current.disclosure)row.disclosure.open=false;
      }
      current.disclosure.open=true;
      context.textContent=current.label+' · '+current.name;
      returnLink.hidden=current.url==='#hq';
    }
    nav.addEventListener('click',event=>{if(event.target.closest('a')&&!wide.matches)setOpen(false);});
    frame.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!nav.hidden){setOpen(false);toggle.focus();}
    });
    frame.append(header,nav,main);parent.append(frame);
    select(active);setOpen(wide.matches);
    render(main,{settings,select});
  }

  async function hq(section, subview, recordId, returnTo) {
    const founder=section==='gary', intelligence=section==='intelligence', editorial=section==='content', catalogManager=section==='catalogue';
    const initial=subview&&decodeURIComponent(subview);
    const complete=Boolean(window.RatedComplete);
    const role=await api('role');
    if(!member()||role==='member')return parent=>parent.append(el('p','Rated420 HQ is available to authorized staff.'),...(!member()?[button('Log in',login)]:[]));
    const identity=member().id;
    const canEnterWorkspace=()=>!window.RatedComplete || window.RatedComplete.founder() || role==='administrator';
    const assertAccess=async()=>{
      if(!canEnterWorkspace()||member()?.id!==identity||!['staff','administrator'].includes(await api('role'))||member()?.id!==identity)
        throw Error('Sign in as authorized staff to change this workspace.');
    };
    const shell=render=>complete?parent=>mountFounderHQ(parent,render,{role,founder:canEnterWorkspace(),active:location.hash||'#hq'}):render;
    const createProspect=(id,org)=>window.GaryStore.openStore(assertAccess).dispatch('official-prospect',{record:id,org},window.GaryStore.founders[0]);
    const backToHQ=parent=>parent.append(link('Back to Rated420 HQ','#hq','btn btn-tertiary'));
    if(catalogManager&&window.Rated420CatalogueUI)return shell(parent=>{
      if(!canEnterWorkspace()){parent.append(el('p','Catalogue management is available to founders and administrators.'));return;}
      if(!complete)backToHQ(parent);
      window.Rated420CatalogueUI.manager(parent,{guard:assertAccess,actor:identity,initial});
    });
    if(editorial&&window.Rated420Editorial)return shell(parent=>{
      if(!canEnterWorkspace()){parent.append(el('p','Editorial editing is available to founders and administrators.'));return;}
      if(!complete)backToHQ(parent);
      window.Rated420Editorial.mountHQ(parent,assertAccess);
    });
    if(intelligence&&window.Rated420IntelligenceUI)return shell(parent=>{
      if(!complete)backToHQ(parent);
      window.Rated420IntelligenceUI.mount(parent,{guard:assertAccess,writable:canEnterWorkspace(),initial,recordId,
        hq:canEnterWorkspace()?()=>window.GaryStore.openStore().read():undefined,create:createProspect});
    });
    const gary=window.mountGaryPreview && ['staff','administrator'].includes(role) && canEnterWorkspace();
    if(founder && window.RatedComplete && !gary)return parent=>parent.append(el('p','The founder workspace is available to founders and administrators.'));
    if(complete&&gary&&(founder||!section||section==='overview')){
      const landing=!initial||initial==='dashboard';
      const pending=landing?(await api('queue')).filter(row=>!['Approved','Rejected'].includes(row.status)):[];
      return shell((parent,workspace)=>{
        if(initial==='finance'||initial==='territory'){
          window.mountRatedExpansion(parent,initial==='finance'?'finance':'market',{guard:assertAccess,hq:()=>window.GaryStore.openStore().read(),createProspect});
          return;
        }
        window.mountGaryPreview(parent,{initial,initialRecord:recordId,backToTerritory:returnTo==='territory',assertAccess,workspace,
          attention:landing?container=>{
            if(!pending.length)return;
            const queue=el('section',undefined,'build-card ops-queue');
            queue.append(el('h3','Pending submissions'));
            for(const row of pending.slice(0,3))submission(row,queue);
            queue.append(link('View all submissions','#hq/submissions','btn btn-tertiary'));
            container.append(queue);
          }:null});
      });
    }
    if(founder&&gary&&!complete)return parent=>{
      if(!complete)backToHQ(parent);
      if(window.mountRatedExpansion&&(!complete||initial==='finance'||initial==='territory')){
        const controls=el('nav',undefined,'build-actions');
        controls.setAttribute('aria-label','Founder workspaces');
        for(const [hash,label] of [['#hq','Back to Rated420 HQ'],['#hq/gary','Founder workspace'],['#hq/gary/finance','Financial Command Center'],['#hq/gary/territory','Territory Explorer']]){
          const link=el('a',label,'btn btn-outline');link.href=hash;if(hash===(initial==='finance'||initial==='territory'?'#hq/gary/'+initial:'#hq/gary'))link.setAttribute('aria-current','page');controls.append(link);
        }
        if(window.Rated420IntelligenceUI){const link=el('a','Data Intelligence Center','btn btn-outline');link.href='#hq/intelligence';controls.append(link);}
        if(window.Rated420Editorial){const link=el('a','Editorial content','btn btn-outline');link.href='#hq/content';controls.append(link);}
        if(window.Rated420CatalogueUI){const link=el('a','Catalogue Manager','btn btn-outline');link.href='#hq/catalogue';controls.append(link);}
        parent.append(controls);
        if(initial==='finance'||initial==='territory'){
          const content=el('section');parent.append(content);
          window.Rated420UX?.workspace(controls,content,'HQ workspaces');
          window.mountRatedExpansion(content,initial==='finance'?'finance':'market',{guard:assertAccess,hq:()=>window.GaryStore.openStore().read(),createProspect});return;
        }
      }
      window.mountGaryPreview(parent,{initial,initialRecord:recordId,backToTerritory:returnTo==='territory',assertAccess});
    };
    if(role!=='administrator'&&activeTab==='Access')activeTab='Submissions';
    const sections=complete?['Overview',...tabs]:tabs;
    const selected=sections.find(tab=>tab.toLowerCase()===section)||(complete?'Overview':activeTab);
    const current=selected==='Access'&&role!=='administrator'?'Submissions':selected;
    let data;
    if(current==='Submissions'||current==='Overview')data=await api('queue');
    if(current==='Catalog')data=await api('manage_catalog');
    if(current==='Polls')data=await api('polls',{},'rated420_build01');
    if(current==='Episodes'||current==='Showroom')data=await Promise.all([
      api('library',{kind:current==='Episodes'?'episode':'merch',manage:true}),api('polls',{},'rated420_build01')
    ]);
    return shell(parent=>{
      const content=el('section');
      if(!complete){
      const nav=el(window.Rated420UX?'nav':'div',undefined,'build-actions');
      nav.setAttribute('aria-label','HQ administration');
      const controls={};
      for(const tab of sections.filter(t=>t!=='Access'||role==='administrator')){
        const b=button(tab,()=>{
          if(complete){const hash=tab==='Overview'?'#hq':'#hq/'+tab.toLowerCase();if(location.hash!==hash)location.hash=hash;return;}
          activeTab=tab;void route();
        });b.setAttribute('aria-pressed',String(tab===current));controls[tab]=b;
      }
      if(gary){const link=el('a','Founder workspace','btn btn-outline');link.href='#hq/gary';controls.Founder=link;}
      if(window.Rated420IntelligenceUI){const link=el('a','Data Intelligence Center','btn btn-outline');link.href='#hq/intelligence';controls.Intelligence=link;}
      if(window.Rated420Editorial&&canEnterWorkspace()){const link=el('a','Editorial content','btn btn-outline');link.href='#hq/content';controls.Editorial=link;}
      if(window.Rated420CatalogueUI&&canEnterWorkspace()){const link=el('a','Catalogue Manager','btn btn-outline');link.href='#hq/catalogue';controls.Manager=link;}
      if(window.Rated420UX){
        const set=(title,items)=>[title,items.map(key=>controls[key]).filter(Boolean)];
        window.Rated420UX.sections(nav,[set('Work queue',['Overview','Submissions','Catalog','Manager']),set('Publishing',['Polls','Episodes','Showroom','Editorial']),
          set('Analysis and access',['Analytics','Intelligence','Access']),set('Founder',['Founder'])]);
      }else nav.append(...Object.values(controls));
      parent.append(nav);
      parent.append(content);
      window.Rated420UX?.workspace(nav,content,'Administration');
      }else parent.append(content);
      if(current==='Analytics'){
        void analytics(content).catch(error=>content.append(el('p',error.message)));return;
      }
      if(current==='Overview'){
        const pending=data.filter(row=>!['Approved','Rejected'].includes(row.status));
        const primary=el('section',undefined,'build-card ops-queue');
        primary.append(el('h2','Needs attention'),el('p',pending.length+' outstanding '+(pending.length===1?'submission':'submissions')));
        for(const row of pending.slice(0,3))submission(row,primary);
        primary.append(link('View all submissions','#hq/submissions','btn btn-tertiary'));
        const work=el('section',undefined,'build-card ops-queue');work.append(el('h2','What to do next'));
        const catalogue=canEnterWorkspace()?window.Rated420Catalogue?.read():null;
        if(catalogue){
          const proposals=catalogue.proposals.filter(row=>row.state==='Pending review').length;
          const drafts=catalogue.records.filter(row=>row.state==='Draft').length;
          const openTasks=window.GaryStore?.openStore().read().tasks.filter(task=>!task.done).length;
          if(openTasks!=null)work.append(link(openTasks+' open founder tasks','#hq/gary/tasks','btn btn-tertiary'));
          work.append(link(proposals+' business proposals to review','#hq/catalogue/proposals','btn btn-tertiary'),
            link(drafts+' catalogue drafts','#hq/catalogue/records','btn btn-tertiary'));
        }
        const intelligence=window.Rated420Intelligence;
        if(intelligence){
          const batches=intelligence.read().batches.filter(batch=>!batch.revertedAt);
          const recent=batches.at(-1);
          const exceptions=batches.reduce((count,batch)=>count+batch.skipped,0);
          work.append(link(exceptions+' rejected or skipped import rows','#hq/intelligence/history','btn btn-tertiary'),
            link('OCM snapshot · retrieved '+intelligence.snapshot.retrievedOn,'#hq/intelligence/sources','btn btn-tertiary'));
          const changes=el('details',undefined,'build-card ops-queue');changes.append(el('summary','Recent changes'),
            el('p',recent?'Last applied import · '+recent.label:'No local imports applied.'));
          for(const item of (catalogue?.history||[]).slice(0,3)){
            const record=catalogue.records.find(row=>row.id===item.target);
            changes.append(el('p',item.action+' · '+(record?.name||item.at.slice(0,10))));
          }
          content.classList.add('hq-desk');content.append(primary,work,changes);
        }else content.append(primary,work);
        return;
      }
      if(current==='Submissions'){
        if(!data.length)content.append(el('p','No submissions to review.'));
        for(const row of data)submission(row,content);
      } else if(current==='Catalog'){
        for(const row of data){
          const detail=el('details',undefined,'build-card');
          detail.append(el('summary',row.name+' · '+row.kind+' · '+row.id+(row.archived?' · Archived':'')));
          const {form,finish}=formFor(detail,'Save listing',async v=>{await api('catalog_edit',{...v,id:row.id,kind:row.kind});await route();});
          submissionFields(form,{...row,staff:true});
          field(form,'Visibility in discovery','archived',{options:[['false','Listed'],['true','Archived']],value:String(row.archived)});
          finish();content.append(detail);
        }
      } else if(current==='Polls'){
        const {form,finish}=formFor(content,'Publish poll',async v=>{
          await api('publish',{question:v.question,options:[v.first,v.second]},'rated420_build01');await route();
        });
        field(form,'Question','question',{required:true,max:160});
        field(form,'First option','first',{required:true,max:80});
        field(form,'Second option','second',{required:true,max:80});
        finish();
        for(const poll of data.polls){
          const n=card(content,poll.question,poll.closed?'Closed':'Voting open');
          if(!poll.closed){
            const {finish}=formFor(n,'Close voting',async()=>{await api('close',{id:poll.id},'rated420_build01');await route();});finish();
          }
        }
      } else if(current==='Access'){
        content.append(el('p','Use the verified Auth user ID for staff assignment. Administrator assignment is operator-managed.'));
        const {form,finish}=formFor(content,'Save staff access',async v=>{await api('staff_role',v);await route();});
        field(form,'Auth user ID','id',{required:true,max:36});
        field(form,'Access','status',{options:[['staff','Staff'],['member','Member']]});
        finish();
      } else {
        const kind=current==='Episodes'?'episode':'merch';
        managementForm(content,'Create entry',{},kind,data[1].polls);
        for(const row of data[0]){
          const detail=el('details',undefined,'build-card');
          detail.append(el('summary',row.title+(row.published?' · Published':' · Hidden')));
          managementForm(detail,'Save entry',row,kind,data[1].polls);content.append(detail);
        }
      }
    });
  }

  async function route() {
    const hash=location.hash;
    const [view,id,subview,recordId,returnTo]=hash.slice(1).split('/');
    if(!Object.hasOwn(headings,view)||!client())return false;
    const token=++request;
    page('hq');
    heading.textContent=view==='hq'&&window.RatedComplete?'Rated420 Founder HQ':headings[view];
    heading.focus({preventScroll:true});
    area.textContent='Loading…';
    try {
      const render=await ({discover:()=>discover(id),contribute,hq:()=>hq(id,subview,recordId,returnTo),shop:()=>library('merch'),episodes:()=>library('episode'),profile:()=>profile(id)})[view]();
      if(token===request&&location.hash===hash){area.replaceChildren();render(area);}
    } catch(error){
      if(token===request&&location.hash===hash){area.textContent=error.message;area.append(button('Try again',route));}
    }
    return true;
  }
  return {route,decorate};
};
