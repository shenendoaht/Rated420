const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const get=require('node:util').promisify(require('node:child_process').execFile);
const origin=process.env.RATED_SANDBOX_ORIGIN||'http://127.0.0.1:8768';
const remote=origin.startsWith('https:');
const cache=new Map();
async function hosted(route){
 const url=route.request().url();
 if(!cache.has(url))cache.set(url,get('curl',['--silent','--show-error','--max-time','20','--include','--suppress-connect-headers',url],{encoding:'buffer',maxBuffer:4*1024*1024}).then(({stdout})=>{
  const boundary=stdout.indexOf('\r\n\r\n');
  const [status,...lines]=stdout.subarray(0,boundary).toString().split(/\r?\n/);
  const headers=Object.fromEntries(lines.map(line=>[line.slice(0,line.indexOf(':')).toLowerCase(),line.slice(line.indexOf(':')+1).trim()]));
  return {status:Number(status.split(' ')[1]),headers,body:stdout.subarray(boundary+4)};
 }));
 return route.fulfill(await cache.get(url));
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.RATED_TEST_CHROME||'/usr/bin/chromium'});
 try{
  for(const width of [320,390,820,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:width===390?'no-preference':'reduce'});
   const page=await context.newPage();page.setDefaultTimeout(9000);
   const errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}
    return remote?hosted(route):route.continue();
   });
   const go=hash=>page.goto(origin+'/'+hash);
   const button=name=>page.getByRole('button',{name,exact:true});
   const heading=name=>page.getByRole('heading',{name,exact:true});
   const fit=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   const role=async label=>{
    const controls=page.locator('.ref-demo-controls');
    if(!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
    await page.locator('#demoReviewer').selectOption({label});
    await page.locator('#accountPage').waitFor();
   };
   await go('');await page.locator('#ageYes').click();
   await page.locator('#homePage h1').waitFor();
   assert.equal(await page.locator('[data-carousel-slide]').count(),4);
   assert.equal(await page.locator('.hero .score-ticket,.hero-buttons a[href="#how-it-works"],#how-it-works .step-icon').count(),0);
   if(width===390){
    await page.waitForFunction(()=>document.querySelectorAll('[data-carousel-slide]')[1].classList.contains('is-active'));
    assert.equal(await page.locator('[data-carousel-slide].is-active').getAttribute('aria-hidden'),'false');
   }
   await fit();
   const menu=button('Browse menu');
   if(await menu.isVisible())await menu.click();
   const nav=page.locator('#ref-public-navigation');
   await nav.getByText('About',{exact:true}).click();
   await nav.getByRole('link',{name:'About Rated420'}).click();
   await heading('The 420 Standard').waitFor();
   await page.locator('#aboutPage').getByText("Ratings and reviews can't be bought.",{exact:true}).waitFor();
   assert.equal((await page.locator('#aboutPage .editorial-formula').textContent()).replace(/\s/g,''),'SCORE=R+3C+P');
   await page.locator('#aboutPage').getByText(/Distinct review units/).waitFor();
   await go('#team');
   await heading('Meet the Rated420 Team').waitFor();
   assert.equal(await page.locator('.editorial-portrait').count(),3);
   await page.locator('.editorial-group img').evaluate(img=>img.decode());
   await page.locator('.editorial-bio summary').first().focus();
   await page.keyboard.press('Enter');
   await page.getByText('Founder-approved biography pending.',{exact:true}).first().waitFor();
   await fit();
   await go('#accessories');
   for(const name of ['Peak','Glass Grinder','GRAV® 3-Piece Grinder','Waterpipe'])await heading(name).waitFor();
   assert.equal(await page.getByText('Shen’s blue Houseplant glass grinder',{exact:true}).count(),0);
   const puffco=page.getByRole('link',{name:'View at Puffco'});
   await puffco.click();await heading('Internet required').waitFor();
   assert.equal(await page.getByRole('link',{name:'Open manufacturer site online'}).getAttribute('href'),'https://www.puffco.com/products/the-peak');
   await page.keyboard.press('Escape');await fit();
   await go('#hq/content');
   await page.getByText(/available to authorized staff/).waitFor();
   await role('Moderator · Camille');await go('#hq/content');
   await page.getByText(/available to founders and administrators/).waitFor();
   await role('Founder · Jordan');await go('#hq/content');
   await heading('Editorial content').waitFor();
   await page.getByText('Edit Peak',{exact:true}).click();
   const edit=page.locator('details.editorial-edit').filter({hasText:'Edit Peak'});
   await edit.getByLabel('Placement type').selectOption('Sponsored placement');
   await edit.getByRole('button',{name:'Save local content'}).click();
   await page.getByText('Enter the commercial disclosure before saving.',{exact:true}).waitFor();
   await edit.getByLabel('Placement type').selectOption('Independent editorial');
   await edit.getByLabel('Approved image (optional, up to 200 KB)').setInputFiles({
    name:'fixture.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=','base64')
   });
   await edit.getByRole('button',{name:'Save local content'}).click();
   await page.getByText('Record the approval or rights source for this image.',{exact:true}).waitFor();
   await edit.getByLabel('Image rights or approval source').fill('Authorized test fixture');
   await edit.getByRole('button',{name:'Save local content'}).click();
   await page.getByText('Saved in this browser.',{exact:true}).waitFor();
   await button('Team and story').click();
   await page.getByText('Edit team slot three',{exact:true}).click();
   const team=page.locator('details.editorial-edit').filter({hasText:'Edit team slot three'});
   await team.getByLabel('Name',{exact:true}).fill('Synthetic team test');
   await team.getByLabel('Biography',{exact:true}).fill('Browser-only test biography.');
   await team.getByRole('button',{name:'Save local content'}).click();
   await go('#team');await heading('Synthetic team test').waitFor();
   await page.reload();await heading('Synthetic team test').waitFor();
   await go('#accessories');await page.locator('.editorial-product img[alt="Peak"]').evaluate(img=>img.decode());
   await fit();
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   await context.close();
   console.log((remote?'Hosted':'Offline')+' editorial, roles, carousel, captions, disclosures and local content passed at '+width+'px.');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
