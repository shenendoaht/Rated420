const assert=require('node:assert/strict');
const fs=require('node:fs');
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
const samples=[
 ['home','','#homePage h1'],
 ['catalogue','#catalogue/product','.catalogue-card'],
 ['treehouse','#catalogue/dispensary/treehouse','.catalogue-profile'],
 ['rythm','#catalogue/brand/rythm','.catalogue-profile'],
 ['scorecard','#strains/101','#rated420-strain-continue'],
 ['manager','#hq/catalogue','[aria-label="Catalogue manager sections"]']
];
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.RATED_TEST_CHROME});
 const baseline=process.env.RATED_BASELINE_PACKAGE;
 const screenshots=process.env.RATED_SCREENSHOTS_DIR;
 const label=baseline?'before':'after';

 try{
  for(const width of [320,390,820,1440]){
   const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});
   const page=await context.newPage();
   page.setDefaultTimeout(10000);
   const blocked=[],errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){blocked.push(url.href);return route.abort();}
    if(baseline)return route.fulfill({path:path.join(baseline,url.pathname==='/'?'index.html':url.pathname.slice(1))});
    return hosted?hostedFile(url.href).then(file=>route.fulfill(file)):route.continue();
   });
   await page.goto(origin);
   await page.locator('#ageYes').click();
   const go=async hash=>{await page.goto(origin+'/'+hash);};
   const verifyFit=async()=>{
    const spill=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1?[]:
     [...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,25).map(el=>[el.tagName,el.id,el.className,el.getBoundingClientRect().right]));
    assert.deepEqual(spill,[]);
   };
   const found=async()=>{
    const controls=page.locator('.ref-demo-controls');
    if(!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
    await page.locator('#demoReviewer').selectOption({label:'Founder · Jordan'});
    await page.locator('#accountPage').waitFor();
    if(await controls.evaluate(el=>el.open))await controls.locator('summary').click();
   };
   for(const [name,hash,selector] of samples){
    if(name==='manager')await found();
    await go(hash);await page.locator(selector).first().waitFor();
    if(name==='scorecard'){
     await page.locator('#rated420-strain-continue').click();
     const slider=page.locator('#strainPage input[type=range]').first();
     await slider.waitFor();
     await slider.focus();
     await page.keyboard.press('Home');
     await page.keyboard.press('ArrowRight');
     assert.equal(await slider.inputValue(),'1');
     await page.locator('#strainPage input[type=range]').first().scrollIntoViewIfNeeded();
    }
    if(name==='treehouse')await page.locator('.catalogue-image img').evaluate(img=>img.decode());
    await verifyFit();
    if(!baseline&&name==='catalogue'){
     assert.equal(await page.getByLabel('Category',{exact:true}).inputValue(),'product');
     await page.getByLabel('Search catalogue').fill('Citrus');
     assert.equal(await page.locator('.catalogue-card').count(),2);
     await page.getByLabel('Product format').selectOption('Pre-Roll');
     assert.equal(await page.locator('.catalogue-card').count(),1);
     await page.getByLabel('Catalogue layout').selectOption('compact');
     await verifyFit();
     await page.getByLabel('Category',{exact:true}).selectOption('brand');
     await page.getByRole('heading',{name:'RYTHM',exact:true}).waitFor();
     await go(hash);await page.locator('.catalogue-card').first().waitFor();
    }
    if(!baseline&&name==='home'){
     const toggle=page.getByRole('button',{name:'Play slideshow',exact:true});
     await toggle.press('Enter');
     await page.getByRole('button',{name:'Pause slideshow',exact:true}).press('Enter');
     assert.equal(await toggle.count(),1);
     const selector=width<=900?'button[aria-label="Browse menu"]':'#ref-public-navigation a';
     const control=page.locator(selector).first();
     await control.press('Tab');
     assert(await page.evaluate(()=>document.activeElement.matches(':focus-visible')));
     await go(hash);
    }
    if(!baseline&&(name==='treehouse'||name==='rythm')){
     const [media,summary]=await Promise.all([page.locator('.catalogue-profile figure').boundingBox(),page.locator('.catalogue-summary').boundingBox()]);
     assert(width>=820?summary.x>media.x:summary.y>media.y);
    }
    if(screenshots&&[390,1440].includes(width)){
     await page.evaluate(()=>document.fonts.ready);
     await page.screenshot({path:path.join(screenshots,label+'-'+name+'-'+width+'.png'),animations:'disabled'});
    }
    if(!baseline&&process.env.RATED_AXE_PATH&&[390,1440].includes(width)){
     await page.evaluate(fs.readFileSync(process.env.RATED_AXE_PATH,'utf8'));
     const findings=await page.evaluate(async()=>{
      const report=await axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
      const summarize=items=>items.map(item=>({id:item.id,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))}));
      return {violations:summarize(report.violations),incomplete:summarize(report.incomplete)};
     });
     console.log('AXE',width,name,JSON.stringify(findings));
    }
   }
   if(!baseline){
    await go('#catalogue/product');
    await page.getByLabel('Search catalogue').evaluate(input=>input.blur());
    await page.evaluate(()=>document.documentElement.style.fontSize='200%');
    await page.getByLabel('Search catalogue').fill('Amber');
    await page.getByRole('heading',{name:'Amber Trail Flower · Demo',exact:true}).waitFor();
    await verifyFit();
   }
   assert.deepEqual(errors,[]);
   assert.deepEqual(blocked,[]);
   console.log('PASS',browser.version(),label,width,origin);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
