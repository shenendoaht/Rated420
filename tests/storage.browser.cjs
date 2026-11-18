const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const dist = path.resolve(__dirname, '../dist');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=', 'base64');
const memberA = '11111111-1111-4111-8111-111111111111';
const memberB = '22222222-2222-4222-8222-222222222222';

function installFaults() {
    const create = window.supabase.createClient;
    const source = create();
    const prototype = Object.getPrototypeOf(source.from('strain_reviews'));
    const run = prototype.run;
    prototype.run = function () {
      const fault = window.storageFault;
      const write = this.table === 'strain_reviews' && ['insert', 'update'].includes(this.operation);
      if (write && fault === 'reject-write') {
        window.storageFault = null;
        return { error: { code: '23514', message: 'Synthetic constraint rejection' } };
      }
      if (write && fault === 'unknown-no-commit') {
        window.storageFault = null;
        throw new Error('Synthetic timeout');
      }
      const result = run.call(this);
      if (write && !result.error && fault === 'refresh-failure') window.storageFault = 'fail-next-refresh';
      if (this.table === 'strain_community_stats' && fault === 'fail-next-refresh') {
        window.storageFault = null;
        return { error:{message:'Synthetic catalogue refresh failure'} };
      }
      if (write && !result.error && fault === 'committed-response-lost') {
        window.storageFault = null;
        throw new Error('Synthetic response lost after commit');
      }
      return result;
    };
    window.supabase.createClient = (...args) => {
      const client = create(...args);
      const from = client.storage.from;
      client.storage.from = bucket => {
        const api = from(bucket);
        const remove = api.remove;
        const sign = api.createSignedUrl;
        api.remove = paths => window.storageFault === 'cleanup' ?
          Promise.resolve({error:{message:'Synthetic cleanup failure'}}) : remove(paths);
        api.createSignedUrl = (...signArgs) => {
          if (window.storageFault !== 'expired-url') return sign(...signArgs);
          window.storageFault = null;
          return Promise.resolve({data:{signedUrl:'data:image/png;base64,a'},error:null});
        };
        return api;
      };
      return client;
    };
}

