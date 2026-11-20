const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:8768';
const widths=[320,375,390,430,768,820,1024,1366,1440,1920];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.RATED_TEST_CHROME||'/usr/bin/chromium',
  args:['--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
 try{
  for(const width of widths){
   const height=width===820?430:width===1024?600:900;
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
   const page=await context.newPage();page.setDefaultTimeout(7000);
   const errors=[],external=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>{
    if(new URL(route.request().url()).origin!==origin){external.push(route.request().url());return route.abort();}
    return route.continue();
   });
   const go=hash=>page.goto(origin+'/'+hash);
   const button=name=>page.getByRole('button',{name,exact:true});
   const heading=name=>page.getByRole('heading',{name,exact:true});
   const sidebar=async label=>{
    const control=button(label+' navigation');
    if(await control.getAttribute('aria-expanded')==='false')await control.click();
    return control;
   };
   const fit=async label=>{
    await page.evaluate(()=>document.fonts.ready);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert(overflow<=1,label+' overflow '+overflow+'px at '+width);
   };
   const role=async label=>{
    const controls=page.locator('.ref-demo-controls');
    if(!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
    await page.locator('#demoReviewer').selectOption({label});
    await page.locator('#accountPage').waitFor();
    if(width<=760)await controls.locator('summary').click();
   };
   await go('');await page.locator('#ageYes').click();await page.locator('#homePage h1').waitFor();await fit('home');
   if(width<=900){
    const menu=button('Browse menu');
    await menu.focus();await page.keyboard.press('Enter');
    assert.equal(await menu.getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'),'false');
    assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')==='Browse menu'),true);
    await menu.click();
    const nav=page.locator('#ref-public-navigation');
    await nav.getByText('Explore',{exact:true}).click();
    await nav.getByRole('link',{name:'Browse all'}).click();
    await heading('Explore the catalog').waitFor();
    assert.equal(await menu.getAttribute('aria-expanded'),'false');
   }else{
    const home=page.locator('#ref-public-navigation').getByRole('link',{name:'Home',exact:true});
    assert.equal(await home.getAttribute('aria-current'),'page');
    await go('#discover');await heading('Explore the catalog').waitFor();
   }
   await fit('discovery');
   await role('Community member · Maya');await fit('profile');
   await button('Open The Stash').click();await heading('The Stash').waitFor();await fit('stash');
   await go('#strains/101');await page.locator('#rated420-strain-summary').waitFor();await fit('strain');
   const slider=page.locator('#rated420-strain-rating-form input[type=range]').first();
   await slider.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
   assert.equal(await slider.inputValue(),'1');
   await go('#dispensaries/201');await page.locator('#dispensaryPage').waitFor();await fit('dispensary');
   await role('Business representative · Morgan');await go('#business-account');await heading('Field Signal').waitFor();
   await sidebar('Business');await fit('business');
   await role('Founder · Jordan');await go('#hq/gary');await heading('Overview').waitFor();
   const toggle=await sidebar('Founder');await fit('founder expanded');await toggle.click();await fit('founder collapsed');
   if(width>760){
    await page.reload();await heading('Overview').waitFor();
    assert.equal(await button('Founder navigation').getAttribute('aria-expanded'),'false');
   }
   await go('#hq/gary/finance');await heading('Financial Command Center').waitFor();await fit('finance');
   await go('#hq/gary/territory');await heading('Territory Explorer').waitFor();await fit('territory');
   await go('#hq/intelligence');await heading('Data Intelligence Center').waitFor();await fit('intelligence');
   await button('Datasets').click();
   const layouts=page.getByLabel('Record layout',{exact:true});
   await layouts.selectOption('compact');
   const records=page.locator('.ref-license-record');
   assert.equal(await records.count(),12);
   await records.first().locator('summary').click();await page.getByRole('link',{name:'View original OCM record'}).first().waitFor();
   await fit('dataset expanded');
   await button('Import').click();await button('Load synthetic sample').click();await button('Map fields').click();await fit('mapping');
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   await context.close();console.log(width+' × '+height+': navigation, page fit, keyboard scorecard, workspace collapse and dataset disclosure passed');
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
