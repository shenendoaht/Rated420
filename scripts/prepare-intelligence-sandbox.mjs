import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [distribution,output]=process.argv.slice(2);
if(!distribution||!output)throw Error('Usage: node scripts/prepare-intelligence-sandbox.mjs <extracted-package> <new-output-folder>');
await mkdir(output);
const allowed=/^(?:[a-z0-9-]+\.(?:js|css|png)|index\.html|synthetic-media-kit\.txt)$/;
for(const name of await readdir(distribution)){
  if(allowed.test(name)||name==='images'||name==='gary-fonts')await cp(path.join(distribution,name),path.join(output,name),{recursive:true});
}
const home=path.join(output,'index.html');
const heading=await readFile(home,'utf8');
const html=heading.replace('<meta charset="utf-8">','<meta charset="utf-8">\n  <meta name="robots" content="noindex, nofollow, noarchive">')
  .replace(/<body\b[^>]*>/,match=>match+'\n  <aside class="sandbox-banner" aria-label="Development sandbox"><strong>Rated420 development sandbox</strong><span>Synthetic interactions · official NY license snapshot · changes stay in this browser</span></aside>');
if(!html.includes('aria-label="Development sandbox"')||!html.includes("connect-src 'none'"))throw Error('Missing sandbox isolation controls.');
await writeFile(home,html);
const styles=path.join(output,'complete-layout.css');
await writeFile(styles,await readFile(styles,'utf8')+'\n.sandbox-banner{position:sticky;top:0;z-index:40;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.15rem .8rem;background:#d7befd;color:#241632;padding:.45rem .75rem;text-align:center;font:600 .875rem/1.4 system-ui,sans-serif}\n');
await writeFile(path.join(output,'robots.txt'),'User-agent: *\nDisallow: /\n');
const headers=[
  {key:'X-Robots-Tag',value:'noindex, nofollow, noarchive'},
  {key:'Content-Security-Policy',value:"default-src 'none'; connect-src 'none'; form-action 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"}
];
await writeFile(path.join(output,'vercel.json'),JSON.stringify({git:{deploymentEnabled:false},headers:[{source:'/(.*)',headers}]},null,2)+'\n');
