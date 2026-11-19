const {chromium}=require('playwright');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.RATED_TEST_CHROME,
    args:['--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']});
  const served=process.env.RATED_TEST_ORIGIN;
  const origin=served||'http://127.0.0.1:8765';
  try {
    for(const width of [1280,390]) {
      const context=await browser.newContext({viewport:{width,height:950},reducedMotion:'reduce'});
      const page=await context.newPage();
      const errors=[],network=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>{
        const url=new URL(route.request().url());
        if(url.origin!==origin){network.push(url.href);return route.abort();}
        if(served)return route.continue();
        const file=url.pathname==='/'?'index.html':url.pathname.slice(1);
        const type=file.endsWith('.html')?'text/html':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'image/webp';
        return route.fulfill({contentType:type,body:readFileSync(path.join(__dirname,'../dist',file))});
      });
      await page.goto(origin);
      await page.locator('#ageYes').click();
      const go=async hash=>{
        await page.evaluate(value=>{location.hash=value;},hash);
        await page.locator('#hqContent').waitFor();
      };
      const reviewer=async label=>{
        await page.locator('#demoReviewer').selectOption({label});
        await page.locator('#accountPage').waitFor();
      };
      await go('#discover');
      await page.getByRole('heading',{name:'Demo Citrus'}).waitFor();
      await page.getByLabel('Search listings').fill('Demo Orchard');
      await page.getByRole('heading',{name:'Demo Orchard Co.'}).waitFor();
      assert.equal(await page.getByRole('heading',{name:'Demo Citrus'}).count(),0);
      await page.getByRole('button',{name:'Reset filters'}).click();
      await page.getByLabel('Category').selectOption('strain');
      await page.getByLabel('Format from reviews').selectOption('Flower');
      await page.getByLabel('Sort by').selectOption('average');
      assert.equal(await page.getByRole('heading',{name:'Demo Orchard Co.'}).count(),0);
      await reviewer('Reviewer B');
      await go('#hq');
      await page.getByText('Rated420 HQ is available to authorized staff.').waitFor();
      const rpc=(operation,payload={})=>page.evaluate(async args=>window.supabase.createClient().rpc('rated420_build02',args),{operation,payload});
      assert.match((await rpc('analytics')).error.message,/HQ access/);
      await go('#contribute');
      await page.getByLabel('Category').selectOption('brand');
      await page.getByLabel('Listing name').fill('Fixture Studio');
      await page.getByLabel('Supporting details').fill('Synthetic studio for moderation.');
      await page.getByLabel('Supporting photo (optional)').setInputFiles({name:'test.png',mimeType:'image/png',
        buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=','base64')});
      await page.getByRole('button',{name:'Send for review'}).click();
      await page.getByRole('heading',{name:'Fixture Studio'}).waitFor();
      const entry=(await rpc('mine')).data[0];
      assert.equal(entry.status,'Pending');
      assert.match((await rpc('submit',{kind:'brand',name:' fixture   studio '})).error.message,/already pending/);
      assert.match((await rpc('moderate',{id:entry.id,status:'Approved'})).error.message,/HQ access/);
      assert(!(await rpc('catalog')).data.some(r=>r.name==='Fixture Studio'));
      await reviewer('Staff member');
      await go('#hq');
      await page.getByText('Fixture Studio · Pending').click();
      await page.getByRole('button',{name:'Open supporting photo'}).click();
      const photo=page.getByAltText('Private supporting photo');
      await photo.waitFor();
      assert(await photo.evaluate(async image=>{await image.decode();return image.naturalWidth>0;}));
      await page.getByRole('button',{name:'Record decision'}).click();
      await page.getByText('Fixture Studio · Approved').waitFor();
      const approved=(await rpc('queue')).data[0];
      assert.equal((await rpc('moderate',{id:entry.id,status:'Approved'})).data,approved.listing);
      assert.equal((await rpc('catalog')).data.filter(r=>r.name==='Fixture Studio').length,1);
      assert.match((await rpc('staff_role',{id:entry.actor,status:'staff'})).error.message,/unavailable/);
      await page.getByRole('button',{name:'Analytics',exact:true}).click();
      await page.getByRole('heading',{name:'Approved submissions'}).waitFor();
      const metrics=(await rpc('analytics')).data;
      assert.equal(metrics.submissions.Approved,1);
      assert.equal(metrics.rankings.find(r=>r.username==='demo_b').contributions,1);
      assert.equal(metrics.accounts,5);
      await page.getByRole('button',{name:'Polls',exact:true}).click();
      await page.getByRole('button',{name:'Close voting'}).click();
      await page.getByText('Closed',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Episodes',exact:true}).click();
      await page.getByLabel('Title',{exact:true}).first().fill('Synthetic poll recap');
      await page.getByLabel('Closed poll recap').first().selectOption('demo-poll');
      await page.getByLabel('Visibility').first().selectOption('true');
      await page.getByRole('button',{name:'Create entry'}).click();
      await page.getByText('Synthetic poll recap · Published').waitFor();
      await go('#episodes');
      await page.getByRole('heading',{name:'Synthetic poll recap'}).waitFor();
      await page.getByText('Final poll recap · 0 votes').click();
      await page.getByText('What should The Vault cover next?').waitFor();
      await go('#shop');
      await page.getByRole('heading',{name:'Rated420 hoodie'}).waitFor();
      assert.equal(await page.getByRole('button',{name:/buy|checkout/i}).count(),0);
      await reviewer('Administrator');
      await go('#hq');
      await page.getByRole('button',{name:'Access',exact:true}).click();
      await page.getByLabel('Auth user ID').fill(entry.actor);
      await page.getByRole('button',{name:'Save staff access'}).click();
      await page.getByLabel('Auth user ID').waitFor();
      await page.waitForFunction(user=>JSON.parse(localStorage.getItem('rated420-community-demo-v1')).build02.roles[user]==='staff',entry.actor);
      await page.reload();
      await page.getByRole('button',{name:'Access',exact:true}).waitFor();
      await go('#profile/demo_b');
      await page.getByRole('heading',{name:'@demo_b'}).waitFor();
      await page.getByRole('heading',{name:'Contributor recognition'}).waitFor();
      assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
      assert.deepEqual(errors,[]);
      if(served)assert.deepEqual(network,[]);
      console.log('Build 02 discovery, moderation, access, analytics, recap, showroom and profile passed at '+width+'px');
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
