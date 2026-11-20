const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const get= require('node:util').promisify(require('node:child_process').execFile);
const origin=process.env.RATED_SANDBOX_ORIGIN||'http://127.0.0.1:8768';
const remote=origin.startsWith('https:');
const responses=new Map();
async function hosted(route){
  const url=route.request().url();
  if(!responses.has(url))responses.set(url,get('curl',['--silent','--show-error','--max-time','20','--include','--suppress-connect-headers',url],{encoding:'buffer',maxBuffer:4*1024*1024}).then(({stdout})=>{
    const boundary=stdout.indexOf('\r\n\r\n');
    const [status,...lines]=stdout.subarray(0,boundary).toString().split(/\r?\n/);
    const headers=Object.fromEntries(lines.map(line=>[line.slice(0,line.indexOf(':')).toLowerCase(),line.slice(line.indexOf(':')+1).trim()]));
    return {status:Number(status.split(' ')[1]),headers,body:stdout.subarray(boundary+4)};
  }));
  return route.fulfill(await responses.get(url));
}

async function setup(browser,width){
  const context=await browser.newContext({viewport:{width,height:900}});
  const page=await context.newPage();
  page.setDefaultTimeout(7500);
  const errors=[],outside=[],missing=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))missing.push(response.url());});
  await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin){outside.push(route.request().url());return route.abort();}
    return remote?hosted(route):route.continue();
  });
  const open=hash=>page.goto(origin+'/'+hash);
  const button=name=>page.getByRole('button',{name,exact:true});
  const field=name=>page.getByLabel(name,{exact:true});
  const heading=name=>page.getByRole('heading',{name,exact:true});
  const switchTo=async label=>{
    const controls=page.locator('.ref-demo-controls');
    if(await controls.count()&&!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
    await page.locator('#demoReviewer').selectOption({label});
    await page.locator('#accountPage').waitFor();
  };
  return {context,page,open,button,heading,field,switchTo,async finish(){
    assert.deepEqual(outside,[]);assert.deepEqual(errors,[]);assert.deepEqual(missing,[]);
    await context.close();
  }};
}
async function expandFilters(page){
  const disclosure=page.locator('.ri-directory .ref-filter-disclosure').filter({has:page.getByText('Advanced filters',{exact:true})});
  if(await disclosure.count()&&!await disclosure.evaluate(el=>el.open))await disclosure.locator('summary').click();
}
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.RATED_TEST_CHROME||'/usr/bin/chromium'});
  try{
    for(const width of [390,1366]){
      const {page,open,button,heading,field,switchTo,finish}=await setup(browser,width);
      await open('#hq/intelligence');
      await page.locator('#ageYes').click();
      await page.getByText(/available to authorized staff/).waitFor();
      await switchTo('Moderator · Camille');
      await open('#hq/intelligence');
      await heading('Data Intelligence Center').waitFor();
      assert.equal(await button('Import').count(),0);
      await page.getByText(/2673 license\/location records · 2287 unique license numbers · 2397 records marked Active/).waitFor();
      await field('Snapshot region').selectOption('Mid-Hudson');
      await page.getByText(/417 license\/location records/).waitFor();
      await switchTo('Founder · Jordan');
      await open('#hq/intelligence');
      await button('Import').click();
      await button('Load synthetic sample').click();
      await button('Map fields').click();
      await button('Preview normalized records').click();
      await page.getByText(/3 rows · 1 invalid · 1 duplicate/).waitFor();
      await page.getByText(/In this file/).waitFor();
      await button('Commit eligible records').click();
      await heading('Synthetic license examples').waitFor();
      await page.reload();
      await button('Datasets').click();
      await expandFilters(page);
      await field('Verification').selectOption('unverified');
      await heading('Sample Lantern Market').waitFor();
      await button('Import').click();
      await field('Dataset name').fill('JSON reconciliation');
      await field('Choose CSV or JSON file').setInputFiles({name:'sample.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([
        {name:'Updated Sample Lantern',sourceId:'SYNTH-101',category:'Processor',region:'Mid-Hudson'},
        {name:'Official collision',sourceId:'MM0106D',locationId:'LID006',category:'Processor'},
        {name:'Invalid Date',sourceId:'SYNTH-102',category:'Processor',issued:'2026-02-31'}
      ]))});
      await button('Map fields').click();
      await button('Preview normalized records').click();
      await page.getByText(/Official identity/).waitFor();
      await page.getByText(/Invalid issued date/).waitFor();
      await field('Resolve row 1').selectOption('supersede');
      await button('Commit eligible records').click();
      await heading('JSON reconciliation').waitFor();
      await button('Datasets').click();
      await expandFilters(page);
      await field('Verification').selectOption('unverified');
      await heading('Updated Sample Lantern').waitFor();
      await button('History').click();
      page.once('dialog',dialog=>dialog.accept());
      await button('Revert JSON reconciliation').click();
      await page.getByText(/Reverted 20/).waitFor();
      await button('Datasets').click();
      await expandFilters(page);
      await field('Verification').selectOption('unverified');
      await heading('Sample Lantern Market').waitFor();
      await button('Sources').click();
      const weed=page.getByRole('article').filter({has:heading('Weedmaps')});
      await weed.getByLabel(/Sync mode/).selectOption('Scheduled proposal');
      await weed.getByRole('button',{name:'Save synchronization proposal'}).click();
      await weed.getByRole('button',{name:'Check local availability'}).click();
      await weed.getByText(/Last local diagnostic.*No live connection/).waitFor();
      await open('#hq/gary/territory');
      await heading('Official license locations').waitFor();
      await expandFilters(page);
      await field('Official region').selectOption('NYC');
      await field('Official license status').selectOption('Active');
      await field('Search official licenses').fill('MM0106D');
      await page.getByText(/License MM0106D · Location LID006/).waitFor();
      await button('Create local CRM prospect').click();
      await page.getByText(/Prospect created in Business Development/).waitFor();
      await page.getByRole('link',{name:'Open business development'}).click();
      await page.getByRole('heading',{name:/regional outreach/}).waitFor();
      await open('#hq/gary/territory');
      await field('Search official licenses').fill('MM0106D');
      await expandFilters(page);
      await field('Outreach status').selectOption('Research');
      await page.getByText(/CRM prospect exists/).waitFor();
      assert.equal(await button('Create local CRM prospect').count(),0);
      await open('#businesses');
      await field('Search official licenses').fill('MM0106D');
      await page.getByRole('link',{name:'Open business profile'}).click();
      await page.getByText(/Official public data · source verified/).waitFor();
      const href=await page.getByRole('link',{name:'View original OCM record'}).getAttribute('href');
      assert.equal(href,'https://data.ny.gov/resource/jskf-tt3q.json?license_number=MM0106D&location_id=LID006');
      if(remote)await page.getByText('Rated420 development sandbox',{exact:true}).waitFor();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const controls=page.locator('.ref-demo-controls');
      if(await controls.count()&&!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
      await Promise.all([page.waitForNavigation(),button('Reset demo data').click()]);
      assert.equal(await page.evaluate(()=>localStorage.getItem('rated420-intelligence-v1')),null);
      if(remote){
        const fresh=await setup(browser,width);
        await fresh.open('#hq/intelligence');await fresh.page.locator('#ageYes').click();
        await fresh.switchTo('Founder · Jordan');await fresh.open('#hq/intelligence');await fresh.button('History').click();
        await fresh.page.getByText('No local imports have been applied.').waitFor();await fresh.finish();
      }
      await finish();
      console.log((remote?'Hosted':'Offline')+' intelligence, roles, CSV/JSON, provenance, reversion, territory and CRM passed at '+width+' px.');
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
