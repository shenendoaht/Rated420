import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const source=fileURLToPath(new URL('..',import.meta.url));
const root=mkdtempSync(path.join(tmpdir(),'rated420-build-test-'));
for(const name of ['scripts','preview','index.html','app.js','styles.css','build01.js','build01.css','build02.js','build02.css','profile-layout.css','profile-avatar.js','score-display.js','rated420-logo.png','images'])cpSync(path.join(source,name),path.join(root,name),{recursive:true});
// Synthetic canaries, not credentials or real records.
for(const name of ['.env','private.sql','private.db'])writeFileSync(path.join(root,name),'fixture-must-not-be-published');
mkdirSync(path.join(root,'tests'));writeFileSync(path.join(root,'tests/private.txt'),'fixture');
const cases=[
 ['production main excludes demo even with a legacy demo flag',{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'main',RATED420_LOCAL_DEMO:'1',RATED420_GARY_PREVIEW:'1',RATED420_COMPLETE_PREVIEW:'1'},false],
 ['feature preview uses isolated data',{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/community-averages'},true],
 ['other feature previews also use isolated data',{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/unrelated',RATED420_GARY_PREVIEW:'1',RATED420_COMPLETE_PREVIEW:'1'},true],
 ['default local build uses isolated data',{},true],
 ['development is isolated even with a production target',{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'development'},true],
 ['production target without a Git ref uses isolated data',{VERCEL_ENV:'production'},true],
 ['preview of main uses isolated data',{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'main'},true]
];
for(const [name,variables,demo] of cases)test(name,()=>{
 const env={...process.env};for(const key of ['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','RATED420_LOCAL_DEMO','RATED420_GARY_PREVIEW','RATED420_COMPLETE_PREVIEW'])delete env[key];Object.assign(env,variables);
 execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{env,stdio:'pipe'});
 const output=path.join(root,'dist'),html=readFileSync(path.join(output,'index.html'),'utf8');
 assert.equal(existsSync(path.join(output,'community-demo.js')),demo);
 assert.doesNotMatch(html,/gary-(?:store|ui|fonts)/);
 assert(!readdirSync(output,{recursive:true}).some(file=>/gary|synthetic-media-kit|profile-examples|profile-portrait|catalogue-|editorial-|refinement-|intelligence-|complete-(?:navigation|layout)|expansion-(?:fixtures|store|ui|layout)|rated420-hq-preview/i.test(file)));
 assert(existsSync(path.join(output,'profile-layout.css')));
 assert(existsSync(path.join(output,'profile-avatar.js')));
 assert.equal(html.includes('src="community-demo.js"'),demo);
 for(const file of ['.env','private.sql','private.db','tests','preview','scripts'])assert(!existsSync(path.join(output,file)),file+' must not be published');
 assert(!readdirSync(output,{recursive:true}).some(file=>file.endsWith('.sql')));
 assert.equal(readFileSync(path.join(output,'styles.css'),'utf8'),readFileSync(path.join(root,'styles.css'),'utf8'));
 if(demo){
  assert(html.includes("connect-src 'none'; form-action 'none'; script-src 'self'"));
  assert(!html.includes('supabase-js@'));
  assert(!existsSync(path.join(output,'contact.js')));
  for(const file of ['index.html','app.js','community-demo.js']){
   const content=readFileSync(path.join(output,file),'utf8');
   assert.doesNotMatch(content,/ymluyoqkmzxomjokjmkj|https?:\/\/[^\s"'<>]*\.supabase\.co\b|sb_publishable_/i);
  }
  assert(!/action="https:\/\/[^\"]*supabase/.test(html));
  assert(readFileSync(path.join(output,'community-demo.js'),'utf8').includes('SYNTHETIC DATA PREVIEW'));
 }else{
  for(const file of ['index.html','app.js']){
   assert.equal(readFileSync(path.join(output,file),'utf8'),readFileSync(path.join(root,file),'utf8'));
  }
  assert(html.includes('supabase-js@2.117.1'));
  for(const file of ['app.js','styles.css','index.html'])assert(!readFileSync(path.join(output,file),'utf8').includes('Demo Citrus'));
 }
});
test('explicit Build 01 staging build removes production addresses and rejects the production target',()=>{
 const env={...process.env,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'rebuild/build-01',RATED420_BUILD01_STAGING:'1',RATED420_GARY_PREVIEW:'1',RATED420_COMPLETE_PREVIEW:'1',
  RATED420_STAGING_SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
  RATED420_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_fixture'};
 const script=path.join(root,'scripts/build.mjs');
 execFileSync(process.execPath,[script],{env,stdio:'pipe'});
 for(const file of ['app.js','index.html']){
  const content=readFileSync(path.join(root,'dist',file),'utf8');
  if(file==='app.js')assert(content.includes(env.RATED420_STAGING_SUPABASE_URL));
  assert.doesNotMatch(content,/ymluyoqkmzxomjokjmkj/);
 }
 assert(!existsSync(path.join(root,'dist','community-demo.js')));
 assert(!existsSync(path.join(root,'dist','gary-ui.js')));
 assert.throws(()=>execFileSync(process.execPath,[script],{env:{...env,
  RATED420_STAGING_SUPABASE_URL:'https://ymluyoqkmzxomjokjmkj.supabase.co'},stdio:'pipe'}),/requires a separate Supabase project/);
 assert(!existsSync(path.join(root,'dist')));
});
test('a hosted backend reference aborts the build and removes stale output',()=>{
 const app=path.join(root,'app.js');
 writeFileSync(app,readFileSync(app,'utf8')+"\nconst unexpectedBackend = 'https://fixture.supabase.co';\n");
 const env={...process.env,VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'development'};
 assert.throws(()=>execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{env,stdio:'pipe'}),
  error=>error.status===1 && error.stderr.toString().includes('hosted Supabase reference in app.js'));
 assert(!existsSync(path.join(root,'dist')));
});
after(()=>rmSync(root,{recursive:true,force:true}));
