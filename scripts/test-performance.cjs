#!/usr/bin/env node
// 0.5.6 性能回归：确保启动壁纸只取当前一张、备份列表只读元数据、
// 删除备份不重载全量数据；这些约束一旦被改回去，启动/删除会重新卡顿。
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');

function methodBody(name) {
  const marker = `            async ${name}(`;
  const start = html.indexOf(marker);
  assert(start >= 0, `missing async ${name}`);
  const open = html.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) return html.slice(open, i + 1);
    }
  }
  throw new Error(`unclosed ${name}`);
}

const applyWallpaper = methodBody('applyWallpaper');
assert(applyWallpaper.includes('getWallpaperItem(t.wallpaperId)'), 'applyWallpaper must load only the selected wallpaper');
assert(!applyWallpaper.includes('this.wallpaperList()'), 'applyWallpaper must not load the whole wallpaper library');

const getItem = methodBody('getWallpaperItem');
assert(getItem.includes('_wallpaperItemCache'), 'selected wallpaper should be cached');
assert(getItem.includes('wallpaperList(false)'), 'wallpaper metadata should be listed without blobs');

const wallpaperList = methodBody('wallpaperList');
assert(wallpaperList.includes('if (!loadBlobs) return sorted;'), 'wallpaperList(false) must skip blob reads');

const autoBackup = methodBody('autoBackupIfNeeded');
assert(autoBackup.includes('getBackupMetas()'), 'auto backup must use metadata');
assert(!autoBackup.includes('getBackups()'), 'auto backup must not parse every snapshot');

const refreshBackup = methodBody('refreshBackupList');
assert(refreshBackup.includes('getBackupMetas()'), 'backup list must use metadata');

const deleteSnapshot = methodBody('deleteSnapshot');
assert(deleteSnapshot.includes('filter(x => x.id !== id)'), 'delete should update the in-memory list');
assert(!deleteSnapshot.includes('refreshBackupList()'), 'delete must not reload every backup');

const restoreSnapshot = methodBody('restoreSnapshot');
assert(restoreSnapshot.includes('getBackup(id)'), 'restore should fetch only the selected snapshot');

assert(main.includes("ipcMain.handle('db:getBackupMetas'"), 'main must expose lightweight backup metadata');
assert(main.includes('json_extract(json'), 'metadata should be extracted in SQLite');
assert(main.includes("ipcMain.handle('db:getBackup'"), 'main must fetch one backup by id');
assert(preload.includes('dbGetBackupMetas'), 'preload must expose backup metadata');
assert(preload.includes('dbGetBackup:'), 'preload must expose single backup fetch');

assert(html.includes('if (this._booted) this.scheduleWallpaperApply();'), 'wallpaper load should wait until boot');
assert(html.includes('this._booted = true;'), 'boot flag should be set after first paint');
assert(html.includes('runWhenIdle'), 'startup backup/mirror should run when idle');

console.log('0.5.6 performance regression checks passed');
