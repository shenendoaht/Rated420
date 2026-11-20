import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root=fileURLToPath(new URL('..',import.meta.url));
const target=process.argv[2];
if(!target)throw Error('Usage: node scripts/build-complete-offline.mjs <new-output-folder>');
const env={...process.env,RATED420_COMPLETE_PREVIEW:'1'};
for(const key of ['VERCEL_ENV','RATED420_BUILD01_STAGING'])delete env[key];
execFileSync(process.execPath,[path.join(root,'scripts/build.mjs')],{env,stdio:'inherit'});
await mkdir(target);
await cp(path.join(root,'dist'),target,{recursive:true});
for(const [from,to] of [
  ['preview/complete/Launch Rated420.command','Launch Rated420.command'],
  ['preview/complete/serve-rated420.pl','serve-rated420.pl'],
  ['docs/complete-offline.md','README.md'],
  ['docs/rated420-hq-preview.md','HQ-WORKSPACE.md'],
  ['docs/hq-community-expansion.md','HQ-EXPANSION.md'],
  ['docs/data-intelligence.md','DATA-INTELLIGENCE.md'],
  ['docs/data-intelligence-verification.txt','DATA-VERIFICATION.txt'],
  ['docs/responsive-identity.md','VISUAL-DESIGN.md'],
  ['docs/responsive-verification.txt','VERIFICATION.txt'],
  ['docs/brand-content.md','BRAND-CONTENT.md'],
  ['docs/catalogue-expansion.md','CATALOGUE.md'],
  ['docs/living-identity.md','VISUAL-SYSTEM.md']
])await cp(path.join(root,from),path.join(target,to));
