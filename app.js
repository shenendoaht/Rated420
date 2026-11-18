/* Rated420 NY — Build 02 | real Supabase Auth + private member profiles
 * Browser-only, framework-free, no secret/server keys.
 * This is a clean implementation; it does not import any previous site logic.
 */
(() => {
  'use strict';

  const SUPABASE_URL = 'https://ymluyoqkmzxomjokjmkj.supabase.co';
  // Publishable/browser key. Safe to expose ONLY because database RLS is enabled.
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_9Mn25kUvjTIL0gL4OkLBcw_IlAnwFyq';
  const AGE_SESSION_KEY = 'rated420_ny_21plus_session_v1';
  const $ = id => document.getElementById(id);

  let db = null;
  let authStarted = false;
  let user = null;
  let profile = null;
  let mode = 'login';
  let currentPage = 'home';
  let inRecovery = false;
  let ageConfirmedThisPage = false;
  let toastTimer = null;
  let checkingUser = false;
  let refreshPending = false;
  let refreshPendingJump = false;

  function isAgeAccepted() {
    if (ageConfirmedThisPage) return true;
    try { return sessionStorage.getItem(AGE_SESSION_KEY) === 'yes'; } catch (_) { return false; }
  }

  function acceptAge() {
    ageConfirmedThisPage = true;
    try { sessionStorage.setItem(AGE_SESSION_KEY, 'yes'); } catch (_) { /* session-only fallback */ }
    $('ageGate').hidden = true;
    $('siteShell').removeAttribute('inert');
    if (!authStarted) initializeAuth();
    if (new URLSearchParams(location.search).has('error_description')) {
      showAuth('login');
      setMessage('authMessage', new URLSearchParams(location.search).get('error_description') || 'There was a problem with the email link.', true);
    }
  }

  function denyAge() {
    // Navigate away rather than storing any claim about the visitor's age.
    window.location.replace('https://www.google.com/');
  }

  function toast(message) {
    const box = $('toast');
    box.textContent = message;
    box.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { box.hidden = true; }, 5200);
  }

  function setMessage(id, message, isError = false) {
    const box = $(id);
    box.hidden = !message;
    box.textContent = message || '';
    box.classList.remove('is-error', 'is-success');
    if (message) box.classList.add(isError ? 'is-error' : 'is-success');
  }

  function setBusy(form, busy) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (!btn.dataset.original) btn.dataset.original = btn.innerHTML;
    btn.disabled = busy;
    btn.innerHTML = busy ? 'Working…' : btn.dataset.original;
  }

  function page(name) {
    currentPage = name;
    $('homePage').hidden = name !== 'home';
    $('authPage').hidden = name !== 'auth';
    $('accountPage').hidden = name !== 'account';
    $('strainPage').hidden = name !== 'strain';
    $('dispensaryPage').hidden = name !== 'dispensary';
    $('contactPage').hidden = name !== 'contact';
    if (name === 'account' && db && user) {
      void loadMyStrainReviews();
      void loadDispensaryReviews(true);
      fillAvatar();
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function home() { page('home'); }

  function setMode(next) {
    mode = next;
    setMessage('authMessage', '');
    ['login','signup','forgot','reset'].forEach(name => {
      $(`${name}Form`).hidden = name !== mode;
    });
    const config = {
      login: ['WELCOME BACK', 'Log in.', 'Welcome back to Rated420. Your experience matters here.'],
      signup: ['JOIN THE COMMUNITY', 'Make it official.', 'Create your account. The best parts of Rated420 are still ahead.'],
      forgot: ['ACCOUNT RECOVERY', 'Reset password.', 'Enter the email associated with your Rated420 account.'],
      reset: ['ACCOUNT RECOVERY', 'Choose a password.', 'Set a new secure password for your Rated420 account.']
    }[mode];
    $('authKicker').textContent = config[0];
    $('authTitle').textContent = config[1];
    $('authIntro').textContent = config[2];
    $('authTabs').hidden = mode === 'forgot' || mode === 'reset';
    $('tabLogin').classList.toggle('selected', mode === 'login');
    $('tabSignup').classList.toggle('selected', mode === 'signup');
  }

  function showAuth(which = 'login') {
    if (user && !inRecovery && (which === 'login' || which === 'signup')) {
      page('account');
      return;
    }
    setMode(which);
    page('auth');
  }

  function updateNav() {
    const signedIn = !!user;
    $('navLogin').hidden = signedIn;
    $('navJoin').hidden = signedIn;
    $('navAccount').hidden = !signedIn;
    $('heroJoin').firstChild.textContent = signedIn ? 'Rate a Strain ' : 'Join Rated420 ';
  }

  function redirectUrl() {
    // Local file:// cannot be an allowed Supabase redirect destination.
    return /^https?:$/.test(location.protocol) ? location.origin + location.pathname : undefined;
  }

  async function readOrCreateProfile(authUser) {
    const { data: existing, error: readError } = await db
      .from('member_profiles')
      .select('id, username, display_name, created_at, updated_at, avatar_choice, avatar_path, show_review_identity')
      .eq('id', authUser.id)
      .maybeSingle();
    if (readError) throw readError;
    if (existing) return existing;

    const wanted = String(authUser.user_metadata?.requested_username || '').trim();
    const username = /^[A-Za-z0-9_]{3,24}$/.test(wanted) ? wanted : null;
    let record = { id: authUser.id };
    if (username) record.username = username;
    let { data: inserted, error: insertError } = await db
      .from('member_profiles')
      .insert(record)
      .select('id, username, display_name, created_at, updated_at, avatar_choice, avatar_path, show_review_identity')
      .single();

    if (insertError && username && insertError.code === '23505') {
      // Another member claimed the same username first. Still create the account profile.
      ({ data: inserted, error: insertError } = await db
        .from('member_profiles')
        .insert({ id: authUser.id })
        .select('id, username, display_name, created_at, updated_at, avatar_choice, avatar_path, show_review_identity')
        .single());
      if (!insertError) toast('Your account is ready. That username was taken — choose a new one in My account.');
    }
    if (insertError && insertError.code === '23505') {
      // Rare simultaneous browser tabs. The other tab may already have created it.
      const { data: fromOtherTab, error } = await db.from('member_profiles')
        .select('id, username, display_name, created_at, updated_at, avatar_choice, avatar_path, show_review_identity')
        .eq('id', authUser.id).maybeSingle();
      if (!error && fromOtherTab) return fromOtherTab;
    }
    if (insertError) throw insertError;
    return inserted;
  }

  function fillAccount() {
    if (!user) return;
    const username = profile?.username || 'New member';
    $('memberHandle').textContent = '@' + (username === 'New member' ? 'new_member' : username);
    $('memberEmail').textContent = user.email || '';
    const joined = profile?.created_at || user.created_at;
    $('memberSince').textContent = joined ? 'Member since ' + new Date(joined).toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' }) : '';
    $('profileUsername').value = profile?.username || '';
    $('profileDisplayName').value = profile?.display_name || '';
    $('profileReviewIdentity').checked = Boolean(profile?.show_review_identity);
  }

  async function refreshUser(goToAccount = false) {
    if (!db) return;
    if (checkingUser) { refreshPending = true; refreshPendingJump = refreshPendingJump || goToAccount; return; }
    checkingUser = true;
    try {
      const { data, error } = await db.auth.getUser();
      if (error && error.message !== 'Auth session missing!') throw error;
      user = data?.user || null;
      profile = null;
      updateNav();
      if (user) {
        try { profile = await readOrCreateProfile(user); }
        catch (e) {
          console.warn('Profile unavailable:', e?.message || e);
          setMessage('profileMessage', 'You are signed in, but your profile could not be loaded. Try refreshing the page.', true);
        }
        fillAccount();
        if (goToAccount && !inRecovery) page('account');
      } else if (currentPage === 'account') {
        home();
      }
    } catch (e) {
      console.warn('Sign-in check unavailable:', e?.message || e);
      if (goToAccount) toast('Could not verify your session. Check your connection.');
    } finally {
      checkingUser = false;
      if (refreshPending) { const jump = refreshPendingJump; refreshPending = false; refreshPendingJump = false; refreshUser(jump); }
    }
  }

  async function initializeAuth() {
    if (authStarted) return;
    if (!window.supabase?.createClient) {
      toast('The login service is still loading. You can explore the site while offline.');
      return;
    }
    authStarted = true;
    try {
      db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true }
      });
      db.auth.onAuthStateChange((event) => {
        // Do NOT await other Supabase methods inside onAuthStateChange: can deadlock.
        if (event === 'PASSWORD_RECOVERY') {
          inRecovery = true;
          setTimeout(() => showAuth('reset'), 0);
        }
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
          setTimeout(() => refreshUser(event === 'SIGNED_IN' && !inRecovery), 0);
        }
      });
      await refreshUser(false);
      void loadStrainCatalogue();
    } catch (e) {
      console.warn('Could not initialize Supabase:', e?.message || e);
      toast('Unable to connect to accounts at the moment. The landing page still works.');
    }
  }

  async function login(event) {
    event.preventDefault();
    const form = $('loginForm');
    if (!form.reportValidity()) return;
    if (!db) return setMessage('authMessage', 'Login service unavailable. Check your connection and reload.', true);
    setMessage('authMessage', '');
    setBusy(form, true);
    try {
      const { error } = await db.auth.signInWithPassword({
        email: $('loginEmail').value.trim(), password: $('loginPassword').value
      });
      if (error) throw error;
      $('loginPassword').value = '';
      await refreshUser(true);
    } catch (e) { setMessage('authMessage', e?.message || 'Unable to log in.', true); }
    finally { setBusy(form, false); }
  }

  async function signup(event) {
    event.preventDefault();
    const form = $('signupForm');
    if (!form.reportValidity()) return;
    const username = $('signupUsername').value.trim();
    const email = $('signupEmail').value.trim();
    const password = $('signupPassword').value;
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) return setMessage('authMessage', 'Username must have 3–24 letters, numbers, or underscores.', true);
    if (password !== $('signupConfirm').value) return setMessage('authMessage', 'Passwords do not match.', true);
    if (!$('signupAge').checked) return setMessage('authMessage', 'You must confirm you are at least 21.', true);
    if (!db) return setMessage('authMessage', 'Signup service unavailable. Check your connection and reload.', true);
    setMessage('authMessage', '');
    setBusy(form, true);
    try {
      const url = redirectUrl();
      const options = { data: { requested_username: username } };
      if (url) options.emailRedirectTo = url;
      const { data, error } = await db.auth.signUp({ email, password, options });
      if (error) throw error;
      $('signupPassword').value = '';
      $('signupConfirm').value = '';
      if (data?.session) {
        await refreshUser(true);
        toast('Your Rated420 account has been created. Welcome!');
      } else {
        setMessage('authMessage', 'Check your inbox for a confirmation link. Once confirmed, come back and log in. Your username will be added when you first sign in.');
      }
    } catch (e) { setMessage('authMessage', e?.message || 'Unable to create account.', true); }
    finally { setBusy(form, false); }
  }

  async function forgot(event) {
    event.preventDefault();
    const form = $('forgotForm');
    if (!form.reportValidity()) return;
    if (!db) return setMessage('authMessage', 'Password reset unavailable until connected.', true);
    setMessage('authMessage', '');
    setBusy(form, true);
    try {
      const url = redirectUrl();
      const { error } = await db.auth.resetPasswordForEmail($('forgotEmail').value.trim(), url ? { redirectTo:url } : undefined);
      if (error) throw error;
      setMessage('authMessage', 'If that email belongs to an account, a password reset link will arrive shortly.');
    } catch (e) { setMessage('authMessage', e?.message || 'Unable to request reset.', true); }
    finally { setBusy(form, false); }
  }

  async function reset(event) {
    event.preventDefault();
    const form = $('resetForm');
    if (!form.reportValidity()) return;
    if ($('resetPassword').value !== $('resetConfirm').value) return setMessage('authMessage', 'Passwords do not match.', true);
    if (!db) return setMessage('authMessage', 'Password reset service unavailable.', true);
    setMessage('authMessage', '');
    setBusy(form, true);
    try {
      const { error } = await db.auth.updateUser({ password:$('resetPassword').value });
      if (error) throw error;
      $('resetPassword').value = '';
      $('resetConfirm').value = '';
      inRecovery = false;
      await refreshUser(true);
      toast('Your password has been updated.');
    } catch (e) { setMessage('authMessage', e?.message || 'Could not update password.', true); }
    finally { setBusy(form, false); }
  }

  async function saveProfile(event) {
    event.preventDefault();
    const form = $('profileForm');
    if (!form.reportValidity()) return;
    if (!db || !user) return setMessage('profileMessage', 'Please log in again.', true);
    const username = $('profileUsername').value.trim();
    const displayName = $('profileDisplayName').value.trim();
    const showReviewIdentity = $('profileReviewIdentity').checked;
    if (showReviewIdentity && !username) return setMessage('profileMessage', 'Choose a username to show on community reviews.', true);
    if (username && !/^[A-Za-z0-9_]{3,24}$/.test(username)) return setMessage('profileMessage', 'Username must have 3–24 letters, numbers, or underscores.', true);
    if (displayName && (displayName.length < 2 || displayName.length > 60)) return setMessage('profileMessage', 'Display name must have 2–60 characters.', true);
    setMessage('profileMessage', '');
    setBusy(form, true);
    const memberId = user.id;
    const oldAvatar = profile?.avatar_path;
    let uploaded = null;
    try {
      const choice = form.elements.avatar.value;
      const file = $('avatarFile').files[0];
      if (choice === 'upload' && !file && !oldAvatar) throw new Error('Choose a photo to upload.');
      if (choice === 'upload' && file) uploaded = await uploadPhoto(AVATAR_BUCKET, file, memberId);
      const avatarPath = choice === 'upload' ? (uploaded || oldAvatar) : null;
      const { data, error } = await db.from('member_profiles')
        .update({ username:username || null, display_name:displayName || null, avatar_choice: choice && choice !== 'upload' ? Number(choice) : null, avatar_path: avatarPath, show_review_identity:showReviewIdentity, updated_at:new Date().toISOString() })
        .eq('id', memberId)
        .select('id, username, display_name, created_at, updated_at, avatar_choice, avatar_path, show_review_identity')
        .single();
      if (error) throw error;
      if (oldAvatar && oldAvatar !== avatarPath) void db.storage.from(AVATAR_BUCKET).remove([oldAvatar]);
      if (user?.id !== memberId) return;
      profile = data;
      fillAccount();
      fillAvatar();
      setMessage('profileMessage', 'Profile saved to your Rated420 account.');
    } catch (e) {
      if (uploaded) void db.storage.from(AVATAR_BUCKET).remove([uploaded]);
      const duplicate = e?.code === '23505';
      setMessage('profileMessage', duplicate ? 'That username is already taken. Try another.' : (e?.message || 'Unable to save profile.'), true);
    } finally { setBusy(form, false); }
  }

  async function signOut() {
    if (!db) return;
    const button = $('accountSignOut');
    button.disabled = true;
    try {
      const { error } = await db.auth.signOut();
      if (error) throw error;
      user = null; profile = null; inRecovery = false;
      updateNav();
      home();
      toast('Signed out of Rated420.');
    } catch (e) { toast(e?.message || 'Could not sign out.'); }
    finally { button.disabled = false; }
  }

  // The SDK loads asynchronously so an offline CDN never blocks the age gate.
  window.addEventListener('rated420:sdk-ready', () => {
    if (isAgeAccepted() && !authStarted) initializeAuth();
  });

  // Recover the original four-image home carousel from the previous build.
  // Respect reduced-motion preferences and hidden tabs; otherwise rotate every 5 seconds.
  const carouselSlides = [...document.querySelectorAll('[data-carousel-slide]')];
  if (carouselSlides.length > 1) {
    let carouselIndex = 0;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    function showCarouselSlide(nextIndex) {
      carouselIndex = nextIndex % carouselSlides.length;
      carouselSlides.forEach((slide, index) => {
        const active = index === carouselIndex;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', String(!active));
      });
    }
    window.setInterval(() => {
      if (!document.hidden && !reduceMotion.matches && isAgeAccepted() && currentPage === 'home') {
        showCarouselSlide(carouselIndex + 1);
      }
    }, 5000);
  }

  /* Rated420 Build 05 — live strain directory and account-owned review scorecards.
   * Keep the prior scorecard's five 0–84 categories and product-format separation.
   */
  const STRAIN_CATEGORIES = [
    ['aesthetic', 'Aesthetic'], ['aroma', 'Aroma'], ['flavor', 'Flavor'],
    ['effects', 'Effects'], ['overall', 'Overall']
  ];
  // Prompt order follows the five strain categories above.
  const STRAIN_SCORE_GUIDANCE = {
    Flower: [
      "How does it look? How’s the trim?",
      "How does the flower smell? What about the smoke?",
      "What did it taste like? Did the flavor linger?",
      "How did you feel, and how long did it last?",
      "How was the whole experience? Would you choose it again?"
    ],
    'Pre-Roll': [
      "How neat and evenly packed is the roll?",
      "How does it smell before you light it? What about the smoke?",
      "How did it taste from the first puff to the last?",
      "How did you feel as the effects set in?",
      "How was the draw and burn? Would you pick it again?"
    ],
    'Infused Pre-Roll': [
      "How does the roll look? Is the coating even, if there is one?",
      "What do you smell before lighting it and in the smoke?",
      "Could you taste the flower, the infusion, or both?",
      "How did the infused roll make you feel?",
      "How was the draw, burn, and overall experience?"
    ],
    'Vape Cartridge': [
      "How does the cartridge look? Is the oil clear or cloudy?",
      "What did the vapor smell like?",
      "What flavors came through? Did they stay consistent?",
      "How did you feel after vaping it?",
      "How was the draw? Would you use this cartridge again?"
    ],
    'Disposable Vape': [
      "How does the device look and feel in your hand?",
      "What did the vapor smell like?",
      "How did it taste from one puff to the next?",
      "How did you feel after using it?",
      "How easy was it to use? Would you choose it again?"
    ],
    Concentrate: [
      "How does it look? What stands out about the color or texture?",
      "How does it smell before and during use?",
      "What flavors came through? How was the aftertaste?",
      "How did you feel, and how long did it last?",
      "How was the whole experience? Would you choose it again?"
    ],
    Edible: [
      "How does it look? Does the texture look inviting?",
      "What does it smell like before you take a bite?",
      "How did it taste? What about the aftertaste?",
      "When did you notice the effects, and how long did they last?",
      "How was the edible as a whole? Would you try it again?"
    ],
    Tincture: [
      "How does the liquid look? Is it clear or cloudy?",
      "What do you notice when you open the bottle?",
      "How did it taste? Did the flavor linger?",
      "What did you notice after taking it, and when?",
      "How was it to measure and use? Would you choose it again?"
    ],
    Topical: [
      "How does it look? What’s the texture like?",
      "What does it smell like on your skin?",
      "If taste applies to this product, how was it? Never taste a topical to score it.",
      "How did the area feel after you applied it?",
      "How did it spread and absorb? Would you use it again?"
    ],
    Other: [
      "What stands out about how it looks?",
      "What did it smell like before or during use?",
      "If it has a taste, what flavors did you notice?",
      "What did you notice after using it, and for how long?",
      "How was the whole experience? Would you choose it again?"
    ]
  };
  const PHOTO_BUCKET = 'strain-review-photos';
  let knownStrains = [];
  let ratingStats = [];
  let selectedStrain = null;
  const ALL_FORMATS = 'All formats';
  let formatFilter = ALL_FORMATS;
  let reviewsByMe = [];
  let editingReviewId = null;
  let photoObjectUrl = null;
  let strainLoading = false;
  let strainRefreshPending = false;

  function cleanStrainName(value) { return String(value || '').trim().replace(/\s+/g, ' '); }
  function nameKey(value) { return cleanStrainName(value).toLocaleLowerCase(); }
  function getScoreForm() { return $('rated420-strain-rating-form'); }
  function openStrains(target = 'catalogue') {
    page('strain');
    if (!db) setMessage('strainPageMessage', 'The catalogue is connecting to Supabase. Check your connection if it does not load.', true);
    else void loadStrainCatalogue();
    if (target === 'review') {
      requestAnimationFrame(() => $('rated420-strain-rating-form').scrollIntoView({behavior:'smooth',block:'start'}));
    } else {
      requestAnimationFrame(() => $('rated420-strain-directory-title').scrollIntoView({behavior:'smooth',block:'start'}));
    }
  }

  function makeNode(tag, className = '', contents = '') {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (contents !== '') node.textContent = contents;
    return node;
  }
  function formatCount(n, singular, plural) { return n + ' ' + (n === 1 ? singular : plural); }
