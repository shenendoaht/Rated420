/* Synthetic Build 01 data adapter. The real authorization checks live in PostgreSQL. */
function runBuild01Fixture(operation, payload, state, actor, users, profile) {
  const fixtures = state.build01 ??= {
    items: [
      { id: 'demo-brand', kind: 'brand', name: 'Demo Orchard Co.', description: 'Synthetic brand for local review testing.' },
      { id: 'houseplant-grinder', kind: 'accessory', name: 'Shen’s blue Houseplant glass grinder', description: 'Accessory fixture supplied in the Build 01 brief.' },
      { id: 'puffco', kind: 'accessory', name: 'Al’s Puffco', description: 'Accessory fixture supplied in the Build 01 brief.' }
    ],
    reviews: [], favorites: [],
    polls: [{ id: 'demo-poll', question: 'What should The Vault cover next?', closed: false, options: ['New York growers', 'Dispensary design'], votes: {} }]
  };
  const { id, kind } = payload;
  const role=state.build02?.roles[actor];
  const staff = role ? role !== 'member' : [users[0],users[2],users[3]].includes(actor);
  const ownFavorites = () => fixtures.favorites.filter(row => row.actor === actor);
  const identity = (id, total) => {
    const { username, avatar_choice, show_review_identity } = profile(state, id);
    return { total, username: show_review_identity ? username : null, avatar_choice: show_review_identity ? avatar_choice : null };
  };
  const catalog = fixtures.items.map(item => {
    const reviews = fixtures.reviews.filter(row => row.id === item.id);
    return {
      ...item, count: reviews.length,
      average: reviews.length ? reviews.reduce((sum, row) => sum + row.total, 0) / reviews.length : null
    };
  });
  if (operation === 'catalog') return catalog.filter(item => item.kind === kind);
  if (operation === 'item') {
    const item = catalog.find(row => row.id === id && row.kind === kind);
    if (!item) return null;
    const reviews = fixtures.reviews.filter(row => row.id === id);
    return {
      ...item, own: reviews.find(row => row.actor === actor) ?? null,
      favorite: ownFavorites().some(row => row.kind === kind && row.id === id),
      reviews: reviews.map(row => identity(row.actor, row.total))
    };
  }
  if (operation === 'dispensary_reviews') {
    return state.dispensary_reviews.filter(row => String(row.dispensary_id) === id).map(row => identity(row.user_id, row.total));
  }
  if (operation === 'polls') return { staff, polls: fixtures.polls.map(poll => ({
    id: poll.id, question: poll.question, closed: poll.closed, vote: poll.votes[actor] ?? null,
    options: poll.options.map((label, i) => ({
      label, index: i + 1, votes: Object.values(poll.votes).filter(choice => choice === i + 1).length
    }))
  })) };
  if (!actor) throw new Error('Log in to continue.');
  if (operation === 'favorites') return ownFavorites().map(({ kind, id, name }) => ({ kind, id, name }));
  if (operation === 'favorite') {
    const listing = (kind === 'strain' ? state.strains : kind === 'dispensary' ? state.dispensaries : fixtures.items.filter(row => row.kind === 'brand'))
      .find(row => String(row.id) === id);
    if (!listing || !['strain', 'dispensary', 'brand'].includes(kind)) throw new Error('Listing not found.');
    fixtures.favorites = fixtures.favorites.filter(row => row.actor !== actor || row.kind !== kind || row.id !== id);
    if (payload.active) fixtures.favorites.push({ actor, kind, id, name: listing.name });
  } else if (operation === 'review') {
    const { scores, notes } = payload;
    if (!fixtures.items.some(item => item.id === id) || !Array.isArray(scores) || scores.length !== 5 ||
        scores.some(value => !Number.isInteger(value) || value < 0 || value > 84) || notes.length > 1200) {
      throw new Error('Check your five scores and notes.');
    }
    const previous=fixtures.reviews.find(row=>row.actor===actor&&row.id===id);
    fixtures.reviews = fixtures.reviews.filter(row => row.actor !== actor || row.id !== id);
    fixtures.reviews.push({ id, actor, scores, notes: notes.trim(), activity_at:previous?.activity_at??new Date().toISOString(), total: scores.reduce((a, b) => a + b, 0) });
  } else if (operation === 'vote') {
    const poll = fixtures.polls.find(poll => poll.id === id);
    if (!poll || poll.closed) throw new Error('Voting is closed.');
    if (poll.votes[actor]) throw new Error('You have already voted.');
    if (![1, 2].includes(payload.option)) throw new Error('Choose a poll option.');
    poll.votes[actor] = payload.option;
    (poll.voteDates??={})[actor]=new Date().toISOString();
  } else if (operation === 'publish' && staff) {
    const question = payload.question.trim();
    const options = payload.options.map(value => value.trim());
    if (!question || question.length > 160 || options.length !== 2 || options.some(value => !value || value.length > 80)
        || options[0].toLowerCase() === options[1].toLowerCase()) throw new Error('Enter a question and two different options.');
    fixtures.polls.unshift({ id: crypto.randomUUID(), question, options, closed: false, votes: {} });
  } else if (operation === 'close' && staff) {
    const poll = fixtures.polls.find(poll => poll.id === id);
    if (poll) poll.closed = true;
  } else throw new Error('Action unavailable.');
  return null;
}
