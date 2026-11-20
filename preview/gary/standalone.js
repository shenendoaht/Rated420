'use strict';

const workspace = document.getElementById('founder-workspace');
const profiles = document.getElementById('profile-examples');
const expansion = document.getElementById('expansion-view');
const links = document.querySelectorAll('.profile-preview-nav a');
window.mountGaryPreview(workspace);

function showPreviewRoute() {
  const path = location.hash;
  const view = {
    '#profiles/populated':'populated',
    '#profiles/missing':'missing',
    '#profiles/edit':'edit'
  }[path];
  const area={'#hq/finance':'finance','#hq/territory':'market','#community/stash':'stash','#community/reviews':'public'}[path];
  workspace.hidden = Boolean(view||area);
  expansion.hidden = !area;
  expansion.replaceChildren();
  if(area)window.mountRatedExpansion(expansion,area,{hq:()=>window.GaryStore.openStore().read()});
  profiles.hidden = !view;
  if (view) window.renderProfileExample(profiles,view);
  for (const link of links) {
    const current = view || area ? link.hash === path : link.hash === '#hq';
    if (current) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange',showPreviewRoute);
showPreviewRoute();
