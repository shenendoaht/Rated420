(() => {
  'use strict';

  const mobile=matchMedia('(max-width: 900px)');
  const phone=matchMedia('(max-width: 760px)');
  const shell=document.getElementById('siteShell');
  const main=document.getElementById('siteMain');
  const existing=document.querySelector('.main-nav');
  const catalogue=document.getElementById('navCatalogue');
  const shortcuts=document.querySelector('.complete-nav');
  if(!main||!existing||!catalogue||!shortcuts)return;

  document.documentElement.classList.add('rated-refined');
  const node=(tag,text,cls)=>{
    const element=document.createElement(tag);
    if(text)element.textContent=text;
    if(cls)element.className=cls;
    return element;
  };
  function press(label,cls){
    const button=node('button',label,cls);
    button.type='button';return button;
  }
  const shortcut=hash=>shortcuts.querySelector('[href="'+hash+'"]');
  const navLink=(hash,label)=>{
    const item=node('a',label);
    item.href=hash;return item;
  };
  function group(label,children){
    const details=node('details',null,'ref-nav-group');
    details.append(node('summary',label),node('div',null,'ref-group-links'));
    details.lastElementChild.append(...children);
    return details;
  }
  const nav=existing;
  nav.id='ref-public-navigation';
  nav.classList.add('ref-public-nav');
  const media=group('Media',[shortcut('#episodes'),shortcut('#vault'),shortcut('#shop')]);
  const community=group('Community',[shortcut('#demo-reviews'),navLink('#contribute','Suggest a listing')]);
  const more=group('About',[shortcut('#about'),shortcut('#contact')]);
  const explore=catalogue.querySelector('summary');
  explore.textContent='Explore';
  catalogue.querySelector('.nav-catalogue-links').append(shortcut('#businesses'));
  nav.replaceChildren(navLink('#home','Home'),catalogue,community,media,more,navLink('#hq','Rated420 HQ'));
  shortcuts.remove();

  const trigger=press('Menu','btn btn-outline ref-menu-trigger');
  const icon=node('span','☰');
  icon.setAttribute('aria-hidden','true');trigger.prepend(icon);
  trigger.setAttribute('aria-label','Browse menu');
  trigger.setAttribute('aria-controls',nav.id);
  trigger.setAttribute('aria-expanded','false');
  nav.before(trigger);
  let expanded=false;

  function updatePublic(open=expanded){
    expanded=Boolean(open)&&mobile.matches;
    trigger.hidden=!mobile.matches;
    nav.hidden=mobile.matches&&!expanded;
    trigger.setAttribute('aria-expanded',String(expanded));
  }
  trigger.addEventListener('click',()=>updatePublic(!expanded));
  mobile.addEventListener('change',()=>updatePublic(false));
  updatePublic();

  function closePublic(){
    if(expanded)updatePublic(false);
    for(const details of nav.querySelectorAll('details[open]'))details.open=false;
  }
  nav.addEventListener('click',event=>{
    if(!event.target.closest('a,button'))return;
    closePublic();
    if(mobile.matches)requestAnimationFrame(()=>{
      if(nav.contains(document.activeElement)||document.activeElement===document.body)trigger.focus();
    });
  });
  document.addEventListener('click',event=>{
    if(!nav.contains(event.target)&&!trigger.contains(event.target))closePublic();
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||(!expanded&&!nav.querySelector('details[open]')))return;
    const group=event.target.closest('details');
    closePublic();
    if(mobile.matches)trigger.focus();
    else group?.querySelector('summary')?.focus();
  });
  function reflect(){
    const route=location.hash.split('/')[0]||'#home';
    const account=['#accountPage','#authPage'].some(id=>!document.querySelector(id)?.hidden);
    for(const item of nav.querySelectorAll('a')){
      const active=!account&&(item.hash===route||item.hash==='#home'&&route==='#how-it-works');
      if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    }
    const selected=nav.querySelector('[aria-current=page]');
    for(const item of nav.querySelectorAll('details'))item.dataset.current=String(Boolean(selected&&item.contains(selected)));
    shell.dataset.surface=route.startsWith('#hq')?'hq':route.startsWith('#business')?'business':'public';
  }
  window.addEventListener('hashchange',()=>{closePublic();reflect();});
  const observer=new MutationObserver(reflect);
  for(const page of main.children)observer.observe(page,{attributes:true,attributeFilter:['hidden']});
  reflect();

  const preview=shell.querySelector('[aria-label="Synthetic data preview"]');
  if(preview){
    const controls=node('details',null,'ref-demo-controls');
    const label=node('summary','Demo controls');
    const body=node('div',null,'ref-demo-fields');
    controls.append(label,body);
    controls.open=false;
    preview.replaceWith(controls);body.append(preview);
    const select=document.getElementById('demoReviewer');
    const option=node('span',null,'ref-demo-role');
    label.append(option);
    const reflectRole=()=>{option.textContent=select.selectedOptions[0]?.textContent||'';};
    select.addEventListener('change',reflectRole);
    new MutationObserver(reflectRole).observe(select,{childList:true});
    shell.addEventListener('click',()=>queueMicrotask(reflectRole));
    reflectRole();
  }

  let counter=0;
  const groupStates=new WeakMap();
  function workspace(nav,content,name){
    const frame=node('div',null,'ref-workspace');
    const pane=node('aside',null,'ref-workspace-pane');
    const inner=node('div',null,'ref-workspace-content');
    const toggle=press(name+' navigation','btn btn-outline ref-workspace-toggle');
    toggle.setAttribute('aria-label',name+' navigation');
    nav.id='ref-workspace-'+(++counter);
    toggle.setAttribute('aria-controls',nav.id);
    const pref='rated420-ux-sidebar:'+name.toLowerCase().replace(/[^a-z]+/g,'-');
    let collapsed=false;
    try{collapsed=localStorage.getItem(pref)==='collapsed';}catch{}
    let openMobile=false;
    const update=()=>{
      const open=phone.matches?openMobile:!collapsed;
      nav.hidden=!open;
      frame.classList.toggle('is-collapsed',!open);
      toggle.setAttribute('aria-expanded',String(open));
    };
    const viewport=()=>{openMobile=false;update();};
    phone.addEventListener('change',viewport);
    const cleanup=new MutationObserver(()=>{
      if(!frame.isConnected){phone.removeEventListener('change',viewport);cleanup.disconnect();}
    });
    cleanup.observe(main,{subtree:true,childList:true});
    toggle.addEventListener('click',()=>{
      if(phone.matches)openMobile=!openMobile;
      else {
        collapsed=!collapsed;
        try{localStorage.setItem(pref,collapsed?'collapsed':'expanded');}catch{}
      }
      update();
    });
    pane.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&phone.matches&&openMobile){openMobile=false;update();toggle.focus();}
    });
    nav.addEventListener('click',event=>{
      const target=event.target.closest('a,button');
      if(!target)return;
      if(!phone.matches){
        if(event.detail===0&&!target.isConnected)nav.querySelector('[aria-pressed=true]')?.focus();
        return;
      }
      if(!openMobile)return;
      openMobile=false;update();
      requestAnimationFrame(()=>{
        if(!frame.isConnected)return;
        const heading=content.querySelector('h2,h3');
        if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}else toggle.focus();
      });
    });
    nav.before(frame);pane.append(toggle,nav);inner.append(content);frame.append(pane,inner);update();
  }
  function sections(nav,groups){
    const state=groupStates.get(nav)??new Map();
    groupStates.set(nav,state);
    for(const [name,children] of groups){
      if(!children.length)continue;
      const block=group(name,children);
      block.open=children.some(child=>child.getAttribute('aria-pressed')==='true')||(state.get(name)??true);
      block.addEventListener('toggle',()=>{if(block.isConnected)state.set(name,block.open);});
      nav.append(block);
    }
  }
  window.Rated420UX={workspace,sections};
})();
