import { mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2];
if (!target) throw new Error('Usage: node scripts/build-gary-offline.mjs <new-output-folder>');
const root = fileURLToPath(new URL('..', import.meta.url));
await mkdir(target);
const assets = [
  ['rated420-logo.png', 'rated420-logo.png'],
  ['docs/gary-preview.md', 'README.md'],
  ...Object.entries({
    'standalone.html': 'index.html',
    'standalone.js': 'gary-standalone.js',
    'store.js': 'gary-store.js',
    'ui.js': 'gary-ui.js',
    'gary.css': 'gary.css',
    'fonts': 'fonts',
    'serve-offline.pl': 'serve-offline.pl',
    'Launch Gary.command': 'Launch Gary.command',
    'synthetic-media-kit.txt': 'synthetic-media-kit.txt'
  }).map(([source, destination]) => ['preview/gary/' + source, destination])
];
await Promise.all(assets.map(([source, destination]) =>
  cp(path.join(root, source), path.join(target, destination), { recursive: true })
));
