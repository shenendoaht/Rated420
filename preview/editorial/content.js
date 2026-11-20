(() => {
  'use strict';
  const store=window.Rated420EditorialStore;
  const el=(tag,text,cls)=>{
    const node=document.createElement(tag);
    if(text!==null&&text!==undefined)node.textContent=text;
    if(cls)node.className=cls;
    return node;
  };
  const link=(text,url,cls='btn btn-outline')=>{const a=el('a',text,cls);a.href=url;return a;};
  const button=(text,fn)=>{const b=el('button',text,'btn btn-outline');b.type='button';b.addEventListener('click',fn);return b;};
  function photo(src,alt,cls,fallback){
    const container=el('div',null,cls);
    if(src){const img=el('img');img.src=src;img.alt=alt;img.loading='lazy';container.append(img);}
    else container.append(el('p',fallback));
    return container;
  }
  function renderAccessories(parent){
    const section=el('section',null,'editorial-showcase');
    section.append(el('p','A short list of real products with direct manufacturer links. Check each manufacturer for current product details.','build-lede'));
    const grid=el('div',null,'build-grid editorial-products');
    for(const row of store.read().products.filter(item=>item.published)){
      const card=el('article',null,'build-card editorial-product');
      const destination=link('View at '+row.manufacturer,row.url);
      destination.dataset.editorialExternal='true';
      card.append(photo(row.image,row.name,'editorial-product-photo','Approved product image pending'),
        el('p',row.manufacturer+' · '+row.category,'editorial-meta'),el('h2',row.name),el('p',row.description),
        el('p',row.checked?'Manufacturer listing checked '+row.checked:'Browser-local catalog entry','editorial-meta'),
        el('p',row.placement+(row.disclosure?' · '+row.disclosure:''),'editorial-disclosure'),destination);
      grid.append(card);
    }
    if(!grid.childElementCount)grid.append(el('p','No accessories are currently featured.'));
    section.append(grid);
    parent.append(section,el('h2','Existing community accessory ratings'));
  }

  function renderTeam(parent){
    const state=store.read();
    const intro=el('section',null,'build-card editorial-story');
    const story=el('div');
    story.append(el('h2','The Rated420 story'),el('p',state.story));
    const group=el('figure',null,'editorial-group');
    group.append(photo(state.group.image,state.group.caption||'Rated420 group photograph','editorial-group-photo','Approved group photograph pending'));
    if(state.group.caption)group.append(el('figcaption',state.group.caption));
    intro.append(story,group);
    const list=el('div',null,'build-grid editorial-team');
    state.team.forEach((person,i)=>{
      const name=person.name||'Team member '+(i+1);
      const card=el('article',null,'build-card');
      const bio=el('details',null,'editorial-bio');
      bio.append(el('summary','Biography and responsibilities'));
      if(person.responsibilities)bio.append(el('p',person.responsibilities));
      bio.append(el('p',person.bio||'Founder-approved biography pending.'));
      card.append(el('h2',name),el('p',person.title||'Title pending founder confirmation.','editorial-meta'),
        photo(person.image,name,'editorial-portrait','Approved portrait pending'),bio);
      list.append(card);
    });
    parent.append(intro,list);
  }
  function renderStandard(){
    if(!document.getElementById('how-it-works'))return;
    document.querySelector('.hero .score-ticket')?.remove();
    document.querySelector('.hero-buttons a[href="#how-it-works"]')?.remove();
    for(const icon of document.querySelectorAll('#how-it-works .step-icon'))icon.remove();
    const card=el('section',null,'editorial-standard build-card');
    card.setAttribute('aria-labelledby','editorial-standard-title');
    const title=el('h3','The 420 Standard');title.id='editorial-standard-title';
    const formula=el('p',null,'editorial-formula');
    formula.setAttribute('role','math');
    formula.setAttribute('aria-label','Score equals R plus three C plus P');
    for(const [tag,text] of [['span','SCORE'],['span','='],['var','R'],['span','+'],['span','3C'],['span','+'],['var','P']]){
      const part=text==='3C'?el('span','3'):el(tag,text);
      if(text==='3C')part.append(el('var','C'));
      part.setAttribute('aria-hidden','true');formula.append(part);
    }
    const list=el('dl');
    for(const [symbol,definition] of [
      ['R','Distinct review units. A strain and format pair, a dispensary, or a brand or accessory listing counts once per reviewer.'],
      ['C','Approved contributions that created a new, unarchived catalog listing.'],
      ['P','Recorded Vault poll votes.']
    ])list.append(el('dt',symbol),el('dd',definition));
    card.append(title,el('p',"Ratings and reviews can't be bought.",'editorial-statement'),
      el('p','Advertising, sponsorships, affiliate links, and manufacturer partnerships do not influence Rated420 ratings or reviews.'),
      formula,el('p','This contributor-recognition score rewards review activity, catalog contributions, and poll participation. Product scorecards still use five categories worth 84 points each.'),list);
    document.getElementById('how-it-works').append(card);
  }
  function field(form,caption,name,value='',type='text'){
    const label=el('label',caption);
    const input=el(type==='textarea'?'textarea':'input');
    if(type!=='textarea')input.type=type;
    input.name=name;
    if(type==='checkbox')input.checked=Boolean(value);
    else if(type!=='file')input.value=value||'';
    label.append(input);form.append(label);
    return input;
  }
  async function imageInput(form,values){
    const file=form.elements.image.files[0];
    if(file){
      if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>200000)throw Error('Choose a JPG, PNG, or WebP under 200 KB.');
      values.image=await new Promise((resolve,reject)=>{
        const reader=new FileReader();
        reader.addEventListener('load',()=>resolve(reader.result));
        reader.addEventListener('error',()=>reject(Error('Could not read the image.')));
        reader.readAsDataURL(file);
      });
      const preview=new Image();preview.src=values.image;
      try{await preview.decode();}catch{throw Error('The approved image file could not be decoded.');}
    }else values.image='';
    values.removeImage=form.elements.removeImage.checked;
    return values;
  }
  function mountHQ(parent,guard){
    const service=store.session(guard);
    let section='Accessories';
    const status=el('p');status.setAttribute('role','status');
    const content=el('div');
    const nav=el('nav',null,'build-actions');nav.setAttribute('aria-label','Editorial content sections');
    parent.append(el('h2','Editorial content'),el('p','Browser-local preview. Product listings and paid placements are separate from community ratings.'),nav,status,content);
    function editCard(title,row,fields,save){
      const wrapper=el('details',null,'build-card editorial-edit');
      wrapper.append(el('summary',title));
      const form=el('form',null,'build-form');
      for(const [caption,key,type] of fields)field(form,caption,key,row[key],type);
      if(save==='product'){
        const label=el('label','Placement type');
        const select=el('select');select.name='placement';
        for(const value of store.placements){const option=el('option',value);option.value=value;select.append(option);}
        select.value=row.placement||store.placements[0];
        label.append(select);form.append(label);
        field(form,'Commercial disclosure','disclosure',row.disclosure,'textarea');
        field(form,'Show in the local catalog','published',row.published,'checkbox');
      }
      const input=field(form,'Approved image (optional, up to 200 KB)','image','','file');
      input.accept='image/jpeg,image/png,image/webp';
      field(form,'Image rights or approval source','imageApproval',row.imageApproval);
      field(form,'Remove current image','removeImage',false,'checkbox');
      const submit=el('button','Save local content','btn btn-primary');submit.type='submit';
      const message=el('p');message.setAttribute('role','status');
      form.append(submit,message);
      form.addEventListener('submit',async event=>{
        event.preventDefault();submit.disabled=true;message.textContent='Saving…';
        try{
          const values=await imageInput(form,Object.fromEntries(new FormData(form)));
          if(save==='product')await service.saveProduct({...values,published:form.elements.published.checked},row.id);
          else if(save==='team')await service.saveTeam(row.id,values);
          else await service.saveStory(values);
          status.textContent='Saved in this browser.';render();
        }catch(error){message.textContent=error.message;}
        finally{submit.disabled=false;}
      });
      wrapper.append(form);content.append(wrapper);
    }
    function render(){
      nav.replaceChildren();content.replaceChildren();
      for(const name of ['Accessories','Team and story']){
        const tab=button(name,()=>{section=name;render();});tab.setAttribute('aria-pressed',String(name===section));nav.append(tab);
      }
      const state=store.read();
      if(section==='Accessories'){
        const fields=[['Manufacturer','manufacturer'],['Product name','name'],['Category','category'],['Editorial description','description','textarea'],['Direct product link','url','url']];
        for(const row of state.products)editCard('Edit '+row.name,row,fields,'product');
        editCard('Add accessory',{},fields,'product');
      }else{
        for(const person of state.team)editCard('Edit '+(person.name||'team slot three'),person,[
          ['Name','name'],['Title','title'],['Responsibilities','responsibilities','textarea'],['Biography','bio','textarea']
        ],'team');
        editCard('Edit story and group photograph',{story:state.story,...state.group},[
          ['Company story','story','textarea'],['Group photo caption','caption']
        ],'story');
      }
    }
    render();
  }
  window.Rated420Editorial={renderAccessories,renderTeam,mountHQ};
  renderStandard();
})();
