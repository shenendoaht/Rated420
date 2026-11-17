import {mkdir,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const output=path.join(root,'dist');
const demo = (process.env.VERCEL_ENV==='preview' && process.env.VERCEL_GIT_COMMIT_REF==='codex/community-averages') ||
  (!process.env.VERCEL_ENV && process.env.RATED420_LOCAL_DEMO==='1');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
for(const file of ['index.html','app.js','styles.css','contact.js','rated420-logo.png','images'])await cp(path.join(root,file),path.join(output,file),{recursive:true});
if(demo){
 let html=await readFile(path.join(output,'index.html'),'utf8');
 html=html.replace(/<script async src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^>]+><\/script>/,'<script src="community-demo.js"></script>');
 html=html.replace('<meta charset="utf-8">','<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="connect-src \'self\'; form-action \'self\'">');
 html=html.replace(/action="https:\/\/[^"]+supabase.co[^"]+"/g,'action="#"');
 const seed=await readFile(path.join(root,'preview/seed.json'),'utf8');
 const client=await readFile(path.join(root,'preview/client.js'),'utf8');
 await writeFile(path.join(output,'community-demo.js'),'const COMMUNITY_DEMO_SEED='+seed+';\n'+client);
 await writeFile(path.join(output,'index.html'),html);
}
console.log(demo?'Built isolated synthetic-data preview (no production backend access).':'Built production static assets (no database commands).');
