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
  const browse=document.querySelector('.home-catalogue h2');
  if(browse){
    const trail=make('div',null,'build-actions home-editorial-links');
    trail.append(link('Browse the full catalogue','#catalogue'));
    browse.after(trail);
  }
  nav.append(...[['Home','#home'],['About','#about'],['Discover','#discover'],['Business directory','#businesses'],
    ['Community reviews','#demo-reviews'],['Episodes','#episodes'],['The Vault','#vault'],['The Shop','#shop'],['Contact','#contact']]
    .map(([text,hash])=>link(text,hash)));
  document.querySelector('.header-inner').parentNode.after(nav);
  document.getElementById('authPage').prepend(make('p','Offline accounts only. Use an @example.test address and password demo-only-420. No email is sent.','complete-note'));
  document.addEventListener('click',event=>{
    const anchor=event.target.closest('a[href]');
    if(anchor?.closest('#contactPage')&&anchor.protocol==='mailto:')return;
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
  const contact=document.getElementById('contactPage');
  contact.classList.add('contact-email-page');
  document.getElementById('contactTitle').textContent='Contact Rated420';
  contact.querySelector('.contact-heading > p:last-child').textContent='Have a question, a correction, or a podcast invitation? Get in touch with the Rated420 team.';
  contact.querySelector('.build-card h2').remove();
  contact.querySelector('.build-card p').remove();

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
          document.createTextNode(rating?' '+window.Rated420Scores.display(rating.avg_total)+' / 420 · '+rating.review_count+' reviewers':' No ratings yet'));
        card.append(row);
      }
      if(entity.kind==='Brand')card.append(link('Brand scorecard','#brands/'+entity.id));
      if(entity.listing){
        const rating=shops.find(s=>s.dispensary_id===entity.listing);
        card.append(link('Dispensary listing and reviews','#dispensaries/'+entity.listing));
        if(rating)card.append(make('p',window.Rated420Scores.display(rating.avg_total)+' / 420 · '+rating.review_count+' dispensary reviewers'));
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
