const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');

const origin=process.env.RATED_SANDBOX_ORIGIN||'http://127.0.0.1:8768';
const hosted=origin.startsWith('https:');
const execute=require('node:util').promisify(require('node:child_process').execFile);
const cache=new Map();

function hostedFile(url){
 if(!cache.has(url))cache.set(url,execute('curl',['-fsS','--max-time','25','--include','--suppress-connect-headers',url],{encoding:'buffer',maxBuffer:4*1024*1024}).then(({stdout})=>{
  const boundary=stdout.indexOf('\r\n\r\n');
  const [status,...lines]=stdout.subarray(0,boundary).toString().split(/\r?\n/);
  const headers=Object.fromEntries(lines.map(line=>[line.slice(0,line.indexOf(':')).toLowerCase(),line.slice(line.indexOf(':')+1).trim()]));
  return {status:Number(status.split(' ')[1]),headers,body:stdout.subarray(boundary+4)};
 }));
 return cache.get(url);
}
const routes=[
 ['home','','#join'],
 ['navigation','','#ref-public-navigation'],
 ['catalogue','#catalogue/product','.catalogue-card'],
 ['hq','#hq','#hqContent'],
 ['founder','#hq/gary','.gary-body'],
 ['territory','#hq/gary/territory','.expansion svg'],
 ['intelligence','#hq/intelligence','.ri-center']
];
(async()=>{
 const baseline=process.env.RATED_BASELINE_PACKAGE;
 const files=baseline||process.env.RATED_PACKAGE;
 const screenshots=process.env.RATED_SCREENSHOTS_DIR;
 const browser=await chromium.launch({executablePath:process.env.RATED_TEST_CHROME});
 try{
  for(const width of [320,375,390,430,820,1440]){
   const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
   const page=await context.newPage();
   page.setDefaultTimeout(8500);
   const errors=[],outside=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){outside.push(url.href);return route.abort();}
    if(files)return route.fulfill({path:path.join(files,url.pathname==='/'?'index.html':url.pathname.slice(1))});
    return hosted?hostedFile(url.href).then(asset=>route.fulfill(asset)):route.continue();
   });
   const go=async hash=>{await page.goto(origin+'/'+hash);};
   const heading=name=>page.getByRole('heading',{name,exact:true});
   const button=name=>page.getByRole('button',{name,exact:true});
   const link=name=>page.getByRole('link',{name,exact:true});
   const label=name=>page.getByLabel(name,{exact:true});
   const fit=async name=>{
    const metrics=await page.evaluate(()=>[innerWidth,document.documentElement.scrollWidth]);
    assert(metrics[1]<=metrics[0]+1,name+' overflow '+metrics);
   };
   const switchTo=async name=>{
    const controls=page.locator('.ref-demo-controls');
    if(!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
    await page.locator('#demoReviewer').selectOption({label:name});
    await page.locator('#accountPage').waitFor();
    if(await controls.evaluate(el=>el.open))await controls.locator('summary').click();
   };
   const sidebar=async name=>{
    const toggle=button(name+' navigation');
    if(await toggle.count()&&await toggle.getAttribute('aria-expanded')==='false')await toggle.click();
   };
   await go('');await page.locator('#ageYes').click();
   for(const [i,[name,hash,selector]] of routes.entries()){
    if(name==='hq')await switchTo('Founder · Jordan');
    await go(hash);
    if(name==='navigation'&&width<=900)await button('Browse menu').press('Enter');
    await page.locator(selector).first().waitFor();
    if(name==='hq'){await button('Administration navigation').waitFor();await sidebar('Administration');}
    if(name==='founder')await heading('Overview').waitFor();
    if(name==='intelligence')await heading('Data Intelligence Center').waitFor();
    if(name==='home')await page.locator('#join').scrollIntoViewIfNeeded();
    if(name==='navigation')await page.locator('.nav-catalogue summary').press('Enter');
    await fit(name);
    if(!baseline&&name==='home')assert.equal(await page.locator('#join > div > p:not(.eyebrow)').evaluate(el=>getComputedStyle(el).color),'rgb(242, 239, 247)');
    if(i===routes.length-1&& !baseline)await page.getByText('Commercial providers · no active connection',{exact:true}).waitFor();
    if(screenshots&&[390,1440].includes(width)){
     await page.evaluate(()=>document.fonts.ready);
     await page.screenshot({path:path.join(screenshots,(baseline?'before':'after')+'-'+name+'-'+width+'.png'),animations:'disabled'});
    }
   }
   if(!baseline){
    await go('#hq');
    await heading('Needs attention').waitFor();
    await link(/catalogue drafts/).click();
    await label('Search records').waitFor();
    await link('Back to Rated420 HQ').click();await heading('Needs attention').waitFor();
    await link(/rejected or skipped import rows/).click();
    await page.getByText('No local imports have been applied.',{exact:true}).waitFor();
    await button('Sources').click();
    const weg=page.locator('article').filter({has:heading('Weedmaps')});
    await weg.getByText('No authorized connection',{exact:true}).waitFor();
    await weg.locator('summary').press('Enter');
    await weg.getByRole('button',{name:'Check local availability'}).click();
    await weg.getByText(/Last local diagnostic/).waitFor();
    assert.equal(await weg.locator('details').getAttribute('open'),'');
    await go('#hq/gary');
    await button('Review farm tour introduction').click();
    await heading('Review farm tour introduction').waitFor();
    await button('Open correspondence thread').click();
    await heading('Farm tour introduction').waitFor();
    await button('Back to Founder tasks').click();
    await heading('Review farm tour introduction').waitFor();
    await button('Back to Overview').click();
    await heading('Follow-ups').waitFor();
    await sidebar('Founder');await label('Founder area').selectOption('Business');await button('Industry directory').click();
    await label('Search industry directory').fill('Lantern');
    await button('Open Hudson Lantern Farm').click();
    await button('Back to Industry directory').click();
    assert.equal(await label('Search industry directory').inputValue(),'Lantern');
    await go('#hq/gary/territory');
    const hudson=page.getByRole('button',{name:/Hudson Valley/});
    await hudson.press('Enter');
    assert.equal(await hudson.getAttribute('aria-pressed'),'true');
    assert(await hudson.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')));
    await heading('Hudson Valley').waitFor();
    await page.getByText(/official license locations ·/).waitFor();
    await page.getByText('Business profile',{exact:true}).first().click();
    await link('Open CRM organization').first().click();await heading('Field Signal').or(heading('Hudson Lantern Farm')).first().waitFor();
    await link('Back to Territory Explorer').click();
    assert.equal(await hudson.getAttribute('aria-pressed'),'true');
    await link('Open CRM organization').first().waitFor();
    await switchTo('Community member · Maya');await go('#contribute');
    await label('Category').selectOption('brand');
    await label('Listing name').fill('Synthetic review desk fixture');
    await label('Supporting details').fill('Browser-only fixture for inline moderation.');
    await button('Send for review').click();
    await heading('Synthetic review desk fixture').waitFor();
    await switchTo('Moderator · Camille');await go('#hq');
    await heading('Needs attention').waitFor();
    assert.equal(await link(/catalogue drafts/).count(),0);
    await page.getByText('Synthetic review desk fixture · Pending',{exact:true}).click();
    await label('Status').selectOption('Needs Revision');
    await label('Private decision note').fill('Please confirm the spelling.');
    await button('Record decision').click();
    await page.getByText('Synthetic review desk fixture · Needs Revision',{exact:true}).waitFor();
    assert.equal(new URL(page.url()).hash,'#hq');

    await go('#hq/gary');
    await page.getByText(/available to founders and administrators/).waitFor();
    await switchTo('Founder · Jordan');
    for(const target of ['#catalogue/product','#hq','#hq/gary','#hq/gary/territory','#hq/intelligence']){
     await go(target);await page.locator('#hqContent').waitFor();
     await page.waitForFunction(()=>document.querySelector('#hqContent').textContent!=='Loading…');
     await page.evaluate(()=>{document.documentElement.style.fontSize='200%';});
     await fit('200% '+target);
    }
   }
   assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);
   console.log('PASS',browser.version(),baseline?'baseline':origin,width);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
