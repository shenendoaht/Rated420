const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const origin='http://127.0.0.1:8768';

(async()=>{
  const browser=await chromium.launch({
    executablePath:process.env.RATED_TEST_CHROME||'/usr/bin/chromium',
    args:['--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']
  });
  try{
    for(const width of [390,820,1366]){
      const context=await browser.newContext({viewport:{width,height:950}});
      const page=await context.newPage();
      page.setDefaultTimeout(5500);
      const errors=[],external=[],missing=[];
      page.on('pageerror',e=>errors.push(e.message));
      page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('/favicon.ico'))missing.push(r.url());});
      await page.route('**/*',r=>{
        if(new URL(r.request().url()).origin!==origin){external.push(r.request().url());return r.abort();}
        return r.continue();
      });
      const go=hash=>page.goto(origin+'/'+hash);
      const heading=name=>page.getByRole('heading',{name,exact:true});
      const button=name=>page.getByRole('button',{name,exact:true});
      const demo=page.locator('#demoReviewer');
      const switchTo=async label=>{await demo.selectOption({label});await page.locator('#accountPage').waitFor();};
      await go('');
      await page.locator('#ageYes').click();
      await page.locator('#homePage h1').waitFor();
      for(const [hash,title] of [['#discover','Explore the catalog'],['#episodes','The Vault episodes'],['#shop','The Shop'],
        ['#businesses','Business directory'],['#contact','Let’s talk.'],['#profile-examples/missing','Profile examples']]){
        await go(hash);await heading(title).waitFor();
      }
      for(const hash of ['#vault','#brands','#accessories','#strains','#dispensaries','#about']){
        await go(hash);
        await page.locator(hash==='#about'?'#rated420-standard':hash==='#strains'?'#strainPage':hash==='#dispensaries'?'#dispensaryPage':'#buildPage').waitFor();
      }
      await go('#contact');
      await page.getByLabel('Name',{exact:true}).fill('Taylor Example');
      await page.getByLabel('Topic',{exact:true}).fill('Partnership');
      await page.getByLabel('Message',{exact:true}).fill('Offline contact scenario.');
      await button('Save demo inquiry').click();
      await page.getByText(/No email was sent/).waitFor();
      await go('#hq/gary/finance');
      await page.getByText(/available to authorized staff/).waitFor();

      await switchTo('Community member · Maya');
      await button('Open The Stash').click();
      await button('Edit Amber Trail Flower').click();
      await page.getByLabel('Status',{exact:true}).selectOption('Tried');
      await page.getByLabel('Private tasting notes',{exact:true}).fill('PRIVATE STASH TEXT 841');
      for(const field of ['Aesthetic','Aroma','Flavor','Effects','Overall'])await page.getByRole('dialog').getByLabel(field,{exact:true}).fill('70');
      await button('Save record').click();
      const card=page.locator('#accountStash article').filter({has:heading('Amber Trail Flower')});
      await card.getByRole('button',{name:'Preview public review'}).click();
      await button('Confirm publication').click();
      await page.getByRole('dialog').waitFor();
      await page.getByLabel('Public review text',{exact:true}).fill('PUBLIC STASH REVIEW 410');
      await page.getByLabel('I confirm this review may appear in the public demo').check();
      await button('Confirm publication').click();
      await page.getByText(/Review published/).waitFor();
      await page.locator('#myStrainReviewList').getByText('Amber Trail Flower').waitFor();
      await go('#demo-reviews');
      await page.getByText('PUBLIC STASH REVIEW 410',{exact:true}).waitFor();
      assert.equal(await page.getByText('PRIVATE STASH TEXT 841',{exact:true}).count(),0);
      await page.getByRole('link',{name:'Open strain and community scores'}).click();
      await page.locator('#strainPage').getByText(/350 \/ 420/).first().waitFor();
      await go('#businesses/org-brand');
      await page.getByText(/350 \/ 420 · 1 reviewers/).waitFor();
      await page.reload();
      await page.getByText(/350 \/ 420 · 1 reviewers/).waitFor();
      await switchTo('Alternate member · Riley');
      await button('Open The Stash').click();
      await heading('The Stash').waitFor();
      assert.equal(await page.getByText('PRIVATE STASH TEXT 841',{exact:true}).count(),0);
      await switchTo('Business representative · Morgan');
      await page.getByRole('link',{name:'Business dashboard',exact:true}).click();
      await heading('Field Signal').waitFor();
      await page.getByRole('link',{name:'Suggest or track a listing'}).click();
      await heading('Contribute a listing').waitFor();

      await switchTo('Moderator · Camille');
      await go('#hq/gary/finance');
      await page.getByText(/available to founders and administrators/).waitFor();
      await go('#hq');
      await button('Catalog').click();
      await page.getByText('Amber Trail Flower · strain · 104',{exact:true}).click();
      const detail=page.locator('details').filter({hasText:'Amber Trail Flower · strain · 104'});
      await detail.getByLabel('Visibility in discovery').selectOption('true');
      await detail.getByRole('button',{name:'Save listing'}).click();
      await page.getByText('Amber Trail Flower · strain · 104 · Archived',{exact:true}).waitFor();
      await go('#demo-reviews');
      await page.getByText('No published demo reviews.').waitFor();
      await go('#businesses/org-brand');
      await heading('Field Signal').waitFor();
      assert.equal(await page.getByRole('link',{name:'Amber Trail Flower'}).count(),0);

      await switchTo('Administrator · Adair');
      await go('#hq');
      await button('Access').waitFor();
      await switchTo('Founder · Jordan');
      await go('#hq/gary');
      await heading('Overview').waitFor();
      await page.getByRole('link',{name:'Financial Command Center'}).click();
      await heading('Posted revenue').waitFor();
      await page.getByRole('link',{name:'Territory Explorer'}).click();
      await heading('New York territory map').waitFor();
      await demo.selectOption({label:'Logged-out visitor'});
      await page.locator('#homePage h1').waitFor();

      await page.locator('#navJoin').click();
      await page.locator('#signupUsername').fill('test_synthetic');
      await page.locator('#signupEmail').fill('local-person@example.test');
      await page.locator('#signupPassword').fill('demo-only-420');
      await page.locator('#signupConfirm').fill('demo-only-420');
      await page.locator('#signupAge').check();
      await page.locator('#signupForm button[type=submit]').click();
      await heading('test_synthetic').waitFor();
      await button('Sign out').click();
      await page.locator('#navLogin').click();
      await page.locator('#loginEmail').fill('local-person@example.test');
      await page.locator('#loginPassword').fill('demo-only-420');
      await page.locator('#loginForm button[type=submit]').click();
      await heading('test_synthetic').waitFor();
      await Promise.all([page.waitForNavigation({waitUntil:'load'}),button('Reset demo data').click()]);
      await page.locator('#homePage h1').waitFor();
      assert.equal(await page.getByRole('option',{name:'Local member · test_synthetic'}).count(),0);
      assert.deepEqual(errors,[]);
      assert.deepEqual(external,[]);
      assert.deepEqual(missing,[]);
      await page.evaluate(()=>document.fonts.ready);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'Homepage overflow at '+width+' px');
      await context.close();
      console.log('Unified navigation, roles, registration/login, Stash aggregate, business, moderation, reset and offline assets passed at '+width+' px.');
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
