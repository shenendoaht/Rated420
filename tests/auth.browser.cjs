const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const assert=require('assert/strict');
const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const fixtureUser={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',email:'fixture@example.test',created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[]};
const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
const token=[encode({alg:'HS256',typ:'JWT'}),encode({sub:fixtureUser.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600}),'fixture-signature-not-a-credential'].join('.');
const session=()=>({access_token:token,refresh_token:'fixture-refresh-not-a-credential',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:fixtureUser});
(async()=>{
 let sdk;
 if(process.env.AUTH_TEST_SDK_PATH) sdk=fs.readFileSync(process.env.AUTH_TEST_SDK_PATH);
 else {
  // curl uses the configured network proxy; raw Node fetch may not in CI.
  // Only a pinned public SDK asset is downloaded. Every backend request is mocked.
  sdk=execFileSync('curl',['--fail','--silent','--show-error','--location',
   'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1']);
 }
 const browser=await chromium.launch({headless:true});
 try {
  for(const width of [1280,390]) {
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   const page=await context.newPage();const errors=[],requests=[];
   page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.hostname==='rated420.test') {
     const file=path.join(root,u.pathname==='/'?'index.html':u.pathname);
     const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'};
     return route.fulfill({status:fs.existsSync(file)?200:404,contentType:mime[path.extname(file)]||'text/plain',body:fs.existsSync(file)?fs.readFileSync(file):'Not found'});
    }
    if(u.hostname==='cdn.jsdelivr.net') return route.fulfill({contentType:'application/javascript',body:sdk});
    if(u.hostname.endsWith('.supabase.co')) {
     requests.push(req.method()+' '+u.pathname);
     const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-expose-headers':'*'};
     if(req.method()==='OPTIONS') return route.fulfill({status:204,headers});
     let body;
     if(u.pathname==='/auth/v1/token' && req.method()==='POST') body=session();
     else if(u.pathname==='/auth/v1/user' && req.method()==='GET') body=fixtureUser;
     else if(u.pathname==='/auth/v1/logout' && req.method()==='POST') return route.fulfill({status:204,headers});
     else if(u.pathname==='/rest/v1/member_profiles' && req.method()==='GET') body={id:fixtureUser.id,username:'fixture_member',display_name:'Fixture',created_at:fixtureUser.created_at,updated_at:fixtureUser.created_at,avatar_choice:null,avatar_path:null};
     else if(u.pathname==='/rest/v1/strains' && req.method()==='GET') body=[{id:1,name:'Blue Dream',created_at:fixtureUser.created_at}];
     else if(['/rest/v1/strain_community_stats','/rest/v1/strain_reviews','/rest/v1/dispensary_reviews'].includes(u.pathname) && req.method()==='GET') body=[];
     else throw Error('Unexpected mocked backend request: '+req.method()+' '+u.pathname);
     return route.fulfill({status:200,contentType:'application/json',headers,body:JSON.stringify(body)});
    }
    // Never contact an external service during this test.
    return route.abort();
   });
   await page.goto('http://rated420.test/');
   await page.locator('#ageYes').click();
   await page.waitForFunction(()=>!!window.supabase);
   const hero=page.locator('#heroJoin');
   await assertLabel('Join Rated420');
   const design=await hero.evaluate(el=>({className:el.className,icon:el.querySelector('span').outerHTML}));
   await hero.click();
   assert(await page.locator('#signupForm').isVisible(),'Logged-out hero opens signup');
   await page.locator('#brandLink').click();
   await page.reload();
   await assertLabel('Join Rated420');
   await page.locator('#navLogin').click();
   await page.locator('#loginEmail').fill(fixtureUser.email);
   await page.locator('#loginPassword').fill('Fixture-password-only');
   await page.locator('#loginForm button[type=submit]').click();
   await page.waitForFunction(()=>!document.getElementById('accountPage').hidden);
   await page.locator('#brandLink').click();
   await assertLabel('Rate a Strain');
   assert.deepEqual(await hero.evaluate(el=>({className:el.className,icon:el.querySelector('span').outerHTML})),design);
   await hero.click();
   assert(await page.locator('#strainPage').isVisible(),'Signed-in hero opens strain workflow');
   assert(await page.locator('#rated420-strain-rating-form').isVisible());
   await page.waitForFunction(()=>scrollY>0);
   await page.locator('#brandLink').click();
   await page.reload();
   await assertLabel('Rate a Strain');
   await page.waitForFunction(()=>document.getElementById('memberHandle').textContent==='@fixture_member');
   await page.locator('#brandLink').click();
   assert(await page.locator('#homePage').isVisible(),'Homepage available after session restoration');
   await hero.click();
   assert(await page.locator('#strainPage').isVisible());
   await page.locator('#navAccount').click();
   await page.locator('#accountSignOut').click();
   await assertLabel('Join Rated420');
   assert(await page.locator('#homePage').isVisible(),'Logout returns home');
   await hero.click();
   assert(await page.locator('#signupForm').isVisible(),'Logged-out hero returns to signup');
   await page.locator('#brandLink').click();
   await page.reload();
   await assertLabel('Join Rated420');
   assert.deepEqual(await hero.evaluate(el=>({className:el.className,icon:el.querySelector('span').outerHTML})),design);
   assert.deepEqual(errors,[]);
   assert(requests.includes('POST /auth/v1/token'));
   assert(requests.includes('POST /auth/v1/logout'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   console.log(JSON.stringify({width,result:'PASS',checks:['logged-out registration','login updates CTA','signed-in rating navigation','signed-in refresh','logout resets CTA','logged-out refresh','original CTA styles and icon preserved','no horizontal overflow','no JS errors'],backend:'all requests mocked; no live services contacted'}));
   await context.close();
   async function assertLabel(label) {await page.waitForFunction(label=>document.getElementById('heroJoin').firstChild.textContent.trim()===label,label);}
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
