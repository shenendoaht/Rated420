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
 const baseline=process.env.RATED_BASELINE_PACKAGE;
 const files=baseline||process.env.RATED_PACKAGE;
 const folder=process.env.RATED_SCREENSHOTS_DIR;
 try{
  for(const width of [320,375,390,430,820,1440]){
   const context=await browser.newContext({viewport:{width,height:width<=430?667:900},reducedMotion:'reduce',hasTouch:width<=430});
   const page=await context.newPage();
   page.setDefaultTimeout(9000);
   const errors=[],external=[];
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){external.push(url.href);return route.abort();}
    if(files)return route.fulfill({path:path.join(files,url.pathname.slice(1)||'index.html')});
    return hosted?hostedFile(url.href).then(asset=>route.fulfill(asset)):route.continue();
   });
   await page.goto(origin);await page.locator('#ageYes').click();
   const menu=page.getByRole('button',{name:'Browse menu',exact:true});
   const nav=page.locator('#ref-public-navigation');
   const capture=async name=>{
    if(!folder)return;
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(folder,(baseline?'before':'after')+'-'+name+'-'+width+'.png'),animations:'disabled'});
   };
   if(width<=900){
    await menu.press('Enter');await nav.waitFor();
    if(!baseline){
     assert.equal(await menu.getAttribute('aria-expanded'),'true');
     await menu.press('Tab');
     assert(await nav.getByRole('link',{name:'Home',exact:true}).evaluate(row=>document.activeElement===row));
    }
    for(const name of ['Explore','Community','About']){
     const group=nav.getByText(name,{exact:true});
     await group.press('Enter');
     assert.equal(await group.evaluate(node=>node.parentElement.open),true);
     if(!baseline){
      assert.equal(await nav.locator('details[open]').count(),1);
      const metrics=await nav.evaluate(node=>({
       height:node.getBoundingClientRect().height,scrollHeight:node.scrollHeight,
       overflow:node.scrollWidth>node.clientWidth+1,
       rows:[...node.querySelectorAll('a,button,summary')].filter(el=>el.getBoundingClientRect().height).map(el=>{
        const style=getComputedStyle(el);
        return [el.getBoundingClientRect().height,style.fontSize,style.borderTopWidth,style.textAlign];
       })
      }));
      assert(metrics.height<=370&&!metrics.overflow);
      assert(metrics.rows.every(([height,font,border,align])=>height>=44&&font===metrics.rows[0][1]&&border==='0px'&&align==='left'));
      if(name==='Explore'){
       assert(metrics.scrollHeight>metrics.height);
       if(width===390)await capture('menu-explore');
       await nav.locator('.nav-catalogue-links a').last().focus();
       assert(await nav.evaluate(el=>el.scrollTop>0));
      }
     }
     if(width===390&&(baseline||name!=='Explore'))await capture('menu-'+name.toLowerCase());
     if(baseline)await group.press('Enter');
    }
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'),'false');
    assert(await menu.evaluate(node=>document.activeElement===node&&node.matches(':focus-visible')));
    if(!baseline){
     await menu.press('Enter');
     if(width<=430)await menu.tap();else await menu.click();
     assert.equal(await nav.locator('details[open]').count(),0);
     await menu.press('Enter');await page.mouse.click(3,200);
     assert.equal(await menu.getAttribute('aria-expanded'),'false');
     await menu.press('Enter');
     await nav.getByText('About',{exact:true}).press('Enter');
     const contact=nav.getByRole('link',{name:'Contact',exact:true});
     await contact.press('Enter');
     await page.locator('#contactPage').waitFor();
     assert.equal(await menu.getAttribute('aria-expanded'),'false');
     await page.goto(origin+'/');
     await page.evaluate(()=>document.documentElement.style.fontSize='200%');
     await menu.press('Enter');await nav.getByText('Explore',{exact:true}).press('Enter');
     assert(await nav.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
     await page.keyboard.press('Escape');
     await page.evaluate(()=>document.documentElement.style.removeProperty('font-size'));
    }
   }
   const tools=page.locator('.ref-demo-controls');
   if(!baseline&&width<=760)await tools.getByText('Rated420 development sandbox',{exact:true}).waitFor();
   await tools.locator('summary').click();
   await page.locator('#demoReviewer').selectOption({label:'Founder · Jordan'});
   await page.locator('#accountPage').waitFor();
   if(await tools.evaluate(el=>el.open))await tools.locator('summary').click();
   for(const [name,hash,selector] of [
    ['hq','#hq',baseline?'#hqContent h2':'.founder-unified h2'],
    ['founder','#hq/gary','.gary-body h2'],
    ['territory','#hq/gary/territory','.territory-regions']
   ]){
    await page.goto(origin+'/'+hash);
    await page.locator(selector).first().waitFor();
    if(name==='territory'){
     const region=page.getByRole('button',{name:/Hudson Valley/});
     await region.press('Enter');
     assert.equal(await region.getAttribute('aria-pressed'),'true');
     if(!baseline){
      const count=await region.locator('.territory-count').textContent();
      await page.getByText(new RegExp('^'+count+' official license locations')).waitFor();
     }
     await page.locator('.territory-map h3, .expansion h3').first().scrollIntoViewIfNeeded();
    }
    if([390,1440].includes(width))await capture(name);
   }
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   console.log('PASS',browser.version(),baseline?'baseline':origin,width);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