async function run(width, browser) {
  const page = await browser.newPage({ viewport: { width, height: 950 }, reducedMotion: 'reduce' });
  const external = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'storage.test') {
      external.push(url.hostname);
      return route.abort();
    }
    const file = path.join(dist, url.pathname === '/' ? 'index.html' : url.pathname);
    if (url.pathname === '/community-demo.js') {
      return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(file,'utf8')+'\n('+installFaults+')();'});
    }
    return route.fulfill({ path: file, contentType: file.endsWith('.js') ? 'text/javascript' : undefined });
  });
  await page.goto('https://storage.test/');
  await page.locator('#ageYes').click();
  await page.locator('#demoReviewer').selectOption(memberA);
  await page.locator('#accountPage').waitFor({state:'visible'});
  await page.locator('#profileForm input[name="avatar"][value="upload"]').check();
  await page.locator('#avatarFile').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:png});
  await page.evaluate(() => { window.storageFault = 'expired-url'; });
  await page.getByRole('button',{name:'Save profile',exact:true}).click();
  await page.getByText('Profile saved to your Rated420 account.').waitFor();
  await page.waitForFunction(() => {
    const image = document.getElementById('memberAvatar');
    return image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0;
  });
  const avatarPath = await page.evaluate(async () => {
    const {data} = await window.supabase.createClient().from('member_profiles').select('avatar_path').single();
    return data.avatar_path;
  });
  await page.locator('#demoReviewer').selectOption(memberB);
  const privateCheck = await page.evaluate(async avatar => {
    const api = window.supabase.createClient().storage.from('member-avatars');
    return [(await api.createSignedUrl(avatar)).error?.message, api.getPublicUrl(avatar).data.publicUrl,
      (await api.remove([avatar])).error?.message];
  }, avatarPath);
  assert(privateCheck[0]); assert.equal(privateCheck[1], ''); assert(privateCheck[2]);
  await page.locator('#demoReviewer').selectOption(memberA);
  await page.locator('#accountPage').waitFor({state:'visible'});
  const openStrains = async () => {
    await page.locator('#brandLink').click();
    await page.locator('#homePage [data-open-strains="catalogue"]').click();
    await page.locator('#rated420-strain-options button').filter({hasText:'Demo Citrus'}).click();
    await page.locator('#rated420-strain-brand').fill('Storage fixture');
  };
  await openStrains();
  const photo = page.locator('#rated420-strain-photo');
  const setPhoto = () => photo.setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:png});
  const uploadFault = fault => page.evaluate(value => {window.storageFault=value;}, fault);
  const currentImage = () => page.evaluate(async () => {
    const {data} = await window.supabase.createClient().from('strain_reviews')
      .select('photo_path').eq('brand','Storage fixture').maybeSingle();
    return data?.photo_path;
  });
  const photoKeys = () => page.evaluate(() => new Promise((resolve,reject) => {
    const request=indexedDB.open('rated420-community-demo-v1-photos',1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      const database=request.result;
      const keys=database.transaction('photos').objectStore('photos').getAllKeys();
      keys.onsuccess=()=>{resolve(keys.result);database.close();};
      keys.onerror=()=>reject(keys.error);
    };
  }));
  await photo.setInputFiles({name:'unsupported.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')});
  await page.getByText('Use a JPG, PNG, or WebP image under 5 MB.').waitFor();
  const nearLimit = Buffer.concat([png,Buffer.alloc(5 * 1024 * 1024 - png.length)]);
  await photo.setInputFiles({name:'limit.png',mimeType:'image/png',buffer:nearLimit});
  await uploadFault('committed-response-lost');
  await page.locator('#reviewSaveButton').click();
  await page.getByText(/Your 0\/420 rating is saved/).waitFor();
  const first = await currentImage();
  assert(first);
  assert((await photoKeys()).includes('strain-review-photos/'+first));
  assert(!(await page.evaluate(()=>localStorage.getItem('rated420-community-demo-v1'))).includes('base64'));
  await page.reload();
  await openStrains();
  const firstImage = page.locator('.strain-review-thumb').first();
  await firstImage.scrollIntoViewIfNeeded();
  await firstImage.evaluate(image=>image.decode());
  assert((await firstImage.getAttribute('src')).startsWith('blob:'));
  await setPhoto();
  await uploadFault('reject-write');
  await page.locator('#reviewSaveButton').click();
  await page.getByText('Synthetic constraint rejection').waitFor();
  assert.equal(await currentImage(), first);
  assert.equal((await photoKeys()).filter(k=>k.startsWith('strain-review-photos/')).length,1);
  await setPhoto();
  await uploadFault('unknown-no-commit');
  await page.locator('#reviewSaveButton').click();
  await page.getByText(/Could not confirm the save/).waitFor();
  assert.equal(await currentImage(), first);
  assert.equal((await photoKeys()).filter(k=>k.startsWith('strain-review-photos/')).length,2);
  await setPhoto();
  await uploadFault('refresh-failure');
  await page.locator('#reviewSaveButton').click();
  await page.getByText(/Synthetic catalogue refresh failure/).waitFor();
  const keptAfterRefresh = await currentImage();
  assert.notEqual(keptAfterRefresh,first);
  assert((await photoKeys()).includes('strain-review-photos/'+keptAfterRefresh));
  await page.waitForFunction(key=>!window.supabase.createClient().storage.from('strain-review-photos')
    .getPublicUrl(key).data.publicUrl,first);
  await page.locator('#rated420-strain-brand').fill('Storage fixture');
  await setPhoto();
  await uploadFault('cleanup');
  await page.locator('#reviewSaveButton').click();
  await page.getByText(/Your \d+\/420 rating is saved/).waitFor();
  await page.getByText(/Image cleanup could not be confirmed/).waitFor();
  const replacement = await currentImage();
  assert.notEqual(replacement, keptAfterRefresh);
  assert((await photoKeys()).includes('strain-review-photos/'+keptAfterRefresh));
  await uploadFault(null);
  await page.locator('#navAccount').click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#myStrainReviewList article').filter({hasText:'Storage fixture'})
    .getByRole('button',{name:'Delete',exact:true}).click();
  await page.waitForFunction(async key => {
    const mock=window.supabase.createClient();
    const {data}=await mock.from('strain_reviews').select('id').eq('brand','Storage fixture');
    return !data.length && !mock.storage.from('strain-review-photos').getPublicUrl(key).data.publicUrl;
  },replacement);
  const quotaError = await page.evaluate(async member => {
    const originalAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = () => {throw new DOMException('Fixture quota', 'QuotaExceededError');};
    try {
      const api = window.supabase.createClient().storage.from('member-avatars');
      const {error} = await api.upload(member+'/quota.png', new Blob(['fixture'],{type:'image/png'}));
      return error?.message;
    } finally {IDBObjectStore.prototype.add = originalAdd;}
  },memberA);
  assert.match(quotaError,/storage is full/i);
  await page.locator('#brandLink').click();
  await page.locator('#homePage [data-open-strains="catalogue"]').click();
  await page.locator('#strainPage [data-open-dispensary]').click();
  await page.locator('#dispensaryOptions button').filter({hasText:'Demo Community Shop'}).click();
  const dispensary = page.locator('#dispensaryForm');
  await dispensary.locator('input[name="photo"]').setInputFiles({name:'shop.png',mimeType:'image/png',buffer:png});
  await page.locator('#saveDispensary').click();
  await page.getByText('Dispensary rating saved.',{exact:true}).waitFor();
  const shopPath = await page.evaluate(async member => {
    const {data}=await window.supabase.createClient().from('dispensary_reviews')
      .select('photo_path').eq('user_id',member).single();
    return data.photo_path;
  },memberA);
  assert((await photoKeys()).includes('dispensary-review-photos/'+shopPath));
  await page.locator('#navAccount').click();
  const shop = page.locator('#myDispensaryReviewList article').filter({hasText:'Demo Community Shop'});
  await shop.getByRole('button',{name:'Edit',exact:false}).click();
  await page.waitForFunction(() => {
    const image=document.getElementById('dispensaryPhotoPreview');
    return image.src.startsWith('blob:') && image.complete && image.naturalWidth > 0;
  });
  await dispensary.locator('input[name="removePhoto"]').check();
  await page.locator('#saveDispensary').click();
  await page.getByText('Dispensary rating saved.',{exact:true}).waitFor();
  await page.waitForFunction(key=>!window.supabase.createClient().storage.from('dispensary-review-photos')
    .getPublicUrl(key).data.publicUrl,shopPath);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  assert(!external.some(host=>host.endsWith('supabase.co')));
  await page.close();
  console.log(`Storage browser regression passed at ${width}px`);
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  try { for(const width of [1280,390]) await run(width,browser); }
  finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
