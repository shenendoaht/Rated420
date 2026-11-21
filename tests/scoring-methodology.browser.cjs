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

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.RATED_TEST_CHROME});
 const root=process.env.RATED_PACKAGE;
 try{
  for(const width of [320,375,390,430,820,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   const page=await context.newPage();
   page.setDefaultTimeout(9000);
   const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin)return route.abort();
    if(root)return route.fulfill({path:path.join(root,url.pathname.slice(1)||'index.html')});
    return hosted?hostedFile(url.href).then(file=>route.fulfill(file)):route.continue();
   });
   const go=hash=>page.goto(origin+'/'+hash);
   const capture=async(name,node)=>{
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(process.env.RATED_SCREENSHOTS_DIR&&[390,1440].includes(width)){
     if(node)await node.scrollIntoViewIfNeeded();
     await page.screenshot({path:path.join(process.env.RATED_SCREENSHOTS_DIR,name+'-'+width+'.png')});
    }
   };
   await go('');await page.locator('#ageYes').click();
   await go('#about');
   await page.getByRole('heading',{name:'About Rated420',exact:true}).waitFor();
   await capture('about');
   const calculator=page.locator('#about-score-calculator');
   const before=await page.evaluate(()=>JSON.stringify(localStorage));
   for(const slider of await calculator.getByRole('slider').all())await slider.press('End');
   assert.equal(await calculator.locator('.total').textContent(),'420');
   await calculator.getByLabel('Example format').selectOption('Topical');
   const third=calculator.getByRole('slider',{name:'Consistency',exact:true});
   await third.press('Home');
   assert.equal(await calculator.locator('.total').textContent(),'336');
   assert.equal(await third.getAttribute('aria-describedby'),'about-score-calculator_flavor-guidance');
   const modelPicker=calculator.getByLabel('Example format');
   const models=await modelPicker.locator('option').evaluateAll(options=>options.map(option=>option.value));
   assert.equal(models.length,13);
   const other={
    dispensary:['Aesthetic','Accessibility','Staff','Menu','Overall'],
    brand:['Presentation','Consistency','Selection','Transparency','Overall'],
    accessory:['Design','Build quality','Ease of use','Performance','Overall']
   };
   for(const model of models){
    await modelPicker.selectOption(model);
    const expected=other[model]||['Aesthetic','Aroma',model==='Topical'?'Consistency':'Flavor','Effects','Overall'];
    assert.deepEqual(await calculator.locator('.rating-heading label').allTextContents(),expected);
    const sliders=await calculator.getByRole('slider').all();
    for(const slider of sliders){
     assert.equal(await slider.getAttribute('max'),'84');
     const description=await slider.getAttribute('aria-describedby');
     assert((await calculator.locator('#'+description).textContent()).trim());
     await slider.press('End');
    }
    assert.equal(await calculator.locator('.total').textContent(),'420');
   }
   assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),before);
   const rows=await calculator.locator('.rating-row').evaluateAll(items=>items.map(row=>{
    const style=getComputedStyle(row);
    const label=row.querySelector('label').getBoundingClientRect();
    const number=row.querySelector('.rating-heading span').getBoundingClientRect();
    return {labelRight:label.right,numberLeft:number.left,numberRight:number.right,paddingTop:style.paddingTop};
   }));
   assert(rows.every(row=>row.labelRight<row.numberLeft&&row.numberRight===rows[0].numberRight));
   assert(rows.slice(1).every(row=>row.paddingTop==='10px'));
   await capture('calculator',calculator.locator('h2'));
   await go('#strains');
   const formatFilter=page.locator('#strainFormatFilter');
   assert(!await formatFilter.isVisible());
   await capture('explore',page.locator('#strainPageTitle'));
   await go('#strains/101');
   await formatFilter.waitFor();
   await formatFilter.getByRole('button',{name:'Pre-Roll',exact:true}).click();
   await page.getByText('PRE-ROLL · COMMUNITY RATINGS',{exact:true}).waitFor();
   const form=page.locator('#rated420-strain-rating-form');
   await form.getByRole('slider',{name:'Flavor',exact:true}).waitFor();
   assert.equal(await form.locator('.total').textContent(),'0');
   const totalSize=await form.locator('.rating-top strong').evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
   assert(width>760?totalSize===38:totalSize>=22&&totalSize<30);
   await capture('review',form.getByRole('heading',{name:'Your scorecard'}));
   await form.locator('[name=productType]').selectOption('Topical');
   const topical=form.getByRole('slider',{name:'Consistency',exact:true});
   await topical.press('End');
   assert.equal(await topical.getAttribute('name'),'flavor');
   await form.getByText('Was it unpleasantly greasy or oily? Did it leave any residue?',{exact:true}).waitFor();
   await capture('topical',topical);
   await form.locator('[name=productType]').selectOption('Flower');
   await form.getByRole('slider',{name:'Flavor',exact:true}).waitFor();
   assert.equal(await form.getByText('Was it unpleasantly greasy or oily? Did it leave any residue?',{exact:true}).count(),0);
   const raw=await page.evaluate(async()=>{
    const api=window.supabase.createClient();
    const {data}=await api.from('strain_community_stats').select('*').eq('strain_id',101);
    return data;
   });
   assert.equal(raw.find(row=>row.product_type==='Flower').avg_total,252.5);
   assert.equal(raw.find(row=>row.product_type==='Pre-Roll').avg_total,200);
   assert.equal(raw.find(row=>row.product_type===null).avg_total,277.5);
   await go('#discover');
   await page.locator('.build-score').first().waitFor();
   const totals=(await page.locator('.build-score').allTextContents());
   assert(totals.some(text=>text==='Unrated'));
   assert(totals.filter(text=>text.includes('/ 420')).every(text=>/^\d+ \/ 420/.test(text)));
   const demoCitrus=page.locator('.build-card').filter({has:page.getByRole('heading',{name:'Demo Citrus',exact:true})});
   await demoCitrus.getByText('278 / 420 · 2 reviews',{exact:true}).waitFor();
   await capture('catalogue',demoCitrus.locator('.build-score'));
   await go('#accessories');
   for(const name of ['Peak','Glass Grinder','GRAV® 3-Piece Grinder','Waterpipe'])await page.getByRole('heading',{name,exact:true}).waitFor();
   assert.equal(await page.getByText(/Shen’s blue Houseplant|Al’s Puffco/).count(),0);
   const oldFixtures=await page.evaluate(()=>{
    const state={build01:{items:['puffco','houseplant-grinder','local-created'].map(id=>({id,kind:'accessory'})),
      reviews:[{id:'puffco',actor:'existing-user',total:100}],favorites:[]}};
    const rows=runBuild01Fixture('catalog',{kind:'accessory',manage:true},state,'',[],()=>({}));
    return {visible:rows.map(row=>row.id),retained:state.build01.items.filter(row=>row.kind==='accessory').map(row=>row.id),
      reviews:state.build01.reviews.length};
   });
   assert.deepEqual(oldFixtures,{visible:['local-created'],retained:['puffco','houseplant-grinder','local-created'],reviews:1});
   await go('#accessories/houseplant-grinder');
   await page.getByText(/could not be found/i).first().waitFor();
   const controls=page.locator('.ref-demo-controls');
   if(!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
   await page.locator('#demoReviewer').selectOption({label:'Founder · Jordan'});
   await page.locator('#accountPage').waitFor();
   if(await controls.evaluate(el=>el.open))await controls.locator('summary').click();
   await go('#hq/gary');
   await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();
   const toggle=page.getByRole('button',{name:'Founder HQ navigation',exact:true});
   assert.equal(await toggle.getAttribute('aria-expanded'),String(width>=1000));
   const navigation=page.locator('#founder-hq-navigation');
   const priorities=page.getByRole('heading',{name:'Needs attention',exact:true});
   await priorities.waitFor();
   assert((await priorities.boundingBox()).y<520);
   if(width<1000)assert(!await navigation.isVisible());
   assert(!await page.getByText('Scheduled production',{exact:true}).isVisible());
   await capture('founder',priorities);
   if(!await navigation.isVisible())await toggle.click();
   assert.deepEqual(await navigation.locator(':scope > details > summary').allTextContents(),['Today','Relationships','Intelligence','Operations']);
   await capture('navigation',toggle);
   await navigation.getByText('Today',{exact:true}).focus();
   await page.keyboard.press('Escape');
   assert(await toggle.evaluate(el=>el===document.activeElement));
   await toggle.click();
   await navigation.getByText('Relationships',{exact:true}).click();
   assert.equal(await navigation.locator(':scope > details[open]').count(),1);
   await navigation.getByRole('link',{name:'Industry directory',exact:true}).click();
   await page.getByRole('heading',{name:'Industry directory',exact:true}).waitFor();
   if(width<1000)assert.equal(await toggle.getAttribute('aria-expanded'),'false');
   const search=page.getByLabel('Search industry directory');
   await search.fill('Lantern');
   await page.getByRole('button',{name:'Open Hudson Lantern Farm',exact:true}).click();
   await page.getByRole('button',{name:'Back to Industry directory',exact:true}).click();
   assert.equal(await search.inputValue(),'Lantern');
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
   await search.fill('North Loop');
   await page.getByRole('button',{name:'Open North Loop Dispensary',exact:true}).click();
   const history=page.getByRole('heading',{name:'Campaign history',exact:true});
   await history.waitFor();await capture('relationship',history);
   await page.getByRole('button',{name:'Hudson Valley farm tours',exact:true}).click();
   await page.getByRole('button',{name:'Back to Industry directory',exact:true}).click();
   await page.getByRole('heading',{name:'Campaign history',exact:true}).waitFor();
   await page.getByRole('link',{name:'Return to Founder HQ',exact:true}).click();
   await page.getByRole('heading',{name:'Needs attention',exact:true}).waitFor();
   await go('#strains/101');
   await form.getByRole('heading',{name:'Your scorecard'}).waitFor();
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
   await go('#team');
   const photo=page.locator('.editorial-group-people img');
   await photo.evaluate(img=>img.decode());
   const crop=await photo.evaluate(img=>{
    const source=img.getBoundingClientRect(),frame=img.parentElement.getBoundingClientRect();
    return {left:(frame.left-source.left)/source.width,top:(frame.top-source.top)/source.height,
      right:(frame.right-source.left)/source.width,bottom:(frame.bottom-source.top)/source.height};
   });
   assert(crop.left>.14&&crop.top>.30&&crop.right<.73&&crop.bottom>.58);
   await capture('team',photo.locator('..'));
   for(const name of ['Shenny','Greg'])await page.getByRole('heading',{name,exact:true}).waitFor();
   await go('#contact');
   const email=page.getByRole('link',{name:'rated420.ny@gmail.com',exact:true});
   assert.equal(await email.getAttribute('href'),'mailto:rated420.ny@gmail.com');
   assert.equal(await page.locator('#contactPage form').count(),0);
   await capture('contact',email);
   await go('#discover');
   const filters=page.locator('.discover-filters');
   await filters.getByLabel('Search listings').fill('Demo Citrus');
   await page.getByRole('heading',{name:'Demo Citrus',exact:true}).waitFor();
   await page.evaluate(()=>document.documentElement.style.fontSize='200%');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
   assert.deepEqual(errors,[]);
   console.log('PASS',browser.version(),origin,width);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
