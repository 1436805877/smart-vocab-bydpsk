// 直接下载 Electron 二进制并解压到 node_modules/electron/dist
// 用法: node --use-system-ca scripts/download-electron.mjs
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const pkg = JSON.parse(await fsp.readFile(path.join(electronDir, 'package.json'), 'utf8'));
const version = pkg.version;
const zipPath = path.join(root, `.electron-v${version}-win32-x64.zip`);
const distDir = path.join(electronDir, 'dist');
const url = `https://github.com/electron/electron/releases/download/v${version}/electron-v${version}-win32-x64.zip`;

if (fs.existsSync(path.join(distDir, 'electron.exe'))) {
  console.log('Electron already installed:', path.join(distDir, 'electron.exe'));
  process.exit(0);
}

console.log('Downloading', url);
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
const total = Number(res.headers.get('content-length') || 0);
let received = 0;
let lastLogged = 0;

const progress = new Transform({
  transform(chunk, _enc, cb) {
    received += chunk.length;
    if (received - lastLogged >= 10 * 1024 * 1024 || received === total) {
      lastLogged = received;
      const pct = total ? ((received / total) * 100).toFixed(1) : '?';
      console.log(`  ${(received / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB (${pct}%)`);
    }
    cb(null, chunk);
  },
});

await pipeline(Readable.fromWeb(res.body), progress, fs.createWriteStream(zipPath));
console.log('Downloaded, extracting...');

await fsp.rm(distDir, { recursive: true, force: true });
const { extract } = await import('@electron-internal/extract-zip');
await extract(zipPath, { dir: distDir });
await fsp.writeFile(path.join(electronDir, 'path.txt'), 'electron.exe', 'utf8');
await fsp.rm(zipPath, { force: true });
console.log('Electron ready:', path.join(distDir, 'electron.exe'));
