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
   assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),before);
   await capture('calculator',calculator.locator('h2'));
   await go('#strains/101');
   const form=page.locator('#rated420-strain-rating-form');
   await form.getByRole('slider',{name:'Flavor',exact:true}).waitFor();
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
   assert.deepEqual(errors,[]);
   console.log('PASS',browser.version(),origin,width);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
