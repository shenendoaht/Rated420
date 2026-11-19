const {chromium}=require('playwright');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.RATED_TEST_CHROME});
  try {
    for(const width of [1280,390,320]){
      const page=await browser.newPage({viewport:{width,height:900}});
      const seen=[];
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!=='http://rated420.test'){seen.push(url.hostname);return route.abort();}
        const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
        const type=file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/webp';
        return route.fulfill({contentType:type,body:readFileSync(path.join(__dirname,'../dist',file))});
      });
      await page.goto('http://rated420.test/');
      await page.locator('#ageYes').click();
      await page.locator('.footer-contact').click();
      const email=page.locator('#contactPage').getByRole('link',{name:'rated420.ny@gmail.com'});
      assert.equal(await email.getAttribute('href'),'mailto:rated420.ny@gmail.com');
      assert.equal(await page.locator('#contactPage form').count(),0);
      assert(!seen.some(h=>h.endsWith('.supabase.co')||h.includes('turnstile')||h.includes('resend')));
      console.log('Contact navigation and mailto passed at '+width+'px');
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
