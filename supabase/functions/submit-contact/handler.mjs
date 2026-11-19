const CATEGORIES = new Map([
  ['general', 'General Questions & Comments'], ['feedback', 'Suggestions & Feedback'],
  ['correction', 'Strain & Dispensary Catalogue Corrections'], ['filming', 'Filming & Interview Invitations'],
  ['partnership', 'Business Partnerships & Collaborations'], ['other', 'Other']
]);
const ORIGINS = new Set([
  'https://rated420ny.com', 'https://www.rated420ny.com', 'https://rated420-staging.vercel.app',
  'https://rated420-staging-git-codex-contact-us-shenendoahts-projects.vercel.app'
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 32768;
const encoder = new TextEncoder();

class Invalid extends Error { constructor(status = 400) { super('Invalid request'); this.status = status; } }
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
const digest = value => crypto.subtle.digest('SHA-256', encoder.encode(value));

export function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Invalid();
  const fields = {};
  const limits = { full_name:[2,120], email:[3,254], category:[1,30], company:[0,160], subject:[2,160],
    message:[10,5000], company_location:[0,200], website:[0,2048], telephone:[0,40] };
  const allowed = new Set([...Object.keys(limits), 'request_id', 'turnstile_token', 'company_fax']);
  if (Object.keys(data).some(k => !allowed.has(k))) throw new Invalid();
  for (const [key,[min,max]] of Object.entries(limits)) {
    if (data[key] !== undefined && typeof data[key] !== 'string') throw new Invalid();
    if (key !== 'message' && /[\u0000-\u001f\u007f]/.test(data[key] || '')) throw new Invalid();
    const value = (data[key] || '').trim();
    if (value.length < min || value.length > max || /\u0000/.test(value)) throw new Invalid();
    if (key !== 'message' && /[\u0000-\u001f\u007f]/.test(value)) throw new Invalid();
    fields[key] = value || null;
  }
  if (!CATEGORIES.has(fields.category) || !/^[^\s@<>(),;:"\\]+@[^\s@<>(),;:"\\]+\.[^\s@<>(),;:"\\]+$/.test(fields.email)) throw new Invalid();
  if (!['filming','partnership'].includes(fields.category)) {
    if (fields.company_location || fields.website || fields.telephone) throw new Invalid();
  }
  if (fields.website) {
    let url; try { url = new URL(fields.website); } catch { throw new Invalid(); }
    if (!['https:','http:'].includes(url.protocol) || url.username || url.password) throw new Invalid();
  }
  if (!UUID.test(data.request_id || '') || typeof data.turnstile_token !== 'string' || !data.turnstile_token || data.turnstile_token.length > 2048) throw new Invalid();
  if (typeof data.company_fax !== 'undefined' && (typeof data.company_fax !== 'string' || data.company_fax.trim())) throw new Invalid();
  return fields;
}

async function readJSON(req) {
  if (!(req.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw new Invalid(415);
  if (Number(req.headers.get('content-length')) > MAX_BODY) throw new Invalid(413);
  const reader = req.body?.getReader();
  if (!reader) throw new Invalid();
  const chunks = []; let length = 0;
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    length += value.length;
    if (length > MAX_BODY) { await reader.cancel(); throw new Invalid(413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Invalid(); }
}

export function notificationBody(row) {
  const lines = [
    'New Rated420 contact inquiry', '', `Reference: ${row.id}`, `Category: ${CATEGORIES.get(row.category)}`,
    `Name: ${row.full_name}`, `Email: ${row.email}`, `Company / Organization: ${row.company || 'Not provided'}`
  ];
  for (const [key,label] of [['company_location','Company Location'],['website','Website'],['telephone','Telephone']]) {
    if (row[key]) lines.push(`${label}: ${row[key]}`);
  }
  lines.push('',`Subject: ${row.subject}`,'',row.message,'','This is a private inquiry. Reply to this email to respond to the sender.');
  return {
    from: 'Rated420 NY <contact@mail.rated420ny.com>', to: ['rated420.ny@gmail.com'],
    reply_to: row.email, subject: `[Rated420 Contact] ${row.subject}`, text: lines.join('\n')
  };
}

export function createHandler({env, fetch: http = globalThis.fetch}) {
  const timedFetch = (url,init = {}) => http(url,{...init,signal:AbortSignal.timeout(6000)});
  const stagingOrigin = env('CONTACT_STAGING_ORIGIN');
  const stagingInbox = env('CONTACT_STAGING_INBOX');
  const stagingSender = env('CONTACT_STAGING_SENDER');
  const usesProductionDatabase = env('SUPABASE_URL')?.replace(/\/$/, '') === 'https://ymluyoqkmzxomjokjmkj.supabase.co';
  const origins = usesProductionDatabase ? ORIGINS : new Set(stagingOrigin ? [stagingOrigin] : []);
  const configured = () => (usesProductionDatabase || Boolean(stagingOrigin && stagingInbox && stagingSender))
    && ['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RESEND_API_KEY','TURNSTILE_SECRET_KEY'].every(k => !!env(k));
  async function database(path, init = {}) {
    const response = await timedFetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
      ...init, headers: { apikey:env('SUPABASE_SERVICE_ROLE_KEY'), Authorization:`Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type':'application/json', Prefer:'return=representation', ...init.headers }
    });
    if (!response.ok) throw new Error('storage_unavailable');
    return response.status === 204 ? null : response.json();
  }
  const patch = (id,values) => database(`contact_submissions?id=eq.${id}`,{method:'PATCH',body:JSON.stringify(values)});
  async function notify(id) {
    const row = await database('rpc/claim_contact_notification',{method:'POST',body:JSON.stringify({p_id:id})});
    if (!row) return;
    try {
      const response = await timedFetch('https://api.resend.com/emails', {
        method:'POST',headers:{Authorization:`Bearer ${env('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':`rated420-contact/${id}`},
        body:JSON.stringify({
          ...notificationBody(row),
          ...(usesProductionDatabase ? {} : { from:stagingSender, to:[stagingInbox] })
        })
      });
      if (!response.ok) { await patch(id,{notification_status:'failed',notification_error:`provider_http_${response.status}`}); return; }
      const result = await response.json();
      if (typeof result.id !== 'string' || !UUID.test(result.id)) throw new Error('invalid_provider_response');
      await patch(id,{notification_status:'accepted',email_id:result.id,notification_error:null});
    } catch {
      // Keep the durable message and a generic retry status; never log personal data or provider credentials.
      await patch(id,{notification_status:'failed',notification_error:'delivery_unconfirmed'}).catch(() => {});
    }
  }
  async function admin(req,path) {
    const expected = env('SUPABASE_SERVICE_ROLE_KEY');
    const supplied = req.headers.get('authorization') || '';
    if (!expected || supplied.length > 8192) return new Response(null,{status:401});
    const [a,b] = await Promise.all([digest(supplied),digest(`Bearer ${expected}`)]);
    const aa = new Uint8Array(a),bb = new Uint8Array(b); let difference = 0;
    for (let i=0;i<aa.length;i++) difference |= aa[i]^bb[i];
    if (difference) return new Response(null,{status:401});
    if (req.method !== 'POST' || !configured()) return new Response(null,{status:503});
    const data = await readJSON(req);
    if (!UUID.test(data.id || '')) throw new Invalid();
    if (path.endsWith('/admin/retry')) {
      await notify(data.id);
    } else if (path.endsWith('/admin/status')) {
      const rows = await database(`contact_submissions?select=id,email_id,notification_status&id=eq.${data.id}`);
      if (!rows.length) return new Response(null,{status:404});
      if (rows[0].email_id) {
        const response = await timedFetch(`https://api.resend.com/emails/${encodeURIComponent(rows[0].email_id)}`,{headers:{Authorization:`Bearer ${env('RESEND_API_KEY')}`}});
        if (!response.ok) return new Response(null,{status:502});
        const result = await response.json();
        if (result.last_event === 'delivered') await patch(data.id,{notification_status:'delivered',notification_error:null});
        else if (['bounced','complained','failed'].includes(result.last_event)) await patch(data.id,{notification_status:'needs_review',notification_error:`provider_${result.last_event}`});
      }
    } else return new Response(null,{status:404});
    const rows = await database(`contact_submissions?select=id,notification_status,notification_attempts,notification_error,email_id&id=eq.${data.id}`);
    return Response.json(rows[0] || {},{headers:{'Cache-Control':'no-store'}});
  }
  return async req => {
    const origin = req.headers.get('origin');
    const allowed = origins.has(origin);
    const headers = {'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
    if (allowed) Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600'});
    const json = (body,status = 200) => new Response(JSON.stringify(body),{status,headers});
    const path = new URL(req.url).pathname;
    try {
      if (path.includes('/admin/')) return await admin(req,path);
      if (req.method === 'OPTIONS') return new Response(null,{status:allowed?204:403,headers});
      if (req.method === 'GET' && path.endsWith('/config')) {
        if (!allowed) return json({ready:false},403);
        const ready = configured() && !!env('TURNSTILE_SITE_KEY');
        return json(ready?{ready:true,site_key:env('TURNSTILE_SITE_KEY')}:{ready:false},ready?200:503);
      }
      if (req.method !== 'POST') return json({success:false},405);
      if (!path.endsWith('/submit-contact') && !path.endsWith('/submit-contact/')) return json({success:false},404);
      if (!allowed) return json({success:false},403);
      if (!configured()) return json({success:false},503);
      const data = await readJSON(req);
      const fields = validate(data);
      const verification = await timedFetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env('TURNSTILE_SECRET_KEY'),response:data.turnstile_token})
      });
      if (!verification.ok) return json({success:false},503);
      const challenge = await verification.json();
      if (challenge.success !== true || challenge.action !== 'contact' || challenge.hostname !== new URL(origin).hostname) return json({success:false},400);
      const payloadHash = hex(await digest(JSON.stringify(fields)));
      // The IP is used transiently, HMACed with a server-only secret, and never stored raw.
      const address = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0,100);
      const key = await crypto.subtle.importKey('raw',encoder.encode(env('TURNSTILE_SECRET_KEY')),{name:'HMAC',hash:'SHA-256'},false,['sign']);
      const senderHash = hex(await crypto.subtle.sign('HMAC',key,encoder.encode(address || fields.email.toLowerCase())));
      const stored = await database('rpc/accept_contact_submission',{method:'POST',body:JSON.stringify({p_request_id:data.request_id,p_payload_hash:payloadHash,p_sender_hash:senderHash,p_fields:fields})});
      if (stored.outcome === 'rate_limited') return json({success:false},429);
      if (stored.outcome === 'conflict') return json({success:false},409);
      if (!UUID.test(stored.id || '')) throw new Error('storage_unavailable');
      // Success means durable receipt, not a claim that Gmail has delivered it.
      await notify(stored.id).catch(() => {});
      return json({success:true,reference:stored.id},stored.outcome==='created'?201:200);
    } catch (error) {
      return json({success:false},error instanceof Invalid?error.status:503);
    }
  };
}
