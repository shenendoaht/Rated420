import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, validate, notificationBody } from '../supabase/functions/submit-contact/handler.mjs';

const id = '11111111-1111-4111-8111-111111111111';
const emailId = '22222222-2222-4222-8222-222222222222';
const origin = 'https://rated420ny.com';
const payload = () => ({request_id:id,full_name:'Fixture Member',email:'fixture@example.test',category:'general',company:'',subject:'Fixture inquiry',message:'This is a synthetic contact message.',company_fax:'',turnstile_token:'fixture-token'});
const fixtureEnv = {SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture-server-credential',RESEND_API_KEY:'fixture-email-credential',TURNSTILE_SECRET_KEY:'fixture-challenge-credential',TURNSTILE_SITE_KEY:'fixture-public-key'};

function setup(options = {}) {
  const calls = []; const patches = [];
  let row = {id,...validate(payload()),notification_status:'pending',notification_attempts:0};
  let consumed = false;
  const http = async (url,init = {}) => {
    calls.push({url,init});
    if(url.includes('siteverify')) return Response.json(options.challenge || {success:true,action:'contact',hostname:'rated420ny.com'});
    if(url.includes('rpc/accept_contact_submission')) {
      if(options.databaseFailure) return new Response(null,{status:503});
      const args = JSON.parse(init.body);
      assert.equal(args.p_sender_hash.length,64);assert.equal(args.p_payload_hash.length,64);
      assert(!JSON.stringify(args).includes('fixture-token'));
      row={...row,...args.p_fields};
      return Response.json({outcome:options.outcome || 'created',id});
    }
    if(url.includes('rpc/claim_contact_notification')) {
      if(consumed || options.noClaim)return Response.json(null);
      consumed=true;return Response.json(row);
    }
    if(url.startsWith('https://api.resend.com/emails/')) return Response.json({id:emailId,last_event:'delivered'});
    if(url==='https://api.resend.com/emails') {
      if(options.emailTimeout)throw new Error('network timeout containing sensitive provider detail');
      if(options.emailFailure)return new Response(null,{status:429});
      return Response.json({id:emailId});
    }
    if(url.includes('/contact_submissions') && init.method==='PATCH'){
      const update=JSON.parse(init.body);patches.push(update);row={...row,...update};return Response.json([row]);
    }
    if(url.includes('/contact_submissions') && !init.method)return Response.json([row]);
    throw new Error('Unexpected network call');
  };
  const env = name => (options.env || fixtureEnv)[name];
  return {handler:createHandler({env,fetch:http}),calls,patches};
}
const request = (data = payload(),options = {}) => new Request('https://fixture.supabase.co/functions/v1/submit-contact'+(options.path || ''),{
  method:options.method || 'POST',headers:{origin:options.origin || origin,'content-type':'application/json',...(options.headers || {})},body:options.method==='GET'||options.method==='OPTIONS'?undefined:JSON.stringify(data)
});

test('validation: categories, bounds, control characters, honeypot and URL schemes',()=>{
  assert.equal(validate(payload()).company,null);
  for(const change of [
    {full_name:' '},{email:'a@b\r\nBcc:x@y.test'},{email:'bad'},{category:'invalid'},{subject:'\r\nheader'},
    {message:'short'},{message:'x'.repeat(5001)},{company_fax:'bot'},{request_id:'invalid'},
    {turnstile_token:''},{turnstile_token:'x'.repeat(2049)},{website:'https://fixture.example'},
    {category:'filming',website:'javascript:alert(1)'},{category:'partnership',website:'https://user:password@fixture.example'},
    {to:'attacker@example.test'}
  ])assert.throws(()=>validate({...payload(),...change}));
  for(const category of ['general','feedback','correction','filming','partnership','other'])assert.equal(validate({...payload(),category}).category,category);
  assert.equal(validate({...payload(),category:'filming',website:'https://fixture.example',telephone:'+1 555 0100'}).website,'https://fixture.example');
});

test('notification has fixed recipient/sender and validated Reply-To; content stays plain text',()=>{
  const body=notificationBody({id,...validate({...payload(),message:'<script>fixture</script> & plain text'})});
  assert.deepEqual(body.to,['rated420.ny@gmail.com']);assert.equal(body.reply_to,'fixture@example.test');
  assert.equal(body.from,'Rated420 NY <contact@mail.rated420ny.com>');assert(!('html' in body));assert(body.text.includes('<script>fixture</script>'));
});

test('success verifies captcha, stores private copy, then sends notification and records acceptance',async()=>{
  const {handler,calls,patches}=setup();const response=await handler(request());
  assert.equal(response.status,201);assert.deepEqual(await response.json(),{success:true,reference:id});
  assert(calls[0].url.includes('siteverify'));assert(calls[1].url.includes('accept_contact_submission'));
  const email=calls.find(c=>c.url==='https://api.resend.com/emails');assert(email);
  assert.equal(email.init.headers['Idempotency-Key'],`rated420-contact/${id}`);
  assert.deepEqual(patches.at(-1),{notification_status:'accepted',email_id:emailId,notification_error:null});
  assert.equal(response.headers.get('access-control-allow-origin'),origin);
});

test('missing configuration, foreign origins, malformed or oversized bodies never reach providers or storage',async()=>{
  for(const [req,options,status] of [
    [request(),{env:{}},503],[request(payload(),{origin:'https://untrusted.example'}),{},403],
    [request({...payload(),company_fax:'bot'}),{},400],[request({...payload(),message:'x'.repeat(40000)}),{},413],
    [request(payload(),{headers:{'content-type':'text/plain'}}),{},415]
  ]){const fixture=setup(options);assert.equal((await fixture.handler(req)).status,status);assert.equal(fixture.calls.length,0);}
});

test('captcha action, hostname and failed verification are enforced on the server',async()=>{
  for(const challenge of [{success:false},{success:true,action:'other',hostname:'rated420ny.com'},{success:true,action:'contact',hostname:'attacker.example'}]){
    const {handler,calls}=setup({challenge});assert.equal((await handler(request())).status,400);assert.equal(calls.length,1);
  }
});

test('rate limits, conflicting request IDs and storage outages do not send email',async()=>{
  for(const [options,status] of [[{outcome:'rate_limited'},429],[{outcome:'conflict'},409],[{databaseFailure:true},503]]){
    const {handler,calls}=setup(options);assert.equal((await handler(request())).status,status);assert(!calls.some(c=>c.url.startsWith('https://api.resend.com')));
  }
});

test('provider failures preserve receipt and record safe retry state without exposing provider errors',async()=>{
  for(const options of [{emailFailure:true},{emailTimeout:true}]){
    const {handler,patches}=setup(options);const response=await handler(request());
    assert.equal(response.status,201);assert.deepEqual(await response.json(),{success:true,reference:id});
    assert.equal(patches.at(-1).notification_status,'failed');assert(!JSON.stringify(patches).includes('sensitive'));
  }
});

test('duplicate requests with an existing delivery lease do not send again',async()=>{
  const {handler,calls}=setup({outcome:'duplicate',noClaim:true});assert.equal((await handler(request())).status,200);
  assert(!calls.some(c=>c.url==='https://api.resend.com/emails'));
});

test('admin retry/status reject ordinary users, and delivered status requires a provider event',async()=>{
  const fixture=setup();
  const denied=await fixture.handler(request({id},{path:'/admin/retry',headers:{authorization:'Bearer fixture-normal-user'}}));
  assert.equal(denied.status,401);assert.equal(fixture.calls.length,0);
  const retried=await fixture.handler(request({id},{path:'/admin/retry',headers:{authorization:'Bearer fixture-server-credential'}}));
  assert.equal(retried.status,200);
  const status=await fixture.handler(request({id},{path:'/admin/status',headers:{authorization:'Bearer fixture-server-credential'}}));
  assert.equal(status.status,200);assert.equal((await status.json()).notification_status,'delivered');
});

test('public configuration exposes only a public site key; preflight uses exact origins',async()=>{
  const {handler}=setup();const config=await handler(request(null,{method:'GET',path:'/config'}));
  assert.deepEqual(await config.json(),{ready:true,site_key:'fixture-public-key'});
  assert.equal((await handler(request(null,{method:'OPTIONS'}))).status,204);
  assert.equal((await handler(request(null,{method:'OPTIONS',origin:'https://untrusted.example'}))).status,403);
});
