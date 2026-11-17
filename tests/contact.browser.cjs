const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  for(const width of [1280,390,320]){
   const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
   const page=await context.newPage();const errors=[],submissions=[];let mode='success';let resets=0;
   page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.hostname==='rated420.test'){
     const file=path.join(root,url.pathname==='/'?'index.html':url.pathname);
     const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'};
     let body=fs.existsSync(file)?fs.readFileSync(file):'missing';
     if(file.endsWith('index.html'))body=String(body).replace('name="contact-turnstile-site-key" content=""','name="contact-turnstile-site-key" content="fixture-site-key"');
     return route.fulfill({status:fs.existsSync(file)?200:404,contentType:mime[path.extname(file)]||'text/plain',body});
    }
    if(url.hostname.endsWith('.supabase.co') && url.pathname==='/functions/v1/submit-contact'){
     submissions.push(req.postDataJSON());
     if(mode==='network')return route.abort();
     return route.fulfill({status:mode==='rate'?429:mode==='server'?503:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(mode==='success'?{success:true,reference:'11111111-1111-4111-8111-111111111111'}:{success:false})});
    }
    // SDK, fonts and all live backend requests are blocked; this test exercises only the Contact page.
    return route.abort();
   });
   await page.addInitScript(()=>{
    window.turnstile={render:(selector,options)=>{window.fixtureChallenge=options;options.callback('fixture-token');return 'fixture-widget';},reset:()=>{window.fixtureResetCount=(window.fixtureResetCount||0)+1;window.fixtureChallenge.callback('fixture-fresh-token');}};
   });
   await page.goto('https://rated420.test/');await page.locator('#ageYes').click();
   await page.locator('[data-open-contact]').click();
   assert(await page.locator('#contactPage').isVisible());
   assert.equal(await page.locator('#contactCategory option').count(),7);
   assert(await page.locator('#contactBusiness').isHidden());
   for(const c of ['filming','partnership']){
    await page.locator('#contactCategory').selectOption(c);
    assert(await page.locator('#contactBusiness').isVisible());
    assert.equal(await page.locator('#contactLocation').isEnabled(),true);
   }
   await page.locator('#contactLocation').fill('Fixture city');
   await page.locator('#contactWebsite').fill('https://fixture.example');
   await page.locator('#contactTelephone').fill('+1 555 0100');
   await page.locator('#contactCategory').selectOption('general');
   assert(await page.locator('#contactBusiness').isHidden());
   assert.equal(await page.locator('#contactLocation').isEnabled(),false);
   await page.locator('#contactSubmit').click();assert.equal(submissions.length,0);
   await page.locator('#contactName').fill('Fixture Member');
   await page.locator('#contactEmail').fill('fixture@example.test');
   await page.locator('#contactSubject').fill('A suggestion for Rated420');
   await page.locator('#contactMessage').fill('Fixture message for mocked testing only.');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   for(const failure of ['server','rate','network']){
    mode=failure;await page.locator('#contactSubmit').click();
    try { await page.waitForFunction(()=>!document.getElementById('contactFormStatus').hidden,null,{timeout:5000}); }
    catch(e) { console.log({failure,errors,submissions,form:await page.locator('#contactForm').evaluate(form=>[...form.elements].filter(el=>el.willValidate&&!el.validity.valid).map(el=>({name:el.name,message:el.validationMessage})))});throw e; }
    assert.equal(await page.locator('#contactMessage').inputValue(),'Fixture message for mocked testing only.');
    assert(await page.locator('#contactSuccess').isHidden());
    assert.equal(await page.locator('#contactSubmit').isEnabled(),true);
   }
   mode='success';await page.locator('#contactSubmit').click();
   await page.waitForFunction(()=>!document.getElementById('contactSuccess').hidden);
   assert(await page.locator('#contactForm').isHidden());
   assert.equal(await page.locator('#contactName').inputValue(),'');
   assert.equal(await page.locator('#contactReference').textContent(),'Your reference: 11111111-1111-4111-8111-111111111111');
   assert.equal(submissions.at(-1).company_location,undefined,'Hidden business information must not be submitted');
   assert.equal(submissions.at(-1).website,undefined);
   assert.equal(submissions.at(-1).telephone,undefined);
   assert.equal(new Set(submissions.map(s=>s.request_id)).size,1,'Retries retain idempotency identifier');
   await page.locator('#contactAgain').click();assert(await page.locator('#contactForm').isVisible());
   await page.locator('#contactCategory').selectOption('filming');
   await page.locator('#contactName').fill('Fixture Business');await page.locator('#contactEmail').fill('fixture@example.test');
   await page.locator('#contactSubject').fill('Fixture invitation');await page.locator('#contactMessage').fill('A filming invitation for a future fixture event.');
   await page.locator('#contactLocation').fill('Fixture city');await page.locator('#contactWebsite').fill('https://fixture.example');await page.locator('#contactTelephone').fill('+1 555 0100');
   await page.locator('#contactSubmit').click();await page.waitForFunction(()=>!document.getElementById('contactSuccess').hidden);
   assert.equal(submissions.at(-1).website,'https://fixture.example');assert.equal(submissions.at(-1).company_location,'Fixture city');
   await page.locator('#contactSuccess [data-go-home]').click();assert(await page.locator('#homePage').isVisible());assert(await page.locator('#contactPage').isHidden());
   await page.locator('#heroJoin').click();assert(await page.locator('#signupForm').isVisible());
   assert.deepEqual(errors,[]);
   console.log(JSON.stringify({width,result:'PASS',checks:['footer navigation','six inquiry categories','conditional optional business fields','required field validation','server/rate-limit/network failures preserve entries','branded success and reference','retry identifier','no hidden business-field leakage','send another message','home and signup navigation','no horizontal overflow','no JS errors'],backend:'fully mocked; no live requests'}));
   await context.close();
  }
  for(const noScript of [false,true]){
   const context=await browser.newContext();const page=await context.newPage();let backendRequests=0;
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.hostname!=='rated420.test'){backendRequests++;return route.abort();}
    if(noScript&&url.pathname==='/contact.js')return route.abort();
    const file=path.join(root,url.pathname==='/'?'index.html':url.pathname);
    const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'};
    return route.fulfill({status:200,contentType:mime[path.extname(file)]||'text/plain',body:fs.readFileSync(file)});
   });
   await page.goto('https://rated420.test/');await page.locator('#ageYes').click();await page.locator('[data-open-contact]').click();
   assert.equal(await page.locator('#contactForm').getAttribute('method'),'post');
   if(noScript)assert.equal(await page.locator('#contactSubmit').isEnabled(),false);
   else{
    await page.locator('#contactName').fill('Fixture');await page.locator('#contactEmail').fill('fixture@example.test');await page.locator('#contactCategory').selectOption('general');await page.locator('#contactSubject').fill('Fixture subject');await page.locator('#contactMessage').fill('A fixture message only.');
    await page.locator('#contactSubmit').click();assert((await page.locator('#contactFormStatus').textContent()).includes('not available yet'));
    assert(await page.locator('#contactSuccess').isHidden());
   }
   console.log(JSON.stringify({result:'PASS',check:noScript?'Submit disabled if contact script fails':'Missing configuration fails closed; no false confirmation'}));
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
