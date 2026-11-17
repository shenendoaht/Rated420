import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,existsSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const source=fileURLToPath(new URL('..',import.meta.url));
const root=mkdtempSync(path.join(tmpdir(),'rated420-build-test-'));
for(const name of ['scripts','preview','index.html','app.js','styles.css','contact.js','rated420-logo.png','images'])cpSync(path.join(source,name),path.join(root,name),{recursive:true});
// Synthetic canaries, not credentials or real records.
for(const name of ['.env','private.sql','private.db'])writeFileSync(path.join(root,name),'fixture-must-not-be-published');
mkdirSync(path.join(root,'tests'));writeFileSync(path.join(root,'tests/private.txt'),'fixture');
const cases=[
 ['production ignores local-demo flags',{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_REF:'codex/community-averages',RATED420_LOCAL_DEMO:'1'},false],
 ['feature preview uses isolated data',{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/community-averages'},true],
 ['unrelated preview is unaffected',{VERCEL_ENV:'preview',VERCEL_GIT_COMMIT_REF:'codex/unrelated'},false],
 ['default build excludes demo',{},false],
 ['explicit local demo is isolated',{RATED420_LOCAL_DEMO:'1'},true]
];
for(const [name,variables,demo] of cases)test(name,()=>{
 const env={...process.env};for(const key of ['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','RATED420_LOCAL_DEMO'])delete env[key];Object.assign(env,variables);
 execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{env,stdio:'pipe'});
 const output=path.join(root,'dist'),html=readFileSync(path.join(output,'index.html'),'utf8');
 assert.equal(existsSync(path.join(output,'community-demo.js')),demo);
 assert.equal(html.includes('src="community-demo.js"'),demo);
 for(const file of ['.env','private.sql','private.db','tests','preview','scripts'])assert(!existsSync(path.join(output,file)),file+' must not be published');
 assert(!readdirSync(output,{recursive:true}).some(file=>file.endsWith('.sql')));
 for(const file of ['app.js','styles.css','contact.js'])assert.equal(readFileSync(path.join(output,file),'utf8'),readFileSync(path.join(root,file),'utf8'));
 if(demo){
  assert(html.includes("connect-src 'self'; form-action 'self'"));
  assert(!html.includes('supabase-js@'));
  assert(!/action="https:\/\/[^\"]*supabase/.test(html));
  assert(readFileSync(path.join(output,'community-demo.js'),'utf8').includes('SYNTHETIC DATA PREVIEW'));
 }else{
  assert.equal(html,readFileSync(path.join(root,'index.html'),'utf8'));
  assert(html.includes('supabase-js@2.117.1'));
  for(const file of ['app.js','styles.css','contact.js','index.html'])assert(!readFileSync(path.join(output,file),'utf8').includes('Demo Citrus'));
 }
});
after(()=>rmSync(root,{recursive:true,force:true}));
