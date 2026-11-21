/* Shared presentation for the Build 01 catalogue and Vault routes. */
window.createBuild01 = function createBuild01({ db, user, login, page, toast, openFavorite, reviewAvatar, decorate }) {
  const root = document.getElementById('buildContent');
  const title = document.getElementById('buildTitle');
  const routes = { brands: 'brand', accessories: 'accessory', vault: 'vault' };
  const paths = { brand: 'brands', accessory: 'accessories' };

  function node(tag, text, cls) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (cls) el.className = cls;
    return el;
  }

  function link(text, url, cls) {
    const el = node('a', text, cls);
    el.href = url;
    return el;
  }

  function button(text, action, cls = 'btn btn-outline') {
    const el = node('button', text, cls);
    el.type = 'button';
    if (action) el.addEventListener('click', action);
    return el;
  }

  async function call(operation, payload = {}) {
    const { data, error } = await db().rpc('rated420_build01', { operation, payload });
    if (error) throw error;
    return data;
  }

  function score(data) {
    return data.count ? `${window.Rated420Scores.display(data.average)} / 420 · ${data.count} ${data.count === 1 ? 'reviewer' : 'reviewers'}` : 'Not yet rated';
  }

  function disclosure(parent, rows) {
    const details = node('details', undefined, 'build-pill');
    details.append(node('summary', `Individual reviews (${rows.length})`));
    const list = node('ul', undefined, 'build-review-list');
    for (const row of rows) {
      const item = node('li');
      const identity = node('span', row.username ? '@' + row.username : 'Rated420 member');
      item.append(reviewAvatar(row), identity, node('strong', `${row.total} / 420`));
      decorate(identity,row.username);
      list.append(item);
    }
    if (rows.length) details.append(list);
    else details.append(node('p', 'No community reviews yet.'));
    parent.append(details);
  }

  function status(parent) {
    const el = node('p');
    el.setAttribute('role', 'status');
    parent.append(el);
    return el;
  }

  function formSubmit(form, message, action, onSuccess) {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const submit = form.querySelector('[type=submit]');
      submit.disabled = true;
      message.textContent = 'Saving…';
      try {
        await action(new FormData(form));
        await onSuccess();
      } catch (error) {
        message.textContent = error.message || 'Could not save. Try again.';
      } finally {
        submit.disabled = false;
      }
    });
  }

  function addSubmit(form, label) {
    const submit = node('button', label, 'btn btn-primary');
    submit.type = 'submit';
    form.append(submit);
  }

  function field(parent, caption, input) {
    const label = node('label', caption);
    label.append(input);
    parent.append(label);
  }

  function reviewForm(parent, kind, item) {
    if (!user()) {
      parent.append(button('Log in to review', login));
      return;
    }
    const form = node('form', undefined, 'build-form');
    const total = node('output', '', 'build-score');
    total.setAttribute('aria-live', 'polite');
    const model=window.Rated420Scores.models[kind];
    const sliders = model.fields.map(([,label], i) => {
      const input = node('input');
      const points = node('span');
      input.type = 'range';
      input.min = 0;
      input.max = 84;
      input.value = item.own?.scores[i] ?? 42;
      input.setAttribute('aria-label', label);
      field(form, label, input);
      const guidance=node('small',model.prompts[i],'rating-guidance');
      guidance.id='listing-score-guidance-'+i;
      input.setAttribute('aria-describedby',guidance.id);
      input.after(points,guidance);
      input.addEventListener('input', () => updateTotal());
      return { input, points };
    });
    function updateTotal() {
      let sum = 0;
      for (const { input, points } of sliders) {
        points.textContent = input.value + ' / 84';
        sum += Number(input.value);
      }
      total.textContent = sum + ' / 420';
    }
    updateTotal();
    form.append(total);
    const notes = node('textarea');
    notes.name = 'notes';
    notes.rows = 4;
    notes.maxLength = 1200;
    notes.value = item.own?.notes || '';
    field(form, 'Notes', notes);
    addSubmit(form, item.own ? 'Update review' : 'Save review');
    const message = status(form);
    formSubmit(form, message, values => call('review', {
      id: item.id, scores: sliders.map(({ input }) => Number(input.value)), notes: values.get('notes')
    }), async () => { await route(); toast('Review saved.'); });
    parent.append(form);
  }

  async function favoriteButton(parent, kind, id, name, active) {
    if (!user()) return;
    try {
      if (active === undefined) {
        const rows = await call('favorites');
        active = rows.some(row => row.kind === kind && String(row.id) === String(id));
      }
      const toggle = button(active ? 'Remove from favorites' : 'Save to favorites', async () => {
        toggle.disabled = true;
        try {
          await call('favorite', { kind, id: String(id), active: !active });
          active = !active;
          toggle.textContent = active ? 'Remove from favorites' : 'Save to favorites';
          toggle.setAttribute('aria-pressed', String(active));
          toast(active ? `${name} saved to favorites.` : `${name} removed from favorites.`);
        } catch (error) { toast(error.message || 'Could not update favorites.'); }
        finally { toggle.disabled = false; }
      });
      toggle.setAttribute('aria-pressed', String(active));
      parent.append(toggle);
    } catch (error) {
      parent.append(node('p', error.message || 'Could not load favorite.'));
    }
  }

  async function favorites() {
    const box = document.getElementById('buildFavorites');
    const actor = user()?.id;
    box.textContent = 'Loading favorites…';
    try {
      const rows = await call('favorites');
      if (user()?.id !== actor) return;
      box.replaceChildren();
      if (!rows.length) box.append(node('p', 'Save a strain, brand, or dispensary to find it here.'));
      for (const row of rows) {
        box.append(row.kind === 'brand'
          ? link(row.name, '#brands/' + row.id, 'btn btn-outline')
          : button(row.name, () => openFavorite(row.kind, row.id, row.name)));
      }
    } catch (error) { box.textContent = error.message || 'Favorites are unavailable.'; }
  }

  async function dispensaryReviews(parent, id) {
    const details = node('details', undefined, 'build-pill');
    details.append(node('summary', 'Individual reviews'));
    details.addEventListener('toggle', async () => {
      if (!details.open || details.children.length > 1) return;
      try {
        const rows = await call('dispensary_reviews', { id: String(id) });
        const container = node('div');
        disclosure(container, rows);
        const replacement = container.firstElementChild;
        replacement.open = true;
        details.replaceWith(replacement);
      } catch (error) { details.append(node('p', error.message || 'Could not load reviews.')); }
    });
    parent.append(details);
  }

  function renderCatalog(parent, kind, id, data) {
    if (id) {
      if (!data) { parent.append(node('p', 'This listing could not be found.')); return; }
      title.textContent = data.name;
      parent.append(link('← All ' + paths[kind], '#' + paths[kind]), node('p', data.description, 'build-lede'));
      const card = node('section', undefined, 'build-card');
      card.append(node('h2', 'Community score'), node('p', score(data), 'build-score'));
      disclosure(card, data.reviews);
      if (kind === 'brand') void favoriteButton(card, kind, data.id, data.name, data.favorite);
      parent.append(card, node('h2', 'Your scorecard'));
      reviewForm(parent, kind, data);
      return;
    }
    if(kind==='brand'&&window.Rated420CatalogueUI)parent.append(link('Browse curated brand profiles','#catalogue/brand'));
    if(kind==='accessory'&&window.Rated420Editorial){
      window.Rated420Editorial.renderAccessories(parent);
      if(!data.length)return;
      parent.append(node('h2','Existing community accessory ratings'));
    }
    parent.append(node('p', kind === 'brand' ? 'Explore the makers behind the catalogue.' : 'Explore the gear behind the experience.', 'build-lede'));
    const grid = node('div', undefined, 'build-grid');
    for (const item of data) {
      const card = link('', `#${paths[kind]}/${item.id}`, 'build-card');
      card.append(node('h2', item.name), node('p', item.description), node('strong', score(item), 'build-score'));
      grid.append(card);
    }
    if (!data.length) grid.append(node('p', 'No listings yet.'));
    parent.append(grid);
  }

  function renderPoll(parent, poll, staff) {
    const section = node('section', undefined, 'build-card build-poll');
    section.append(node('h2', poll.question), node('p', poll.closed ? 'Voting closed' : 'Voting open'));
    const total = poll.options.reduce((sum, option) => sum + option.votes, 0);
    const form = node('form');
    for (const option of poll.options) {
      const input = node('input');
      input.type = 'radio';
      input.name = 'option';
      input.value = option.index;
      input.required = true;
      input.checked = poll.vote === option.index;
      input.disabled = poll.closed || poll.vote !== null || !user();
      field(form, option.label, input);
      const meter = node('meter');
      meter.max = Math.max(total, 1);
      meter.value = option.votes;
      meter.setAttribute('aria-label', option.label + ' votes');
      form.append(meter, node('p', option.votes + (option.votes === 1 ? ' vote' : ' votes')));
    }
    if (!poll.closed && poll.vote === null) {
      if (user()) {
        addSubmit(form, 'Vote');
        const message = status(form);
        formSubmit(form, message, values => call('vote', { id: poll.id, option: Number(values.get('option')) }), route);
      } else form.append(button('Log in to vote', login));
    }
    section.append(form, node('p', total + (total === 1 ? ' vote total' : ' votes total')));
    if (staff && !poll.closed) section.append(button('Close voting', async event => {
      event.currentTarget.disabled = true;
      try { await call('close', { id: poll.id }); await route(); }
      catch (error) { toast(error.message); await route(); }
    }));
    parent.append(section);
  }

  function renderVault(parent, data) {
    parent.append(link('Episodes and poll recaps ↗','#episodes','btn btn-outline'));
    const intro = node('div', undefined, 'build-vault');
    const copy = node('div');
    copy.append(node('p', 'The Rated420 podcast. Cast your vote and see what New York wants the hosts to talk about next.', 'build-lede'));
    const nav = node('div', undefined, 'build-actions');
    nav.append(link('Watch on YouTube ↗', 'https://www.youtube.com/@rated420ny', 'btn btn-primary'),
      link('Follow on Instagram ↗', 'https://www.instagram.com/rated420.ny', 'btn btn-outline'));
    copy.append(nav);
    const image = node('img');
    image.src = 'images/carousel-2.webp';
    image.alt = 'Illustrated Rated420 flag above the New York skyline';
    intro.append(copy, image);
    parent.append(intro);
    if (!data.polls.length) parent.append(node('p', 'There are no published polls yet.'));
    for (const poll of data.polls) renderPoll(parent, poll, data.staff);
    if (data.staff) {
      const form = node('form', undefined, 'build-form');
      form.append(node('h2', 'Publish a poll'));
      for (const [name, label, max] of [['question','Question',160],['first','First option',80],['second','Second option',80]]) {
        const input = node('input');
        input.name = name;
        input.required = true;
        input.maxLength = max;
        field(form, label, input);
      }
      addSubmit(form, 'Publish poll');
      const message = status(form);
      formSubmit(form, message, values => call('publish', {
        question: values.get('question'), options: [values.get('first'), values.get('second')]
      }), route);
      parent.append(form);
    }
  }

  async function route() {
    const hash = location.hash;
    const [path, id] = hash.slice(1).split('/');
    const kind = Object.hasOwn(routes, path) ? routes[path] : null;
    if (!kind || !db()) return;
    page('build');
    title.textContent = { brand: 'Brands', accessory: 'Accessories', vault: 'The Vault' }[kind];
    title.focus({ preventScroll: true });
    root.textContent = 'Loading…';
    try {
      const result = kind !== 'vault' && !id
        ? await db().rpc('rated420_build02',{operation:'catalog',payload:{kind}})
        : {data:await call(kind==='vault'?'polls':'item',{kind,id})};
      if(result.error) throw result.error;
      const data=result.data;
      if (location.hash !== hash) return;
      root.replaceChildren();
      if (kind === 'vault') renderVault(root, data);
      else renderCatalog(root, kind, id, data);
    } catch (error) {
      if (location.hash === hash) root.textContent = error.message || 'Could not load this page.';
    }
  }

  return { route, favorites, favoriteButton, dispensaryReviews };
};
