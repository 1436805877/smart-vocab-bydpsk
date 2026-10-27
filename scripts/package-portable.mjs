// 生成免安装的 Windows 便携版目录：release/portable/SmartVocab.exe
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
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

for (const file of ['index.html', 'main.js', 'preload.js', 'data-cet6.json.gz', 'data-cet6.manifest.json', 'package.json']) {
  await fsp.copyFile(path.join(root, file), path.join(appDir, file));
}
await fsp.cp(path.join(root, 'assets'), path.join(appDir, 'assets'), { recursive: true });
await fsp.cp(path.join(root, 'lib'), path.join(appDir, 'lib'), { recursive: true });

// 复制生产依赖（electron-updater 及其传递依赖），排除 electron/构建工具等 devDependencies。
try {
  const isWin = process.platform === 'win32';
  const command = isWin ? (process.env.ComSpec || 'cmd.exe') : 'npm';
  const args = isWin
    ? ['/d', '/s', '/c', 'npm ls --omit=dev --all --parseable']
    : ['ls', '--omit=dev', '--all', '--parseable'];
  const listed = execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim().split(/\r?\n/).filter(Boolean);
  const modules = [...new Set(listed)]
    .map(p => path.resolve(p))
    .filter(p => p.startsWith(path.join(root, 'node_modules') + path.sep) && fs.existsSync(p));
  for (const mod of modules) {
    const rel = path.relative(root, mod);
    await fsp.cp(mod, path.join(appDir, rel), { recursive: true });
  }
  console.log('Production dependencies copied:', modules.length);
} catch (err) {
  console.warn('无法枚举生产依赖，更新功能可能不可用:', err.message);
}

// 重命名主程序
await fsp.rename(path.join(outDir, 'electron.exe'), path.join(outDir, 'SmartVocab.exe'));

await fsp.writeFile(path.join(outDir, 'README.txt'),
  '智能单词本 0.5.4 beta（便携版）\r\n\r\n' +
  '1. 必须先把整个文件夹解压出来，不能直接在压缩包里双击 exe。\r\n' +
  '2. 双击 SmartVocab.exe 启动。\r\n' +
  '3. 如果没反应，运行 启动诊断.bat，把 startup.log 和窗口里的退出码发给我。\r\n' +
  '4. 如果诊断仍失败，再试 启动诊断_无沙箱.bat（仅用于排查）。\r\n' +
  '数据默认保存在 %APPDATA%\\smart-vocab；请定期用「导出 → JSON」备份。\r\n',
  'utf8');

const diagnose = [
  '@echo off',
  'chcp 65001 >nul',
  'cd /d "%~dp0"',
  'echo 正在启动智能单词本（诊断模式）...',
  'echo 启动日志会写到本目录 startup.log',
  'echo.',
  'start "" /wait "SmartVocab.exe" --enable-logging',
  'echo 退出码: %ERRORLEVEL%',
  'echo.',
  'if exist startup.log (',
  '  echo ---- startup.log ----',
  '  type startup.log',
  ')',
  'pause',
  '',
].join('\r\n');
await fsp.writeFile(path.join(outDir, '启动诊断.bat'), diagnose, 'utf8');

const diagnoseNoSandbox = diagnose.replace(
  'start "" /wait "SmartVocab.exe" --enable-logging',
  'start "" /wait "SmartVocab.exe" --no-sandbox --enable-logging'
);
await fsp.writeFile(path.join(outDir, '启动诊断_无沙箱.bat'), diagnoseNoSandbox, 'utf8');

console.log('Portable app ready:', path.join(outDir, 'SmartVocab.exe'));
