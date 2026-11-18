// Run inside a disposable, network-isolated Storage API fixture whose only listener
// is on loopback. These credentials and UUIDs are exclusively synthetic.
const assert = require('node:assert/strict');
const { createHmac, randomUUID } = require('node:crypto');
const origin = 'http://127.0.0.1:5500';
const secret = 'rated420-local-fixture-jwt-key-not-for-production';
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=', 'base64');
const additionalFormats = [
  ['jpg','image/jpeg',Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCvRRRXjHGf/9k=','base64')],
  ['webp','image/webp',Buffer.from('UklGRjQAAABXRUJQVlA4ICgAAACwAQCdASoCAAIAAUAmJZgCdLoABDAAAP7cUf/Ys5bAvH67xaSkAAAA','base64')]
];
const limit = 5 * 1024 * 1024;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');

function token(role, sub) {
  const value = encode({ alg:'HS256', typ:'JWT' }) + '.' + encode({
    role, sub, aud:'authenticated', exp:Math.floor(Date.now()/1000)+300
  });
  return value + '.' + createHmac('sha256',secret).update(value).digest('base64url');
}

const anonymous = token('anon');
const account = token('authenticated',owner);
const otherAccount = token('authenticated',other);
function request(route, authorization, options = {}) {
  assert(route.startsWith('/') && !route.startsWith('//'));
  const headers = { ...options.headers };
  if (authorization) headers.authorization = 'Bearer ' + authorization;
  return fetch(origin+route,{...options,headers,redirect:'error',signal:AbortSignal.timeout(10000)});
}
const upload = (bucket, key, authorization, body = png, type = 'image/png') =>
  request('/object/'+bucket+'/'+key, authorization, {
    method:'POST',headers:{'content-type':type,'x-upsert':'false'},body
  });
const sign = (bucket, key, authorization, expiresIn) =>
  request('/object/sign/'+bucket+'/'+key, authorization, {
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({expiresIn})
  });
const remove = (bucket, key, authorization) =>
  request('/object/'+bucket, authorization, {
    method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({prefixes:[key]})
  });
async function ok(response, description) {
  if (!response.ok) throw new Error(description+': '+response.status+' '+(await response.text()).slice(0,400));
}

(async()=>{
  await ok(await request('/status'), 'local Storage fixture health');
  for (const bucket of ['strain-review-photos','dispensary-review-photos','member-avatars']) {
    const key = owner+'/'+randomUUID()+'.png';
    const oversizeKey = owner+'/'+randomUUID()+'.png';
    const privateBucket = bucket === 'member-avatars';
    const content = Buffer.concat([png, Buffer.alloc(limit - png.length)]);
    assert(!(await upload(bucket,key,anonymous)).ok,'anonymous upload denied');
    assert(!(await upload(bucket,key,otherAccount)).ok,'cross-account upload denied');
    assert(!(await upload(bucket,key,account,png,'text/plain')).ok,'invalid MIME rejected');
    assert(!(await upload(bucket,oversizeKey,account,Buffer.alloc(limit+1))).ok,'oversize rejected');
    await ok(await upload(bucket,key,account,content), 'owner upload at bucket limit');
    for (const [extension,mime,bytes] of additionalFormats) {
      const formatKey = owner+'/'+randomUUID()+'.'+extension;
      await ok(await upload(bucket,formatKey,account,bytes,mime),'owner '+extension+' upload');
      const response = await request('/object/authenticated/'+bucket+'/'+formatKey,account);
      await ok(response,'owner '+extension+' retrieval');
      assert(Buffer.from(await response.arrayBuffer()).equals(bytes));
      await ok(await remove(bucket,formatKey,account),'owner '+extension+' deletion');
    }
    assert(!(await upload(bucket,key,account)).ok,'overwrite without upsert denied');
    assert(!(await sign(bucket,key,otherAccount,60)).ok,'cross-account signing denied');
    assert(!(await sign(bucket,key,anonymous,60)).ok,'anonymous signing denied');
    const publicResponse = await request('/object/public/'+bucket+'/'+key);
    if (privateBucket) {
      assert(!publicResponse.ok,'anonymous public route cannot retrieve private avatar');
      assert(!(await request('/object/authenticated/'+bucket+'/'+key,otherAccount)).ok,'cross-account avatar read denied');
    } else {
      await ok(publicResponse,'public review photo retrieval');
      assert(Buffer.from(await publicResponse.arrayBuffer()).equals(content));
    }
    const signed = await sign(bucket,key,account,60);
    await ok(signed,'owner signing');
    const {signedURL} = await signed.json();
    const signedDownload = await request(signedURL);
    await ok(signedDownload,'signed byte retrieval');
    assert(Buffer.from(await signedDownload.arrayBuffer()).equals(content));
    await remove(bucket,key,otherAccount);
    await ok(await request(signedURL),'cross-account delete left the object intact');
    if (privateBucket) {
      const expiring = await sign(bucket,key,account,1);
      await ok(expiring,'short-lived avatar URL');
      const expiry = (await expiring.json()).signedURL;
      await ok(await request(expiry),'short-lived avatar URL initially works');
      await new Promise(resolve=>setTimeout(resolve,2100));
      assert(!(await request(expiry)).ok,'expired avatar URL denied');
      const replacement = await sign(bucket,key,account,60);
      await ok(replacement,'owner can renew expired avatar URL');
      await ok(await request((await replacement.json()).signedURL),'renewed avatar URL works');
    }
    await ok(await remove(bucket,key,account),'owner delete');
    assert(!(await request(signedURL)).ok,'deleted object is gone');
    console.log(bucket+': owner, cross-account, MIME, size, retrieval and deletion checks passed');
  }
})().catch(error=>{console.error(error); process.exitCode=1;});
