// 生成免安装的 Windows 便携版目录：release/portable/SmartVocab.exe
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const electronDist = path.join(root, 'node_modules', 'electron', 'dist');
const outDir = path.join(root, 'release', 'portable');
const appDir = path.join(outDir, 'resources', 'app');

if (!fs.existsSync(path.join(electronDist, 'electron.exe'))) {
  console.error('Electron 未安装：请先运行 node --use-system-ca scripts/download-electron.mjs');
  process.exit(1);
}

await fsp.rm(outDir, { recursive: true, force: true });
await fsp.mkdir(outDir, { recursive: true });
await fsp.cp(electronDist, outDir, { recursive: true });

// Electron 优先加载 resources/app；移除默认 app 以免误加载
await fsp.rm(path.join(outDir, 'resources', 'default_app.asar'), { force: true });
await fsp.mkdir(appDir, { recursive: true });

for (const file of ['index.html', 'main.js', 'preload.js', 'package.json']) {
  await fsp.copyFile(path.join(root, file), path.join(appDir, file));
}
await fsp.cp(path.join(root, 'assets'), path.join(appDir, 'assets'), { recursive: true });

// 重命名主程序
await fsp.rename(path.join(outDir, 'electron.exe'), path.join(outDir, 'SmartVocab.exe'));

await fsp.writeFile(path.join(outDir, 'README.txt'),
  '智能单词本 0.1 beta（便携版）\r\n\r\n双击 SmartVocab.exe 启动。\r\n数据默认保存在 %APPDATA%\\smart-vocab；请定期用「导出 → JSON」备份。\r\n',
  'utf8');

console.log('Portable app ready:', path.join(outDir, 'SmartVocab.exe'));
