const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const path = require('node:path');
const {existsSync} = require('node:fs');

const packaged = 'http://127.0.0.1:8767';
const integrated = 'http://127.0.0.1:8813';

(async () => {
  const browser = await chromium.launch({
    executablePath:process.env.RATED_TEST_CHROME || '/usr/bin/chromium',
    args:['--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1']
  });
  async function fixture(origin, width) {
    const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const page = await context.newPage();
    page.setDefaultTimeout(7000);
    const requests = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { requests.push(url.href); return route.abort(); }
      if (origin === packaged) return route.continue();
      const file = path.resolve(__dirname,'../dist',url.pathname.slice(1) || 'index.html');
      return existsSync(file) ? route.fulfill({path:file}) : route.fulfill({status:404,body:''});
    });
    return {page,async finish() {
      await context.close();
      assert.deepEqual(requests,[]);
      assert.deepEqual(errors,[]);
    }};
  }

  async function imageShape(page, selector, expected) {
    const locator = page.locator(selector);
    await locator.waitFor({state:'visible'});
    const dims = await locator.evaluate(img => ({
      width:img.naturalWidth, height:img.naturalHeight,
      rendered:img.getBoundingClientRect().toJSON(),
      cover:getComputedStyle(img).objectFit, crop:getComputedStyle(img).borderRadius
    }));
    assert.equal(dims.cover,'cover');
    assert.equal(dims.crop,'50%');
    assert.ok(Math.abs(dims.rendered.width - dims.rendered.height) < .1);
    if (expected === 'wide') assert.ok(dims.width > dims.height);
    if (expected === 'tall') assert.ok(dims.height > dims.width);
  }

  const noOverflow = async page => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const exampleImg = '#profile-examples .profile-avatar img.avatar-loaded';
  try {
    for (const width of [320,390,820,1366]) {
      const {page,finish} = await fixture(packaged,width);
      let releasePortrait;
      const waitForPortrait = new Promise(resolve => { releasePortrait = resolve; });
      await page.route('**/profile-portrait-wide.png', async route => {
        await waitForPortrait;
        await route.continue();
      }, {times:1});
      await page.goto(packaged+'/#profiles/populated',{waitUntil:'domcontentloaded'});
      await page.locator('#profile-examples .profile-avatar-fallback').getByText('MR',{exact:true}).waitFor();
      assert.equal(await page.locator(exampleImg).count(),0);
      releasePortrait();
      assert.match(await page.title(),/^Rated420 HQ/);
      await page.getByRole('heading',{name:/Morgan Avery-Lantern/}).waitFor();
      await imageShape(page,exampleImg,'wide');
      assert.equal(await page.locator('.profile-review-list article').count(),3);
      assert.equal(await page.getByRole('button',{name:'Remove avatar'}).count(),0);
      await noOverflow(page);

      await page.goto(packaged+'/#profiles/missing');
      await page.getByRole('heading',{name:'Jules Rivera'}).waitFor();
      await page.getByText('No reviews yet.').waitFor();
      await page.locator('#profile-examples .profile-avatar-fallback').getByText('JR',{exact:true}).waitFor();
      assert.equal(await page.locator(exampleImg).count(),0);
      await noOverflow(page);

      await page.goto(packaged+'/#profiles/edit');
      await page.getByRole('heading',{name:'Edit profile'}).waitFor();
      const button = name => page.getByRole('button',{name,exact:true});
      await button('Use sample photo').click();
      await imageShape(page,exampleImg,'tall');
      await page.reload();
      await imageShape(page,exampleImg,'tall');
      await page.getByRole('link',{name:'View as visitor'}).click();
      await imageShape(page,exampleImg,'tall');

      await page.getByRole('link',{name:'Owner edit example'}).click();
      await page.getByLabel('Choose a local photo').setInputFiles(path.resolve(__dirname,'../preview/profiles/images/profile-portrait-wide.png'));
      await button('Save photo').click();
      await page.getByRole('status').filter({hasText:'Photo saved in this browser.'}).waitFor();
      await page.reload();
      await imageShape(page,'#profile-examples img.avatar-loaded[src^="data:image/"]','wide');

      await button('Remove avatar').click();
      await page.getByRole('status').filter({hasText:'Avatar removed'}).waitFor();
      await page.reload();
      await page.locator('#profile-examples .profile-avatar-fallback').getByText('MR',{exact:true}).waitFor();
      assert.equal(await page.locator(exampleImg).count(),0);
      await noOverflow(page);
      await button('Reset profile example').click();
      await page.reload();
      await imageShape(page,'#profile-examples img.avatar-loaded[src="images/profile-portrait-wide.png"]','wide');
      await page.getByRole('link',{name:'Founder workspace'}).click();
      await page.getByRole('heading',{name:'Overview',exact:true}).waitFor();
      await finish();
      console.log('Packaged profile routes, upload, remove, reload and reset passed at '+width+'px');
    }

    for (const width of [320,820,1366]) {
      const {page,finish} = await fixture(integrated,width);
      await page.goto(integrated);
      await page.locator('#ageYes').click();
      await page.locator('#demoReviewer').selectOption({label:'Reviewer B'});
      await page.locator('#accountPage').waitFor();
      const edit = page.getByRole('link',{name:'Edit profile',exact:true});
      assert((await edit.boundingBox()).height >= 44);
      await edit.click();
      assert.equal(await page.evaluate(()=>document.activeElement.id),'profileEditorTitle');
      await page.locator('#profileDisplayName').fill('Morgan Avery-Lantern and Hudson Valley Review Notes');
      await page.locator('#profileReviewIdentity').check();
      await page.locator('#avatarFile').setInputFiles(path.resolve(__dirname,'../preview/profiles/images/profile-portrait-tall.png'));
      await page.getByRole('button',{name:'Save profile',exact:true}).click();
      await page.getByText('Profile saved to your Rated420 account.').waitFor();
      await imageShape(page,'#memberAvatar.avatar-loaded','tall');
      await noOverflow(page);
      await page.locator('#publicProfileLink').click();
      await page.getByRole('heading',{name:'@demo_b',exact:true}).waitFor();
      assert.equal(await page.locator('#hqContent .profile-avatar img[src]').count(),0);
      await page.goBack();
      await page.locator('#demoReviewer').selectOption({label:'Reviewer A'});
      await page.locator('#demoReviewer').selectOption({label:'Reviewer B'});
      await page.locator('#accountPage').waitFor();
      await imageShape(page,'#memberAvatar.avatar-loaded','tall');
      await page.locator('#profileForm input[name=avatar][value=""]').check();
      await page.getByRole('button',{name:'Save profile',exact:true}).click();
      await page.waitForFunction(()=>!document.querySelector('#memberAvatar').hasAttribute('src'));
      await page.locator('#publicProfileLink').click();
      await page.getByRole('heading',{name:'@demo_b',exact:true}).waitFor();
      assert.equal(await page.getByRole('link',{name:'Edit profile'}).count(),0);
      assert.equal(await page.getByText('Morgan Avery-Lantern and Hudson Valley Review Notes',{exact:true}).filter({visible:true}).count(),0);
      assert.equal(await page.locator('#hqContent .profile-avatar img[src]').count(),0);
      await noOverflow(page);
      await finish();
      console.log('Integrated synthetic account edit, photo removal and public visibility passed at '+width+'px');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
