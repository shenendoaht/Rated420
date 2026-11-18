import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'dist');
const production = process.env.VERCEL_ENV === 'production' &&
  process.env.VERCEL_GIT_COMMIT_REF === 'main';
const textFiles = ['index.html', 'app.js', 'styles.css', 'contact.js'];
const productionOrigin = 'https://ymluyoqkmzxomjokjmkj.supabase.co';

await rm(output, { recursive: true, force: true });
const files = new Map(await Promise.all(textFiles.map(async file => [
  file, await readFile(path.join(root, file), 'utf8')
])));

if (!production) {
  const html = files.get('index.html')
    .replace(/<script async src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js[^>]+><\/script>/, '<script src="community-demo.js"></script>')
    .replace('<meta charset="utf-8">', `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="connect-src 'none'; form-action 'none'; script-src 'self'; object-src 'none'; base-uri 'none'">`)
    .replace(/action="https:\/\/[^"]+\.supabase\.co[^"]+"/g, 'action="#"');
  if (!html.includes('<script src="community-demo.js"></script>') ||
      !html.includes("connect-src 'none'; form-action 'none'") ||
      html.includes('supabase-js@')) {
    throw new Error('Synthetic build could not install its backend isolation controls.');
  }

  files.set('index.html', html);
  files.set('app.js', files.get('app.js')
    .replace(productionOrigin, 'https://rated420-demo.invalid')
    .replace(/const SUPABASE_PUBLISHABLE_KEY = '[^']+';/, "const SUPABASE_PUBLISHABLE_KEY = 'synthetic';"));
  files.set('contact.js', files.get('contact.js').replace(productionOrigin, 'https://rated420-demo.invalid'));
  const seed = await readFile(path.join(root, 'preview/seed.json'), 'utf8');
  const client = await readFile(path.join(root, 'preview/client.js'), 'utf8');
  files.set('community-demo.js', 'const COMMUNITY_DEMO_SEED=' + seed + ';\n' + client);

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
await Promise.all([...files].map(([file, content]) => writeFile(path.join(output, file), content)));
console.log(production
  ? 'Built production static assets (no database commands).'
  : 'Built isolated synthetic-data preview (no production backend access).');
