import { mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/build-rated420-hq-offline.mjs <new-output-folder>');
const root = fileURLToPath(new URL('..', import.meta.url));
await mkdir(target);
const assets = [
  ['rated420-logo.png', 'rated420-logo.png'],
  ['profile-avatar.js', 'profile-avatar.js'],
  ['profile-layout.css', 'profile-layout.css'],
  ['preview/profiles/profile-examples.js', 'profile-examples.js'],
  ['preview/profiles/images', 'images'],
  ['docs/rated420-hq-preview.md', 'README.md'],
  ...Object.entries({
    'standalone.html': 'index.html',
    'standalone.js': 'rated420-hq-preview.js',
    'store.js': 'hq-workspace-store.js',
    'ui.js': 'hq-workspace-ui.js',
    'gary.css': 'hq-workspace.css',
    'fonts': 'fonts',
    'serve-rated420-hq.pl': 'serve-rated420-hq.pl',
    'Launch Rated420 HQ.command': 'Launch Rated420 HQ.command',
    'synthetic-media-kit.txt': 'synthetic-media-kit.txt'
  }).map(([source, destination]) => ['preview/gary/' + source, destination])
];
await Promise.all(assets.map(([source, destination]) =>
  cp(path.join(root, source), path.join(target, destination), { recursive: true })
));
