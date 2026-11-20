(() => {
  'use strict';

  const key = 'rated420-hq-profile-examples-v1';
  const original = 'images/profile-portrait-wide.png';
  const alternate = 'images/profile-portrait-tall.png';
  const samples = {
    populated: {
      name:'Morgan Avery-Lantern, Hudson Valley Field Notes and Community Reviews',
      handle:'morgan_fieldnotes',
      bio:'I keep field notes on Hudson Valley growers, local stories, and what makes a review worth reading. When I’m away from the keyboard, I’m usually helping plan the next interview or comparing notes from the last one.',
      reviews:[
        { name:'Demo Citrus', score:354, note:'Bright citrus up front and a clean finish.' },
        { name:'Field Signal Studio', score:337, note:'Clear labeling and consistent presentation.' },
        { name:'North Loop Dispensary', score:369, note:'Easy to browse and a thoughtful conversation about selection.' }
      ]
    },
    missing: {
      name:'Jules Rivera', handle:'jules_rivera', src:'data:image/png;base64,AA==', reviews:[]
    }
  };

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function action(text, callback) {
    const button = el('button', text);
    button.type = 'button';
    button.addEventListener('click', callback);
    return button;
  }

  function link(text, hash, primary = false) {
    const anchor = el('a', text, primary ? 'profile-primary' : '');
    anchor.href = hash;
    return anchor;
  }

  async function readImage(file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      throw Error('Choose a JPG, PNG or WebP image up to 5 MB.');
    }
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      try { await image.decode(); }
      catch { throw Error('This photo could not be opened. Choose a different image.'); }
      const scale = Math.min(1, 384 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', .88);
    } finally { URL.revokeObjectURL(url); }
  }

  window.renderProfileExample = function renderProfileExample(host, view) {
    const isOwner = view === 'edit';
    const missing = view === 'missing';
    const item = missing ? samples.missing : samples.populated;
    let src = missing ? item.src : JSON.parse(localStorage.getItem(key) ?? JSON.stringify(original));
    const frame = window.Rated420Avatar.create({name:item.name,src}, 'large');
    const header = el('header', '', 'profile-identity');
    const copy = el('div', '', 'profile-identity-copy');
    copy.append(el('h2', item.name), el('p', '@'+item.handle, 'profile-handle'));
    if (item.bio) copy.append(el('p',item.bio,'profile-bio'));
    header.append(frame,copy);
    if (isOwner) {
      const ownerActions = el('div','','profile-actions');
      ownerActions.append(link('View as visitor',window.RatedComplete?'#profile-examples/populated':'#profiles/populated'));
      header.append(ownerActions);
    }
    host.replaceChildren(header);

    if (isOwner) {
      const panel = el('section','','profile-section');
      const status = el('p');
      status.setAttribute('role','status');
      const file = el('input');
      file.type = 'file';
      file.id = 'example-avatar-file';
      file.accept = 'image/jpeg,image/png,image/webp';
      const label = el('label','Choose a local photo');
      label.htmlFor = file.id;

      function setPhoto(next, text, reset = false) {
        try {
          if (reset) localStorage.removeItem(key);
          else localStorage.setItem(key, JSON.stringify(next));
          src = next;
          window.Rated420Avatar.update(frame, {name:item.name,src});
          status.textContent = text;
        } catch {
          status.textContent = 'This browser could not save the photo. Check its storage settings and try again.';
        }
      }

      const controls = el('div','','profile-actions');
      controls.append(action('Use sample photo',()=>setPhoto(alternate,'Sample photo saved in this browser.')),
        action('Remove avatar',()=>setPhoto(null,'Avatar removed. Initials are shown.')),
        action('Reset profile example',()=>setPhoto(original,'Original avatar restored.',true)));
      const form = el('form');
      const submit = el('button','Save photo','profile-primary');
      submit.type = 'submit';
      const save = el('div','','profile-actions');
      save.append(submit);
      form.append(label,file,save);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!file.files.length) { status.textContent = 'Choose a local photo first.'; return; }
        submit.disabled = true;
        for (const button of controls.children) button.disabled = true;
        try {
          const next = await readImage(file.files[0]);
          setPhoto(next,'Photo saved in this browser.');
        } catch (error) { status.textContent = error.message; }
        finally {
          submit.disabled = false;
          for (const button of controls.children) button.disabled = false;
        }
      });
      panel.append(el('h2','Edit profile'),el('p','Synthetic owner account. Choose a JPG, PNG or WebP up to 5 MB. Avatar changes stay in this browser.'),form,controls,status);
      host.append(panel);
    }

    const details = el('section','','profile-section');
    details.append(el('h2','Profile details'),el('p',missing ? 'No additional details shared.' : 'Synthetic member since May 2024'));
    const activity = el('section','','profile-section');
    activity.append(el('h2','Review activity'));
    const reviews = el('div','','profile-review-list');
    for (const review of item.reviews) {
      const card = el('article');
      card.append(el('h3',review.name),el('strong',review.score+' / 420'),el('p',review.note));
      reviews.append(card);
    }
    activity.append(item.reviews.length ? reviews : el('p','No reviews yet.'));
    host.append(details,activity);
  };
})();