function communityReviewLabel(stats) {
  const count = Number(stats?.review_count || 0);
  return count ? `Avg out of ${count} user ${count === 1 ? 'review' : 'reviews'}` : 'Be the first to rate.';
}
function appendCommunityScore(node, stats) {
  node.append(makeNode('strong','community-score', stats && Number(stats.review_count) ? `${Math.round(Number(stats.avg_total))} / 420` : 'Not yet rated'),
    makeNode('small','community-review-count',communityReviewLabel(stats)));
}
  function totalForFormat(strainId, format) {
    return ratingStats.find(s => Number(s.strain_id) === Number(strainId) && s.product_type === (format === ALL_FORMATS ? null : format)) || null;
  }
  function summedReviews(strainId) {
    return Number(totalForFormat(strainId, ALL_FORMATS)?.review_count || 0);
  }

  async function loadStrainCatalogue() {
    if (!db) return;
    if (strainLoading) { strainRefreshPending = true; return; }
    strainLoading = true;
    try {
      const [directory, stats] = await Promise.all([
        db.from('strains').select('id,name,created_at').order('name', {ascending:true}).limit(1000),
        db.from('strain_community_stats').select('*').limit(1000)
      ]);
      if (directory.error) throw directory.error;
      if (stats.error) throw stats.error;
      knownStrains = directory.data || [];
      ratingStats = stats.data || [];
      setMessage('strainPageMessage','');
      renderStrainOptions();
      if (selectedStrain) {
        const now = knownStrains.find(s => Number(s.id) === Number(selectedStrain.id));
        if (now) selectedStrain = now;
        await renderStrainSummary();
      }
    } catch(e) {
      setMessage('strainPageMessage', 'Could not load strain catalogue: ' + (e.message || 'connection unavailable'), true);
    } finally {
      strainLoading = false;
      if (strainRefreshPending) { strainRefreshPending = false; void loadStrainCatalogue(); }
    }
  }

  function renderStrainOptions() {
    const list = $('rated420-strain-options');
    const query = nameKey($('rated420-strain-search').value);
    const filtered = knownStrains.filter(s => nameKey(s.name).includes(query));
    list.replaceChildren();
    $('rated420-strain-count').textContent = `${filtered.length} ${query ? 'MATCHES' : 'STRAINS'}`;
    for (const strain of filtered.slice(0,80)) {
      const button = makeNode('button','strain-option');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(!!selectedStrain && selectedStrain.id === strain.id));
      button.append(document.createTextNode(strain.name));
      appendCommunityScore(button, totalForFormat(strain.id, ALL_FORMATS));
      button.addEventListener('click', () => selectStrain(strain));
      list.append(button);
    }
    if (!filtered.length) list.append(makeNode('p','strain-empty','Not in the catalogue yet. Use this name to add your review.'));
    const exact = knownStrains.some(s => nameKey(s.name) === query);
    const validNew = cleanStrainName($('rated420-strain-search').value).length >= 2;
    $('rated420-strain-use-search').disabled = !validNew;
    $('rated420-strain-use-search').firstChild.textContent = exact ? 'Select this name ' : 'Use this name ';
  }

  function selectStrain(strain) {
    selectedStrain = strain;
    editingReviewId = null;
    $('reviewEditNote').hidden = true;
    $('reviewSaveButton').textContent = 'Save rating →';
    const name = cleanStrainName(strain?.name || '');
    $('rated420-strain-name').value = name;
    $('rated420-strain-selected-text').textContent = name;
    $('rated420-strain-selection').hidden = !name;
    formatFilter = ALL_FORMATS;
    renderStrainOptions();
    void renderStrainSummary();
  }
  function formatControl() {
    const box = $('strainFormatButtons');
    box.replaceChildren();
    const formats = [...$('rated420-strain-product-type').options].map(option => option.value).filter(Boolean);
    const show = [ALL_FORMATS, ...formats];
    for (const label of [...new Set(show)]) {
      const btn = makeNode('button','strain-format-filter__button',label);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(formatFilter === label));
      btn.addEventListener('click', () => {
        formatFilter = label;
        if (label !== ALL_FORMATS) setStrainReviewFormat(label);
        void renderStrainSummary();
      });
      box.append(btn);
    }
  }
  function communityReviewDisclosure(strainId, format, wasOpen) {
    const pageSize = 20;
    const details = makeNode('details', 'community-review-disclosure');
    details.dataset.selection = JSON.stringify([strainId, format]);
    const title = makeNode('summary', '', 'Community Reviews');
    const status = makeNode('p', 'strain-empty');
    status.setAttribute('role', 'status');
    const list = makeNode('ul', 'community-review-list');
    const more = makeNode('button', 'strain-format-filter__button', 'Show more reviews');
    more.type = 'button';
    more.hidden = true;
    details.append(title, status, list, more);
    let offset = 0;
    let loaded = false;
    let loading = false;

    const forSelection = query => {
      query = query.eq('strain_id', strainId);
      return format === ALL_FORMATS ? query : query.eq('product_type', format);
    };
    const updateCount = count => {
      title.textContent = `Community Reviews (${count})`;
    };

    async function loadPage() {
      if (loading) return;
      loading = true;
      more.hidden = true;
      status.textContent = 'Loading community reviews…';
      try {
        const { data, count, error } = await forSelection(db.from('strain_community_reviews')
          .select('total,username,avatar_choice', { count: 'exact' }))
          .order('created_at', { ascending: false }).order('id', { ascending: false })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        if (!details.isConnected) return;
        updateCount(count);
        for (const review of data) {
          const item = makeNode('li', 'community-review-entry');
          const image = makeNode('img');
          image.alt = '';
          const choice = Number(review.avatar_choice);
          image.src = Number.isInteger(choice) && choice >= 1 && choice <= AVATARS.length
            ? avatarImage(choice) : avatarLogo;
          item.append(image, makeNode('span', '', review.username ? '@' + review.username : 'Community member'),
            makeNode('strong', '', `${review.total} / 420`));
          list.append(item);
        }
        offset += data.length;
        loaded = true;
        status.textContent = count ? '' : 'No community reviews yet.';
        more.textContent = 'Show more reviews';
        more.hidden = offset >= count || data.length === 0;
      } catch {
        status.textContent = 'Community reviews could not be loaded.';
        more.textContent = 'Try again';
        more.hidden = false;
      } finally {
        loading = false;
      }
    }

    details.addEventListener('toggle', () => {
      if (details.open && !loaded) void loadPage();
    });
    more.addEventListener('click', loadPage);
    details.open = wasOpen;
    void (async () => {
      try {
        const { count, error } = await forSelection(db.from('strain_reviews')
          .select('id', { count: 'exact', head: true }));
        if (!error && details.isConnected && !loaded) updateCount(count);
      } catch {
        // Opening the section retries with the full list query.
      }
    })();
    return details;
  }

  async function renderStrainSummary() {
    const card = $('rated420-strain-summary');
    if (!selectedStrain?.id) {
      card.hidden = true;
      return;
    }
    card.hidden = false;
    const previousReviews = card.querySelector('.community-review-disclosure');
    const keepReviewsOpen = previousReviews?.open &&
      previousReviews.dataset.selection === JSON.stringify([selectedStrain.id, formatFilter]);
    card.replaceChildren();
    formatControl();
    const allFormats = formatFilter === ALL_FORMATS;
    const summary = totalForFormat(selectedStrain.id, formatFilter);
    const head = makeNode('div','strain-summary-head');
    const title = makeNode('div');
    title.append(makeNode('span','eyebrow', `${formatFilter.toUpperCase()} · COMMUNITY RATINGS`),makeNode('h3','',selectedStrain.name));
    head.append(title);
    head.append(makeNode('strong','strain-avg-total', summary ? `${Math.round(Number(summary.avg_total))} / 420` : 'Not yet rated'));
    card.append(head);
    card.append(makeNode('p','', communityReviewLabel(summary)));
    if (summary) {
      const bars = makeNode('div','strain-avg-categories');
      for (const [field,label] of STRAIN_CATEGORIES) {
        const tile = makeNode('div','strain-avg-category');
        tile.append(makeNode('span','',label),makeNode('strong','',`${Math.round(Number(summary['avg_'+field]))} / 84`));
        bars.append(tile);
      }
      card.append(bars);
    }
    card.append(communityReviewDisclosure(selectedStrain.id, formatFilter, Boolean(keepReviewsOpen)));
    const feed = makeNode('div','recent-strain-reviews');
    card.append(feed);
    try {
      const requestedStrainId = selectedStrain.id;
      const requestedFormat = formatFilter;
      let query = db.from('strain_reviews')
        .select('id,brand,product_type,total,notes,photo_path,created_at')
        .eq('strain_id', selectedStrain.id);
      if (!allFormats) query = query.eq('product_type',requestedFormat);
      const {data,error} = await query.order('created_at',{ascending:false});
      if (error) throw error;
      if (!selectedStrain || Number(selectedStrain.id) !== Number(requestedStrainId) || formatFilter !== requestedFormat) return;
      if (data?.length) {
        feed.append(makeNode('h4','','RECENT EXPERIENCES'));
        for (const item of data) {
          const row = makeNode('article','strain-recent-item');
          const headRow = makeNode('div','strain-recent-title');
          headRow.append(makeNode('strong','',item.brand),makeNode('span','',`${item.total} / 420`));
          row.append(headRow);
          if (item.notes) row.append(makeNode('p','',item.notes));
          if (item.photo_path) {
            const image = makeNode('img','strain-review-thumb');
            image.alt = 'Member-uploaded strain review photo';
            image.loading = 'lazy';
            image.src = db.storage.from(PHOTO_BUCKET).getPublicUrl(item.photo_path).data.publicUrl;
            row.append(image);
          }
          feed.append(row);
        }
      } else {
        feed.append(makeNode('p','strain-empty', allFormats ? 'No reviews yet.' : `No ${requestedFormat} reviews yet.`));
        if (!allFormats) {
          const showAll = makeNode('button','strain-format-filter__button','Show all formats');
          showAll.type = 'button';
          showAll.addEventListener('click', () => {
            formatFilter = ALL_FORMATS;
            void renderStrainSummary();
          });
          feed.append(showAll);
        }
      }
    } catch(e) { feed.append(makeNode('p','strain-empty','Recent reviews could not be loaded.')); }
  }

  function updateScoreTotal(form, categories) {
    let total = 0;
    for (const [field] of categories) {
      const range = form.querySelector(`[name="${field}"]`);
      const value = Number(range.value);
      total += value;
      form.querySelector(`[data-value-for="${field}"]`).textContent = value;
      range.style.setProperty('--fill', (value / 84 * 100) + '%');
    }
    form.querySelector('.total').textContent = String(total);
    form.querySelector('.meter').setAttribute('aria-valuenow',String(total));
    form.querySelector('.meter span').style.width = `${total / 420 * 100}%`;
  }
  function setStrainReviewFormat(format) {
    $('rated420-strain-product-type').value = format;
    const guidance = STRAIN_SCORE_GUIDANCE[format] || STRAIN_SCORE_GUIDANCE.Other;
    getScoreForm().querySelectorAll('.rating-guidance').forEach((description, index) => {
      description.textContent = guidance[index];
    });
  }

  function buildScoreSliders(form, categories, guidance) {
    const sliders = form.querySelector('.sliders');
    sliders.replaceChildren();
    for (const [index, [field, label]] of categories.entries()) {
      const wrapper = makeNode('div','rating-row');
      const heading = makeNode('div','rating-heading');
      const caption = makeNode('label','',label);
      const id = form.id + '_' + field;
      caption.htmlFor = id;
      const number = makeNode('span');
      const output = makeNode('output','', '0');
      output.dataset.valueFor = field;
      output.htmlFor = id;
      number.append(output,document.createTextNode(' / 84'));
      heading.append(caption,number);
      const slider = document.createElement('input');
      slider.id=id;slider.type='range';slider.name=field;slider.min='0';slider.max='84';slider.step='1';slider.value='0';
      slider.addEventListener('input', () => updateScoreTotal(form, categories));
      const description = makeNode('p', 'rating-guidance', guidance[index]);
      description.id = id + '-guidance';
      slider.setAttribute('aria-describedby', description.id);
      wrapper.append(heading, slider, description);
      sliders.append(wrapper);
    }
    updateScoreTotal(form, categories);
  }

  function resetStrainPhotoPreview() {
    if (photoObjectUrl) URL.revokeObjectURL(photoObjectUrl);
    photoObjectUrl = null;
    $('rated420-strain-preview').hidden = true;
    $('rated420-strain-preview').removeAttribute('src');
  }
  function onPhotoSelection() {
    resetStrainPhotoPreview();
    const file = $('rated420-strain-photo').files[0];
    if (!file) return;
    if (file.size > 5*1024*1024 || !['image/jpeg','image/png','image/webp'].includes(file.type)) {
      $('rated420-strain-photo').value = '';
      setMessage('strainReviewMessage','Use a JPG, PNG, or WebP image under 5 MB.',true);
      return;
    }
    setMessage('strainReviewMessage','');
    photoObjectUrl = URL.createObjectURL(file);
    $('rated420-strain-preview').src = photoObjectUrl;
    $('rated420-strain-preview').hidden = false;
  }
  async function uploadPhoto(bucket, file, memberId) {
    const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
    if (!ext || file.size > 5*1024*1024) throw new Error('Upload a JPG, PNG, or WebP image up to 5 MB.');
    const path = `${memberId}/${crypto.randomUUID()}.${ext}`;
    const {error} = await db.storage.from(bucket).upload(path,file,{upsert:false,contentType:file.type});
    if (error) throw error;
    return path;
  }
  async function ensureStrain(name) {
    let strain = knownStrains.find(s => nameKey(s.name) === nameKey(name));
    if (strain) return strain;
    const {data,error} = await db.from('strains').insert({name,created_by:user.id})
      .select('id,name,created_at').single();
    if (!error) return data;
    if (error.code !== '23505') throw error;
    // Another member may have submitted this same strain moments before us.
    const {data:latest,error:lookupError} = await db.from('strains').select('id,name,created_at').limit(1000);
    if (lookupError) throw lookupError;
    strain = latest.find(s => nameKey(s.name) === nameKey(name));
    if (!strain) throw new Error('This strain has just been added by someone else. Refresh and try again.');
    return strain;
  }

  async function saveStrainReview(event) {
    event.preventDefault();
    const form=getScoreForm();
    if (!form.reportValidity()) return;
    if (!db || !user) {
      setMessage('strainReviewMessage','Please sign in to submit your score. Your entries will stay in the form.',true);
      if (db) showAuth('login');
      return;
    }
    const name = cleanStrainName($('rated420-strain-name').value);
    const brand = cleanStrainName($('rated420-strain-brand').value);
    if (name.length < 2 || name.length > 100 || !/[a-z0-9]/i.test(name)) return setMessage('strainReviewMessage','Strain name must have 2–100 characters.',true);
    if (brand.length < 2 || brand.length > 100) return setMessage('strainReviewMessage','Brand or producer must have 2–100 characters.',true);
    const scores = Object.fromEntries(STRAIN_CATEGORIES.map(([f])=>[f,Number(form.elements.namedItem(f).value)]));
    const type = $('rated420-strain-product-type').value;
    const notes = $('rated420-strain-notes').value.trim();
    const file = $('rated420-strain-photo').files[0];
    const btn = $('reviewSaveButton');
    btn.disabled = true;
    btn.textContent = 'Saving your rating…';
    setMessage('strainReviewMessage','');
    let uploaded = null;
    try {
      const strain = await ensureStrain(name);
      const {data:existing,error:readError} = await db.from('strain_reviews')
        .select('id,photo_path').eq('user_id',user.id).eq('strain_id',strain.id)
        .eq('brand_key',brand.toLowerCase()).eq('product_type',type).maybeSingle();
      if (readError) throw readError;
      if (file) uploaded = await uploadPhoto(PHOTO_BUCKET, file, user.id);
      const payload = {...scores,brand,product_type:type,notes,
        photo_path:uploaded || (existing?.photo_path || null)};
      let result;
      if (existing) {
        result = await db.from('strain_reviews').update({...payload,updated_at:new Date().toISOString()})
          .eq('id',existing.id).eq('user_id',user.id).select('id,total').single();
      } else {
        result = await db.from('strain_reviews').insert({strain_id:strain.id,user_id:user.id,...payload})
          .select('id,total').single();
      }
      if (result.error) throw result.error;
      const previousPath=existing?.photo_path;
      if (uploaded && previousPath && previousPath !== uploaded) {
        void db.storage.from(PHOTO_BUCKET).remove([previousPath]);
      }
      selectedStrain=strain;
      formatFilter=type;
      editingReviewId=null;
      await loadStrainCatalogue();
      await loadMyStrainReviews();
      $('reviewEditNote').hidden = true;
      setMessage('strainReviewMessage',`Your ${result.data.total}/420 rating is saved to Rated420. ${existing ? 'Your previous rating for this brand and format was updated.' : 'Welcome to the catalogue!'}`);
      form.reset();
      $('rated420-strain-name').value=strain.name;
      setStrainReviewFormat(type);
      resetStrainPhotoPreview();
      updateScoreTotal(getScoreForm(), STRAIN_CATEGORIES);
      $('reviewSaveButton').textContent='Save rating →';
      await renderStrainSummary();
      toast('Your strain rating is live!');
    } catch(e) {
      if (uploaded) void db.storage.from(PHOTO_BUCKET).remove([uploaded]);
      let message = e?.message || 'Could not save your review.';
      if (e?.code === '23505') message = 'A review already exists for this strain, brand, and product type. Reload your catalogue and try again.';
      setMessage('strainReviewMessage', message,true);
    } finally {btn.disabled=false;btn.textContent='Save rating →';}
  }

  async function loadMyStrainReviews() {
    const target=$('myStrainReviewList');
    if (!target || !db || !user) { if(target)target.replaceChildren(makeNode('p','strain-empty','Sign in to view your reviews.'));return; }
    const {data,error} = await db.from('strain_reviews')
      .select('id,strain_id,brand,product_type,aesthetic,aroma,flavor,effects,overall,total,notes,photo_path,created_at')
      .eq('user_id',user.id).order('created_at',{ascending:false}).limit(100);
    if (error) {target.replaceChildren(makeNode('p','strain-empty',error.message));return;}
    reviewsByMe=data||[];
    target.replaceChildren();
    if (!data.length) { target.append(makeNode('p','strain-empty','No strain ratings yet. Your first review will appear here.'));return; }
    for(const review of data) {
      const strain=knownStrains.find(x=>Number(x.id)===Number(review.strain_id));
      const row=makeNode('article','member-review-item');
      const header=makeNode('div','member-review-title');
      const side=makeNode('div');
      side.append(makeNode('h4','',strain?.name||'Strain'),makeNode('p','',`${review.brand} · ${review.product_type}`));
      header.append(side,makeNode('strong','',`${review.total}/420`));
      const actions=makeNode('div','member-review-actions');
      const edit=makeNode('button','btn btn-outline','Edit rating');edit.type='button';edit.addEventListener('click',()=>editMyReview(review));
      const remove=makeNode('button','btn btn-outline','Delete');remove.type='button';remove.addEventListener('click',()=>deleteMyReview(review));
      actions.append(edit,remove);
      row.append(header,actions);
      target.append(row);
    }
  }
  function editMyReview(review) {
    const strain=knownStrains.find(s=>Number(s.id)===Number(review.strain_id));
    if (!strain) return toast('Reload the catalogue first to edit that review.');
    selectStrain(strain);
    editingReviewId=review.id;
    $('rated420-strain-brand').value=review.brand;
    setStrainReviewFormat(review.product_type);
    $('rated420-strain-notes').value=review.notes||'';
    STRAIN_CATEGORIES.forEach(([f])=> {getScoreForm().elements.namedItem(f).value=review[f];});
    formatFilter=review.product_type;
    $('reviewSaveButton').textContent='Update rating →';
    $('reviewEditNote').textContent='Editing your rating. Saving with the same producer and format updates the existing review.';
    $('reviewEditNote').hidden=false;
    updateScoreTotal(getScoreForm(), STRAIN_CATEGORIES);
    openStrains('review');
  }
  async function deleteMyReview(review) {
    if (!db || !user) return;
    if (!window.confirm('Delete this strain rating from Rated420? This cannot be undone.')) return;
    const {error} = await db.from('strain_reviews').delete().eq('id',review.id).eq('user_id',user.id);
    if (error) return toast(error.message||'Unable to delete review.');
    if (review.photo_path) void db.storage.from(PHOTO_BUCKET).remove([review.photo_path]);
    await loadStrainCatalogue();
    await loadMyStrainReviews();
    toast('Strain rating deleted.');
  }

  buildScoreSliders(getScoreForm(), STRAIN_CATEGORIES, STRAIN_SCORE_GUIDANCE.Flower);
  setStrainReviewFormat($('rated420-strain-product-type').value);
  $('rated420-strain-search').addEventListener('input',renderStrainOptions);
  $('rated420-strain-use-search').addEventListener('click',()=>{
    const typed=cleanStrainName($('rated420-strain-search').value);
    if (typed.length<2) return;
    selectStrain(knownStrains.find(s=>nameKey(s.name)===nameKey(typed)) || {id:null,name:typed});
  });
  $('rated420-strain-continue').addEventListener('click',()=>getScoreForm().scrollIntoView({behavior:'smooth',block:'start'}));
  $('rated420-strain-product-type').addEventListener('change',()=>{
    formatFilter=$('rated420-strain-product-type').value;
    setStrainReviewFormat(formatFilter);
    void renderStrainSummary();
  });
  $('rated420-strain-name').addEventListener('input',()=>{
    if (editingReviewId) {editingReviewId=null;$('reviewEditNote').hidden=true;$('reviewSaveButton').textContent='Save rating →';}
  });
  $('rated420-strain-photo').addEventListener('change',onPhotoSelection);
  $('rated420-strain-rating-form').addEventListener('submit',saveStrainReview);
  document.querySelectorAll('[data-open-strains]').forEach(button=>button.addEventListener('click',event=>{
    event.preventDefault();openStrains(button.dataset.openStrains||'catalogue');
  }));

  const AVATAR_BUCKET = 'member-avatars';
  const DISPENSARY_BUCKET = 'dispensary-review-photos';
  const AVATARS = [
    ['7️⃣', 'Lucky Seven', '#283c25'],
    ['🌿', 'Herb', '#264937'],
    ['🍋', 'Lemon Haze', '#5d4d20'],
    ['💨', 'Cloud', '#384660'],
    ['🍪', 'Cookie', '#65442b']
  ];
  const DISPENSARY_CATEGORIES = [
    ['aesthetic', 'Aesthetic'], ['accessibility', 'Accessibility'],
    ['staff', 'Staff'], ['menu', 'Menu'], ['overall', 'Overall']
  ];
  const dispensaryForm = $('dispensaryForm');
  const dispensaryFields = dispensaryForm.elements;
  let editingDispensary = null;
  let dispensaryPreviewUrl = null;
  let avatarPreviewUrl = null;

  function avatarImage(index) {
    const [icon, , color] = AVATARS[index - 1];
    const markup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<circle cx="50" cy="50" r="50" fill="' + color + '"/>' +
      '<text x="50" y="66" text-anchor="middle" font-size="48">' + icon + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  }

  const avatarLogo = 'rated420-logo.png';
  const memberAvatar = $('memberAvatar');

  function showAvatar(src) {
    memberAvatar.classList.toggle('is-logo', !src);
    memberAvatar.src = src || avatarLogo;
  }

  memberAvatar.addEventListener('error', () => {
    if (memberAvatar.getAttribute('src') !== avatarLogo) showAvatar();
  });

  async function fillAvatar() {
    const form = $('profileForm');
    const memberId = user?.id;
    const path = profile?.avatar_path;
    const choice = profile?.avatar_choice;
    form.elements.avatar.value = path ? 'upload' : String(choice || '');
    $('avatarFile').value = '';
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    avatarPreviewUrl = null;
    showAvatar(choice ? avatarImage(choice) : null);
    if (!path) return;
    const { data } = await db.storage.from(AVATAR_BUCKET).createSignedUrl(path, 3600);
    if (user?.id === memberId && profile?.avatar_path === path &&
        form.elements.avatar.value === 'upload' && !$('avatarFile').files.length) {
      showAvatar(data?.signedUrl);
    }
  }

  AVATARS.forEach(([, name], index) => {
    const label = makeNode('label');
    const input = makeNode('input');
    input.type = 'radio';
    input.name = 'avatar';
    input.value = String(index + 1);
    const image = makeNode('img');
    image.src = avatarImage(index + 1);
    image.alt = name;
    label.title = name;
    label.append(input, image);
    $('avatarOptions').append(label);
  });

  $('profileForm').addEventListener('change', event => {
    const fileInput = $('avatarFile');
    const options = $('profileForm').elements.avatar;
    if (event.target === fileInput && fileInput.files.length) options.value = 'upload';
    if (event.target !== fileInput && event.target.name !== 'avatar') return;
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    avatarPreviewUrl = null;
    if (options.value === 'upload' && fileInput.files.length) {
      avatarPreviewUrl = URL.createObjectURL(fileInput.files[0]);
      showAvatar(avatarPreviewUrl);
    } else if (options.value === 'upload' && profile?.avatar_path) {
      void fillAvatar();
    } else {
      showAvatar(Number(options.value) ? avatarImage(Number(options.value)) : null);
    }
  });

  let dispensaryListings = [];
  let dispensaryStats = [];
  let selectedDispensaryId = null;
  let dispensaryLoading = false;
  let dispensaryRefreshPending = false;
