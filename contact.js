/* Contact form: public configuration only. No submission data is persisted in the browser. */
(() => {
  'use strict';
  const form = document.getElementById('contactForm');
  const category = document.getElementById('contactCategory');
  const business = document.getElementById('contactBusiness');
  const status = document.getElementById('contactFormStatus');
  const submit = document.getElementById('contactSubmit');
  const success = document.getElementById('contactSuccess');
  let siteKey = document.querySelector('meta[name="contact-turnstile-site-key"]').content.trim();
  const endpoint = 'https://ymluyoqkmzxomjokjmkj.supabase.co/functions/v1/submit-contact';
  let widget = null;
  let token = '';
  let loading = false;
  let busy = false;
  let requestId = null;
  let configuration = null;

  function message(text) {
    status.textContent = text;
    status.hidden = !text;
    status.classList.toggle('is-error', !!text);
  }

  function businessFields() {
    const applicable = ['filming', 'partnership'].includes(category.value);
    business.hidden = !applicable;
    business.disabled = !applicable;
  }

  function renderChallenge() {
    if (!window.turnstile || widget !== null || document.getElementById('contactPage').hidden || form.hidden) return;
    widget = window.turnstile.render('#contactChallenge', {
      sitekey: siteKey, theme: 'dark', size: 'flexible', action: 'contact', 'response-field': false,
      callback: value => { token = value; },
      'expired-callback': () => { token = ''; },
      'error-callback': () => { token = ''; message('Spam protection could not load. Check your connection and try again.'); }
    });
  }

  async function loadChallenge() {
    if (!siteKey) {
      try {
        configuration ||= fetch(endpoint + '/config', { credentials: 'omit', signal: AbortSignal.timeout(8000) })
          .then(response => response.ok ? response.json() : null);
        const config = await configuration;
        if (!config?.ready || typeof config.site_key !== 'string' || !config.site_key) throw new Error();
        siteKey = config.site_key;
      } catch {
        configuration = null;
        message('Contact submissions are not available yet. Please try again later.');
        return;
      }
    }
    if (window.turnstile) return renderChallenge();
    if (loading) return;
    loading = true;
    window.rated420ContactChallengeReady = renderChallenge;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=rated420ContactChallengeReady&render=explicit';
    script.async = true;
    script.onerror = () => {
      loading = false;
      script.remove();
      message('Spam protection could not load. Check your connection and reopen Contact Us to try again.');
    };
    document.head.append(script);
  }

  function resetChallenge() {
    token = '';
    if (window.turnstile && widget !== null) window.turnstile.reset(widget);
  }

  category.addEventListener('change', businessFields);
  form.addEventListener('input', () => { if (!busy) requestId = null; });
  window.addEventListener('rated420:contact-open', loadChallenge);
  businessFields();
  submit.disabled = false;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    message('');
    if (!siteKey) {
      message('Contact submissions are not available yet. Please try again later.');
      status.focus();
      return;
    }
    if (!token) {
      message('Please complete the spam protection check before sending your message.');
      loadChallenge();
      status.focus();
      return;
    }
    const allowedFields = new Set(['full_name','email','category','company','company_location','website','telephone','subject','message','company_fax']);
    const data = Object.fromEntries([...new FormData(form)].filter(([key]) => allowedFields.has(key)));
    for (const key of Object.keys(data)) data[key] = String(data[key]).trim();
    requestId ||= crypto.randomUUID();
    const payload = { ...data, request_id: requestId, turnstile_token: token };
    busy = true;
    const controls = [...form.querySelectorAll('input,select,textarea,button')].map(control => [control, control.disabled]);
    controls.forEach(([control]) => { control.disabled = true; });
    submit.disabled = true;
    submit.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal, credentials: 'omit'
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || result?.success !== true) {
        const text = response.status === 429 ? 'We’re receiving too many messages right now. Please wait a few minutes and try again.'
          : response.status === 400 ? 'Please check your details and complete a fresh spam protection check.'
          : 'We couldn’t confirm delivery. Your entries are still here. Please wait before trying again.';
        throw new Error(text);
      }
      form.reset();
      businessFields();
      requestId = null;
      form.hidden = true;
      success.hidden = false;
      const reference = document.getElementById('contactReference');
      reference.hidden = !/^[0-9a-f-]{36}$/i.test(result.reference || '');
      reference.textContent = reference.hidden ? '' : 'Your reference: ' + result.reference;
      document.getElementById('contactSuccessTitle').focus();
    } catch (error) {
      message(error.name === 'AbortError'
        ? 'We couldn’t confirm delivery in time. Your entries are still here. Please wait before trying again.'
        : error instanceof TypeError ? 'We couldn’t connect. Your entries are still here. Check your connection before trying again.'
        : error.message);
      status.focus();
    } finally {
      window.clearTimeout(timeout);
      resetChallenge();
      busy = false;
      controls.forEach(([control, disabled]) => { control.disabled = disabled; });
      submit.disabled = false;
      submit.replaceChildren(document.createTextNode('Send message '));
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      submit.append(arrow);
      form.removeAttribute('aria-busy');
    }
  });

  document.getElementById('contactAgain').addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    message('');
    loadChallenge();
    document.getElementById('contactName').focus();
  });
})();
