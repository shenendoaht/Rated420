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
   const page=await browser.newPage({viewport:{width,height:900}});
   page.setDefaultTimeout(9000);
   const errors=[],external=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}
    return remote?hosted(route):route.continue();
   });
   const go=hash=>page.goto(origin+'/'+hash);
   const button=name=>page.getByRole('button',{name,exact:true});
   const heading=name=>page.getByRole('heading',{name,exact:true});
   const byText=name=>page.getByText(name,{exact:true});
   const role=async label=>{
    const controls=page.locator('.ref-demo-controls');
    if(!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
    await page.locator('#demoReviewer').selectOption({label});
    await page.locator('#accountPage').waitFor();
   };
   const fit=async()=>assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await go('');await page.locator('#ageYes').click();
   await go('#catalogue/product');await heading('Demo Citrus Pre-Roll').waitFor();
   await page.getByLabel('Product format').selectOption('Pre-Roll');
   await page.getByLabel('Catalogue layout').selectOption('compact');
   assert.equal(await page.locator('.catalogue-card').count(),1);
   await fit();
   await page.getByRole('link',{name:'View Demo Citrus Pre-Roll'}).click();
   await heading('Demo Citrus Pre-Roll').waitFor();
   for(const alias of ['Demo Citrus','Field Signal','North Loop Dispensary','Hudson Lantern Farm'])await page.getByRole('link',{name:alias,exact:true}).waitFor();
   await page.getByRole('link',{name:'Demo Citrus',exact:true}).click();
   await byText(/reviewers/).first().waitFor();
   await go('#catalogue/dispensary/treehouse');await heading('Treehouse Cannabis').waitFor();
   await page.locator('.catalogue-image img').evaluate(img=>img.decode());
   await byText(/Regulatory record/).click();await byText(/OCM-CAURD-24-000122/).waitFor();
   await page.getByRole('link',{name:'Open community scorecard'}).click();
   await heading(/Treehouse Cannabis/).waitFor();await fit();
   if(width===390||width===1440){
    await go('#catalogue/brand/org-brand');
    await byText('No brand reviews yet.').waitFor();
    const start=await page.locator('#hqContent section').last().innerText();
    if(width===390){
     await role('Moderator · Camille');await go('#hq/catalogue');
     await page.locator('#hqContent').getByText(/founders and administrators|authorized/).first().waitFor();
    }
    await role('Business representative · Morgan');await go('#business-catalogue');
    await page.getByLabel('Proposed business or brand name').fill('Field Signal Demo Revision');
    await page.getByLabel('Proposed brand description').fill('Synthetic business catalogue update.');
    await page.getByLabel('Proposed product association').selectOption('product-citrus-roll');
    await page.getByLabel('Proposed product description').fill('Synthetic product description after review.');
    await button('Submit for editorial review').click();
    await byText(/Field Signal Demo Revision · Pending review/).waitFor();
    await go('#hq/catalogue');await page.locator('#hqContent').getByText(/founders and administrators|authorized/).first().waitFor();
    await role('Founder · Jordan');await go('#hq/catalogue');await heading('Catalogue Manager').waitFor();
    await button('Proposals').click();await button('Approve proposal').click();
    await byText(/Approved · publication pending/).waitFor();
    await go('#catalogue/brand/org-brand');await heading('Field Signal').waitFor();
    await go('#hq/catalogue');await button('Records').click();
    await button('Publish Field Signal Demo Revision').click();
    await button('Publish Demo Citrus Pre-Roll').click();
    await byText('Published in this browser.').waitFor();
    await page.getByLabel('Entity type').selectOption('product');
    await button('Create draft').click();
    await page.getByLabel('Record name').fill('Catalogue Browser Test');
    await page.getByLabel('Description',{exact:true}).fill('Browser-local synthetic catalogue record.');
    await page.getByLabel('Source attribution').fill('Synthetic browser test');
    await page.getByLabel('Associated brand').selectOption('org-brand');
    await button('Save draft').click();
    await button('Approve Catalogue Browser Test').click();
    await button('Publish Catalogue Browser Test').click();
    await button('Media').click();
    await page.getByLabel('Associated entity').selectOption('org-brand');
    for(const [field,value] of Object.entries({'Asset name':'Synthetic test image','Image source':'Browser fixture','Rights holder':'Synthetic test fixture','Credit or attribution':'Demo attribution','Alternative text':'Synthetic pixel'}))await page.getByLabel(field,{exact:true}).fill(value);
    const fixture=await page.evaluate(()=>{
     const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;
     const context=canvas.getContext('2d');context.fillStyle='#8f5bf1';context.fillRect(0,0,32,32);
     return canvas.toDataURL('image/png').split(',')[1];
    });
    await page.getByLabel('Approved image file').setInputFiles({
     name:'fixture.png',mimeType:'image/png',buffer:Buffer.from(fixture,'base64')
    });
    await button('Save media draft').click();await byText('Media draft saved. Publication is a separate action.').waitFor();await button('Authorize Synthetic test image').click();
    await button('Publish Synthetic test image').click();
    await byText('Image published in this browser.').waitFor();
    await button('History').click();await heading('Catalogue change history').waitFor();
    await go('#catalogue/brand/org-brand');await heading('Field Signal Demo Revision').waitFor();
    await page.getByAltText('Synthetic pixel').evaluate(img=>img.decode());
    assert.equal(await page.locator('#hqContent section').last().innerText(),start);
    await page.reload();await heading('Field Signal Demo Revision').waitFor();
    await byText('Demo attribution').waitFor();
    await go('#catalogue/product/product-citrus-roll');
    await byText('Synthetic product description after review.').waitFor();await fit();
   }
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   console.log('PASS',browser.version(),width,origin);
   await page.context().close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