async function loadDispensaryCatalogue() {
  if (!db) return;
  if (dispensaryLoading) { dispensaryRefreshPending = true; return; }
  dispensaryLoading = true;
  try {
    const [listings,stats] = await Promise.all([
      db.from('dispensaries').select('id,name,location').order('name').limit(1000),
      db.from('dispensary_community_stats').select('*').limit(1000)
    ]);
    if (listings.error || stats.error) throw new Error('Community ratings could not be loaded.');
    dispensaryListings = listings.data || [];
    dispensaryStats = stats.data || [];
    $('dispensaryCatalogueMessage').textContent = '';
    renderDispensaryCatalogue();
    renderDispensarySummary();
  } catch {
    $('dispensaryCatalogueMessage').textContent = 'Community ratings could not be loaded. Please try again.';
  } finally {
    dispensaryLoading = false;
    if (dispensaryRefreshPending) { dispensaryRefreshPending = false; void loadDispensaryCatalogue(); }
  }
}
function renderDispensaryCatalogue() {
  const box = $('dispensaryOptions');
  const search = nameKey($('dispensarySearch').value);
  box.replaceChildren();
  const listings = dispensaryListings.filter(d => nameKey(d.name + ' ' + d.location).includes(search));
  for (const listing of listings) {
    const button = makeNode('button','strain-option',listing.name + ' · ' + listing.location);
    button.type = 'button';
    button.setAttribute('aria-pressed',String(Number(listing.id) === selectedDispensaryId));
    appendCommunityScore(button,dispensaryStats.find(s => Number(s.dispensary_id) === Number(listing.id)));
    button.addEventListener('click', () => {
      selectedDispensaryId = Number(listing.id);
      dispensaryFields.namedItem('name').value = listing.name;
      dispensaryFields.location.value = listing.location;
      renderDispensaryCatalogue();
      renderDispensarySummary();
    });
    box.append(button);
  }
  if (!listings.length) box.append(makeNode('p','strain-empty', search ? 'No matching dispensaries.' : 'No dispensaries listed yet. Add one with your first review.'));
}
function renderDispensarySummary() {
  const box = $('dispensaryCommunitySummary');
  const listing = dispensaryListings.find(d => Number(d.id) === selectedDispensaryId);
  box.hidden = !listing;
  box.replaceChildren();
  if (!listing) return;
  const stats = dispensaryStats.find(d => Number(d.dispensary_id) === selectedDispensaryId);
  box.append(makeNode('h2','',listing.name + ' · ' + listing.location));
  appendCommunityScore(box,stats);
  if (stats) {
    const categories = makeNode('div','strain-avg-categories');
    for (const [field,label] of DISPENSARY_CATEGORIES) {
      const category = makeNode('div','strain-avg-category');
      category.append(makeNode('span','',label),makeNode('strong','',`${Math.round(Number(stats['avg_'+field]))} / 84`));
      categories.append(category);
    }
    box.append(categories);
  }
}
async function ensureDispensary(name,location) {
  const selected = dispensaryListings.find(d => Number(d.id) === selectedDispensaryId);
  if (selected && nameKey(selected.name) === nameKey(name) && nameKey(selected.location) === nameKey(location)) return selected;
  const {data,error} = await db.from('dispensaries').select('id,name,location')
    .eq('name_key',name.toLowerCase()).eq('location_key',location.toLowerCase()).maybeSingle();
  if (error) throw error;
  if (data) return data;
  const added = await db.from('dispensaries').insert({name,location}).select('id,name,location').single();
  if (!added.error) return added.data;
  if (added.error.code !== '23505') throw added.error;
  const retried = await db.from('dispensaries').select('id,name,location')
    .eq('name_key',name.toLowerCase()).eq('location_key',location.toLowerCase()).single();
  if (retried.error) throw retried.error;
  return retried.data;
}
  function updateDispensaryPreview() {
    if (dispensaryPreviewUrl) URL.revokeObjectURL(dispensaryPreviewUrl);
    dispensaryPreviewUrl = null;
    const file = dispensaryFields.photo.files[0];
    const path = editingDispensary?.photo_path;
    let src;
    if (file) {
      dispensaryPreviewUrl = URL.createObjectURL(file);
      src = dispensaryPreviewUrl;
    } else if (path && !dispensaryFields.removePhoto.checked) {
      src = db.storage.from(DISPENSARY_BUCKET).getPublicUrl(path).data.publicUrl;
    }
    const preview = $('dispensaryPhotoPreview');
    if (src) preview.src = src;
    else preview.removeAttribute('src');
    preview.hidden = !src;
  }

  function resetDispensaryForm(review = null) {
    editingDispensary = review;
    dispensaryForm.reset();
    if (review?.dispensary_id) {
      selectedDispensaryId = Number(review.dispensary_id);
      void loadDispensaryCatalogue();
    }
    if (review) {
      for (const field of ['name', 'location', 'notes', ...DISPENSARY_CATEGORIES.map(([key]) => key)]) {
        dispensaryFields.namedItem(field).value = review[field];
      }
    }
    updateScoreTotal(dispensaryForm, DISPENSARY_CATEGORIES);
    updateDispensaryPreview();
    $('removeDispensaryPhoto').hidden = !review?.photo_path;
    $('cancelDispensaryEdit').hidden = !review;
    $('saveDispensary').textContent = review ? 'Update rating →' : 'Save rating →';
    $('saveDispensary').dataset.original = $('saveDispensary').innerHTML;
    setMessage('dispensaryMessage', '');
  }

  async function loadDispensaryReviews(own = false) {
    const list = $(own ? 'myDispensaryReviewList' : 'recentDispensaryReviews');
    if (!db || (own && !user)) {
      list.replaceChildren(makeNode('p', '', 'Connect to load reviews.'));
      return;
    }
    const memberId = user?.id;
    let query = db.from('dispensary_reviews')
      .select('id, dispensary_id, name, location, aesthetic, accessibility, staff, menu, overall, total, notes, photo_path, created_at')
      .order('created_at', { ascending: false });
    query = own ? query.eq('user_id', memberId) : query.limit(12);
    const { data, error } = await query;
    if (own && user?.id !== memberId) return;
    list.replaceChildren();
    if (error || !data.length) {
      list.append(makeNode('p', '', error ? 'Could not load dispensary reviews.' : 'No dispensary reviews yet.'));
      return;
    }
    for (const review of data) {
      const card = makeNode('article', 'strain-recent-item');
      const title = makeNode('div', 'strain-recent-title');
      title.append(makeNode('strong', '', review.name + ' · ' + review.location),
        makeNode('span', '', review.total + ' / 420'));
      card.append(title);
      if (review.notes) card.append(makeNode('p', '', review.notes));
      if (review.photo_path) {
        const image = makeNode('img', 'strain-review-thumb');
        image.src = db.storage.from(DISPENSARY_BUCKET).getPublicUrl(review.photo_path).data.publicUrl;
        image.loading = 'lazy';
        image.alt = 'Photo from ' + review.name;
        card.append(image);
      }
      if (own) {
        const actions = makeNode('div', 'review-actions');
        const edit = makeNode('button', 'btn btn-outline', 'Edit');
        const remove = makeNode('button', 'btn btn-outline', 'Delete');
        edit.addEventListener('click', () => {
          resetDispensaryForm(review);
          page('dispensary');
          void loadDispensaryReviews();
        });
        remove.addEventListener('click', async () => {
          if (!confirm('Delete this dispensary review?')) return;
          remove.disabled = true;
          const { error } = await db.from('dispensary_reviews').delete().eq('id', review.id).eq('user_id', memberId);
          if (error) {
            toast('Could not delete the review.');
            remove.disabled = false;
            return;
          }
          if (review.photo_path) void db.storage.from(DISPENSARY_BUCKET).remove([review.photo_path]);
          if (editingDispensary?.id === review.id) resetDispensaryForm();
          void loadDispensaryReviews(true);
          void loadDispensaryReviews();
          void loadDispensaryCatalogue();
          toast('Dispensary review deleted.');
        });
        actions.append(edit, remove);
        card.append(actions);
      }
      list.append(card);
    }
  }

  async function saveDispensaryReview(event) {
    event.preventDefault();
    if (!db || !user) {
      toast('Log in to save your dispensary rating.');
      showAuth('login');
      return;
    }
    const memberId = user.id;
    const previous = editingDispensary;
    const row = {
      name: cleanStrainName(dispensaryFields.namedItem('name').value),
      location: cleanStrainName(dispensaryFields.location.value),
      notes: dispensaryFields.notes.value.trim()
    };
    if (row.name.length < 2 || row.location.length < 2) {
      return setMessage('dispensaryMessage', 'Enter a dispensary name and location.', true);
    }
    for (const [field] of DISPENSARY_CATEGORIES) row[field] = Number(dispensaryFields[field].value);
    setMessage('dispensaryMessage', '');
    setBusy(dispensaryForm, true);
    $('cancelDispensaryEdit').disabled = true;
    let uploaded = null;
    try {
      const listing = await ensureDispensary(row.name, row.location);
      row.dispensary_id = listing.id;
      row.name = listing.name; row.location = listing.location;
      const {data:existing,error:lookupError} = await db.from('dispensary_reviews').select('id,photo_path').eq('dispensary_id',listing.id).eq('user_id',memberId).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing && previous && existing.id !== previous.id) throw new Error('You already reviewed this listing. Edit that review in My account.');
      const target = previous || existing;
      const file = dispensaryFields.photo.files[0];
      if (file) uploaded = await uploadPhoto(DISPENSARY_BUCKET, file, memberId);
      row.photo_path = uploaded || (dispensaryFields.removePhoto.checked ? null : target?.photo_path || null);
      const table = db.from('dispensary_reviews');
      const query = target ? table.update(row).eq('id', target.id).eq('user_id', memberId) : table.insert(row);
      const { error } = await query.select('id').single();
      if (error) throw error;
      if (target?.photo_path && target.photo_path !== row.photo_path) {
        void db.storage.from(DISPENSARY_BUCKET).remove([target.photo_path]);
      }
      resetDispensaryForm();
      setMessage('dispensaryMessage', 'Dispensary rating saved.');
      void loadDispensaryReviews();
      void loadDispensaryCatalogue();
    } catch (error) {
      if (uploaded) void db.storage.from(DISPENSARY_BUCKET).remove([uploaded]);
      setMessage('dispensaryMessage', error.code === '23505'
        ? 'You already reviewed this location. Edit your review in My account.'
        : error.message || 'Could not save your rating.', true);
    } finally {
      setBusy(dispensaryForm, false);
      $('cancelDispensaryEdit').disabled = false;
      $('cancelDispensaryEdit').hidden = !editingDispensary;
    }
  }

  $('dispensarySearch').addEventListener('input',renderDispensaryCatalogue);
  buildScoreSliders(dispensaryForm, DISPENSARY_CATEGORIES, [
    "How did the shop look and feel inside?",
    "How easy was it to get there, get in, and find your way around?",
    "Were the staff welcoming and helpful?",
    "How was the selection? Was it easy to find what you wanted?",
    "How was the visit as a whole? Would you go back?"
  ]);
  document.querySelectorAll('[data-open-dispensary]').forEach(button => button.addEventListener('click', () => {
    page('dispensary');
    void loadDispensaryReviews();
    void loadDispensaryCatalogue();
  }));
  dispensaryForm.addEventListener('submit', saveDispensaryReview);
  dispensaryFields.photo.addEventListener('change', updateDispensaryPreview);
  dispensaryFields.removePhoto.addEventListener('change', updateDispensaryPreview);
  $('cancelDispensaryEdit').addEventListener('click', () => resetDispensaryForm());

