'use strict';

const workspace = document.getElementById('founder-workspace');
const profiles = document.getElementById('profile-examples');
const links = document.querySelectorAll('.profile-preview-nav a');
window.mountGaryPreview(workspace);

function showPreviewRoute() {
  const path = location.hash;
  const view = {
    '#profiles/populated':'populated',
    '#profiles/missing':'missing',
    '#profiles/edit':'edit'
  }[path];
  workspace.hidden = Boolean(view);
  profiles.hidden = !view;
  if (view) window.renderProfileExample(profiles,view);
  for (const link of links) {
    const current = view ? link.hash === path : link.hash === '#hq';
    if (current) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('hashchange',showPreviewRoute);
showPreviewRoute();
