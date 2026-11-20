const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:8889';

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.RATED_TEST_CHROME||'/usr/bin/chromium',args:['--no-proxy-server']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}});page.setDefaultTimeout(7000);
  let source=process.env.RATED_PREVIOUS_PACKAGE;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   const file=path.resolve(source,url.pathname.slice(1)||'index.html');
   return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:''});
  });
  await page.goto(origin);await page.locator('#ageYes').click();
  const controls=page.locator('.ref-demo-controls');
  if(await controls.count()&&!await controls.evaluate(el=>el.open))await controls.locator('summary').click();
  await page.locator('#demoReviewer').selectOption({label:'Founder · Jordan'});await page.locator('#accountPage').waitFor();
  const before=await page.evaluate(async()=>{
    const hq=window.GaryStore.openStore(async()=>{});
    await hq.dispatch('save',{collection:'organizations',name:'Persistence Company'},window.GaryStore.founders[0]);
    await window.RatedExpansionStore.session('stash',async()=>{},window.RatedComplete.actor()).save({
      product:'Demo Citrus',status:'Wishlist',notes:'Private persistence canary',scores:[],date:'2026-11-20'
    });
    const data=window.Rated420Intelligence;
    const args={input:'name,id,category\nCompatibility Company,COMPAT-1,Retail',format:'csv',source:'manual',
      mapping:{name:'name',sourceId:'id',category:'category'},choices:{},label:'Saved before refinement'};
    args.expected=JSON.stringify(data.preview(args.input,args.format,args.mapping));
    await data.session(async()=>{}).commit(args);
    return Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('rated420-')));
  });
  source=process.env.RATED_REFINED_PACKAGE;
  await page.reload();await page.getByRole('button',{name:'Browse menu'}).waitFor();
  const after=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([k])=>k.startsWith('rated420-'))));
  assert.deepEqual(after,before);
  await page.goto(origin+'/#hq/intelligence');
  await page.getByRole('button',{name:'History',exact:true}).click();
  await page.getByRole('heading',{name:'Saved before refinement'}).waitFor();
  await page.goto(origin+'/#hq/gary/organizations');
  await page.getByRole('heading',{name:'Persistence Company',exact:true}).waitFor();
  console.log('Same-origin upgrade preserved exact prior local storage, CRM and import history.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