function refreshCommunityScores() {
  if (!db || document.hidden || !isAgeAccepted()) return;
  if (currentPage === 'strain') void loadStrainCatalogue();
  if (currentPage === 'dispensary') void loadDispensaryCatalogue();
}
  window.addEventListener('focus',refreshCommunityScores);
  document.addEventListener('visibilitychange',refreshCommunityScores);
  window.setInterval(refreshCommunityScores,30000);

  // Navigation and forms
  $('ageYes').addEventListener('click', acceptAge);
  $('ageNo').addEventListener('click', denyAge);
  $('navLogin').addEventListener('click', () => showAuth('login'));
  document.querySelectorAll('[data-open-contact]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault();
    page('contact');
    $('contactTitle').focus({ preventScroll: true });
    window.dispatchEvent(new Event('rated420:contact-open'));
  }));
  [$('navJoin'), $('bottomJoin')].forEach(btn => btn.addEventListener('click', () => showAuth('signup')));
  $('heroJoin').addEventListener('click', () => user ? openStrains('review') : showAuth('signup'));
  $('navAccount').addEventListener('click', () => page('account'));
  $('accountSignOut').addEventListener('click', signOut);
  $('tabLogin').addEventListener('click', () => setMode('login'));
  $('tabSignup').addEventListener('click', () => setMode('signup'));
  $('forgotLink').addEventListener('click', () => setMode('forgot'));
  document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => setMode(btn.dataset.mode)));
  document.querySelectorAll('[data-go-home], [data-home]').forEach(btn => btn.addEventListener('click', e => { e.preventDefault(); home(); }));
  $('brandLink').addEventListener('click', e => { e.preventDefault(); home(); });
  document.querySelectorAll('[data-section]').forEach(link => link.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    home();
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior:'smooth', block:'start' }));
  }));
  $('loginForm').addEventListener('submit', login);
  $('signupForm').addEventListener('submit', signup);
  $('forgotForm').addEventListener('submit', forgot);
  $('resetForm').addEventListener('submit', reset);
  $('profileForm').addEventListener('submit', saveProfile);
  $('strainMyReviewsButton').addEventListener('click', () => user ? page('account') : showAuth('login'));
  $('footerAgeNote').addEventListener('click', () => toast('Rated420 uses 21+ self-attestation. No age documents are collected in this build.'));
  $('year').textContent = String(new Date().getFullYear());
  updateNav();
  if (isAgeAccepted()) acceptAge();
  else { $('ageGate').hidden = false; $('ageYes').focus(); }
})();


  const navCatalogue = document.getElementById('navCatalogue');
  navCatalogue.querySelectorAll('a, button').forEach(item => item.addEventListener('click', () => {
    navCatalogue.open = false;
  }));
  document.addEventListener('click', event => {
    if (!navCatalogue.contains(event.target)) navCatalogue.open = false;
  });
  navCatalogue.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navCatalogue.open) {
      navCatalogue.open = false;
      navCatalogue.querySelector('summary').focus();
    }
  });
