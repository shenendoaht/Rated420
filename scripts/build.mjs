import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'dist');
const production = process.env.VERCEL_ENV === 'production' &&
  process.env.VERCEL_GIT_COMMIT_REF === 'main';
const textFiles = ['index.html', 'app.js', 'styles.css', 'build01.css', 'build01.js', 'build02.css', 'build02.js', 'profile-layout.css', 'profile-avatar.js'];
const staging = process.env.RATED420_BUILD01_STAGING === '1';
const gary = !staging && !process.env.VERCEL_ENV && process.env.RATED420_GARY_PREVIEW === '1';
const stagingOrigin = process.env.RATED420_STAGING_SUPABASE_URL;
const stagingKey = process.env.RATED420_STAGING_SUPABASE_PUBLISHABLE_KEY;
const productionOrigin = 'https://ymluyoqkmzxomjokjmkj.supabase.co';

await rm(output, { recursive: true, force: true });
const files = new Map(await Promise.all(textFiles.map(async file => [
  file, await readFile(path.join(root, file), 'utf8')
])));

if (staging) {
  if (production || !/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(stagingOrigin || '') ||
      stagingOrigin === productionOrigin || !/^sb_publishable_[a-zA-Z0-9_-]+$/.test(stagingKey || '') ||
      files.get('app.js').includes(stagingKey)) {
    throw new Error('Build 01 staging requires a separate Supabase project and publishable key.');
  }
  for (const [file, content] of files) {
    files.set(file, content.replaceAll(productionOrigin, stagingOrigin)
      .replace(/sb_publishable_[a-zA-Z0-9_-]+/g, stagingKey));
  }
} else if (!production) {
  const html = files.get('index.html')
    .replace(/<script async src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^>]+><\/script>/, '<script src="community-demo.js"></script>')
    .replace('<meta charset="utf-8">', `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'; script-src 'self'; object-src 'none'; base-uri 'none'">`)
    .replace(/action="https:\/\/[^"]+\.supabase\.co[^"]+"/g, 'action="#"');
  if (!html.includes('<script src="community-demo.js"></script>') ||
      !html.includes("connect-src 'none'; form-action 'none'") ||
      html.includes('supabase-js@')) {
    throw new Error('Synthetic build could not install its backend isolation controls.');
  }

  if (gary) {
    for (const [source, target] of [['store.js','gary-store.js'],['ui.js','gary-ui.js'],['gary.css','gary.css'],['synthetic-media-kit.txt','synthetic-media-kit.txt']]) {
      files.set(target, await readFile(path.join(root, 'preview/gary', source), 'utf8'));
    }
    for (const name of ['fixtures.js','store.js','ui.js','layout.css']) {
      files.set('expansion-'+name, await readFile(path.join(root,'preview/expansion',name),'utf8'));
    }
    files.set('index.html', html.replace(/^  <link[^>]+https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\n/gm, '')
      .replace('<link rel="stylesheet" href="build02.css">','<link rel="stylesheet" href="build02.css">\n  <link rel="stylesheet" href="gary-fonts/fonts.css">\n  <link rel="stylesheet" href="gary.css">\n  <link rel="stylesheet" href="expansion-layout.css">')
      .replace('<script src="build02.js"></script>',
      '<script src="gary-store.js"></script><script src="gary-ui.js"></script><script src="expansion-fixtures.js"></script><script src="expansion-store.js"></script><script src="expansion-ui.js"></script><script src="build02.js"></script>'));
  } else {
    files.set('index.html', html);
  }
  files.set('app.js', files.get('app.js')
    .replace(productionOrigin, 'https://rated420-demo.invalid')
    .replace(/const SUPABASE_PUBLISHABLE_KEY = '[^']+';/, "const SUPABASE_PUBLISHABLE_KEY = 'synthetic';"));
  const seed = await readFile(path.join(root, 'preview/seed.json'), 'utf8');
  const client = await readFile(path.join(root, 'preview/client.js'), 'utf8');
  const adapter = await readFile(path.join(root, 'preview/build01-adapter.js'), 'utf8');
  const hqAdapter = await readFile(path.join(root, 'preview/build02-adapter.js'), 'utf8');
  files.set('community-demo.js', 'const COMMUNITY_DEMO_SEED=' + seed + ';\n' + adapter + '\n' + hqAdapter + '\n' + client);

  for (const [file, content] of files) {
    if (/ymluyoqkmzxomjokjmkj|(?:https?:)?\/\/[^\s"'<>]*\.supabase\.(?:co|in|net)\b|sb_(?:publishable|secret)_/i.test(content)) {
      throw new Error(`Synthetic build found a hosted Supabase reference in ${file}.`);
    }
  }
}

await mkdir(output, { recursive: true });
for (const file of ['rated420-logo.png', 'images']) {
  await cp(path.join(root, file), path.join(output, file), { recursive: true });
}
if (gary) await cp(path.join(root, 'preview/gary/fonts'), path.join(output, 'gary-fonts'), { recursive: true });
await Promise.all([...files].map(([file, content]) => writeFile(path.join(output, file), content)));
console.log(staging ? 'Built for isolated Build 01 staging.' : production
  ? 'Built production static assets (no database commands).'
  : 'Built isolated synthetic-data preview (no production backend access).');
