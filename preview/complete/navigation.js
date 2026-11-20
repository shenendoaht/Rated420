(() => {
  'use strict';
  const demo=window.RatedComplete;
  const make=(tag,text,cls)=>{
    const node=document.createElement(tag);
    if(text)node.textContent=text;
    if(cls)node.className=cls;
    return node;
  };
  const link=(text,hash)=>{const a=make('a',text,'btn btn-outline');a.href=hash;return a;};
  const nav=make('nav',null,'page-width complete-nav');
  nav.setAttribute('aria-label','Offline ecosystem navigation');
  nav.append(...[['Home','#home'],['About','#about'],['Discover','#discover'],['Business directory','#businesses'],
    ['Community reviews','#demo-reviews'],['Episodes','#episodes'],['The Vault','#vault'],['The Shop','#shop'],['Contact','#contact']]
    .map(([text,hash])=>link(text,hash)));
  document.querySelector('.header-inner').parentNode.after(nav);
  document.getElementById('authPage').prepend(make('p','Offline accounts only. Use an @example.test address and password demo-only-420. No email is sent.','complete-note'));
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href]');
    if(!anchor||anchor.dataset.officialOnline||!/^https?:|^mailto:/i.test(anchor.getAttribute('href')))return;
    event.preventDefault();
    const dialog=make('dialog',null,'complete-dialog');
    dialog.append(make('h2','Internet required'),make('p','This destination is available outside the offline preview.'),make('p',anchor.href));
    const close=make('button','Close','btn btn-outline');
    close.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    if(anchor.dataset.editorialExternal||['https://data.ny.gov','https://cannabis.ny.gov'].includes(new URL(anchor.href).origin)){
      const external=make('a',anchor.dataset.editorialExternal?'Open manufacturer site online':'Open official source online','btn btn-outline');
      external.href=anchor.href;external.target='_blank';external.rel='noopener noreferrer';
      external.dataset.officialOnline='true';dialog.append(external);
    }
    dialog.append(close);document.body.append(dialog);dialog.showModal();
  });
  const contact=make('form',null,'build-card build-form');
  contact.append(make('h2','Send a demo inquiry'));
  for(const [name,title,type] of [['sender','Name','text'],['topic','Topic','text'],['body','Message','textarea']]){
    const label=make('label',title);
    const field=make(type==='textarea'?'textarea':'input');
    if(type!=='textarea')field.type=type;
    field.name=name;field.required=true;field.maxLength=type==='textarea'?1500:100;label.append(field);contact.append(label);
  }
  const submit=make('button','Save demo inquiry','btn btn-primary');submit.type='submit';
  const result=make('p');result.setAttribute('role','status');
  contact.append(submit,result);
  contact.addEventListener('submit',event=>{
    event.preventDefault();
    const fields=Object.fromEntries(new FormData(contact));
    try{
      const key='rated420-complete-contact-v1';
      const saved=JSON.parse(localStorage.getItem(key)||'[]');
      saved.unshift({...fields,id:crypto.randomUUID(),at:new Date().toISOString()});
      localStorage.setItem(key,JSON.stringify(saved.slice(0,30)));
      contact.reset();result.textContent='Demo inquiry saved in this browser. No email was sent.';
    }catch{result.textContent='This browser could not save the inquiry.';}
  });
  document.getElementById('contactPage').append(contact);

  demo.renderBusiness=async(host,id,{privateView=false}={})=>{
    const content=make('div');
    host.append(content);
    const intelligence=window.Rated420IntelligenceUI;
    const licensed=id&&window.Rated420Intelligence?.record(id);
    if(licensed&&!privateView){
      content.append(link('Back to businesses','#businesses'));
      intelligence.businessDetails(content,licensed);
      return;
    }
    const client=window.supabase.createClient();
    const entities=id?demo.entities.filter(item=>item.id===id):demo.entities;
    if(!entities.length){content.append(make('p','Business not found.'));return;}
    const [{data:products},{data:stats},{data:shops}]=await Promise.all([
      client.from('strains').select('id,name'),client.from('strain_community_stats').select('*'),
      client.from('dispensary_community_stats').select('*')
    ]);
    if(!content.isConnected)return;
    if(privateView&&window.Rated420UX){
      const nav=make('nav');nav.setAttribute('aria-label','Business tools');
      const overview=link('Dashboard overview','#business-account');overview.setAttribute('aria-current','page');
      nav.append(overview,link('View public business profile','#businesses/'+id),link('Suggest or track a listing','#contribute'));
      if(window.Rated420CatalogueUI)nav.append(link('Propose catalogue edits','#business-catalogue'));
      host.insertBefore(nav,content);
      window.Rated420UX.workspace(nav,content,'Business');
    }else if(id)content.append(link('Back to businesses','#businesses'));
    const grid=make('div',null,'build-grid');content.append(grid);
    for(const entity of entities){
      const card=make('article',null,'build-card');
      card.append(make('h2',entity.name),make('p',entity.kind+' · Synthetic New York business'));
      if(!id){card.append(link('View '+entity.name,'#businesses/'+entity.id));grid.append(card);continue;}
      for(const product of products.filter(p=>entity.products.includes(p.id))){
        const rating=stats.find(row=>row.strain_id===product.id&&row.product_type===null);
        const row=make('p');
        row.append(link(product.name,'#strains/'+product.id),
          document.createTextNode(rating?' '+Math.round(rating.avg_total)+' / 420 · '+rating.review_count+' reviewers':' No ratings yet'));
        card.append(row);
      }
      if(entity.kind==='Brand')card.append(link('Brand scorecard','#brands/'+entity.id));
      if(entity.listing){
        const rating=shops.find(s=>s.dispensary_id===entity.listing);
        card.append(link('Dispensary listing and reviews','#dispensaries/'+entity.listing));
        if(rating)card.append(make('p',Math.round(rating.avg_total)+' / 420 · '+rating.review_count+' dispensary reviewers'));
      }
      if(privateView){
        card.append(make('h3','Business dashboard'),make('p','You represent this organization. Listing suggestions go to the moderation queue.'));
        if(!window.Rated420UX)card.append(link('Suggest or track a listing','#contribute'));
      }
      grid.append(card);
    }
    if(!id){
      if(window.Rated420CatalogueUI)content.append(link('Browse curated dispensary profiles','#catalogue/dispensary'));
      intelligence?.directory(content);
    }
  };
})();
