const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

const APP_ID = 'com.mokiklok.smartvocab';
let mainWindow = null;

// productName 改为 SmartVocab 以避免安装路径含中文；用户数据目录保持不变。
app.setPath('userData', path.join(app.getPath('appData'), 'smart-vocab'));

// 启动日志：便携版目录和临时目录各写一份，方便排查“双击没反应”
const logFiles = [
  path.join(path.dirname(process.execPath), 'startup.log'),
  path.join(os.tmpdir(), 'smartvocab-startup.log'),
];
function writeLog(line) {
  const text = `[${new Date().toISOString()}] ${line}\n`;
  for (const file of logFiles) {
    try { fsSync.appendFileSync(file, text, 'utf8'); } catch { /* ignore */ }
  }
}
function log(...args) {
  writeLog(args.map(v => {
    if (v instanceof Error) return v.stack || v.message;
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch { return String(v); }
    }
    return String(v);
  }).join(' '));
}

process.on('uncaughtException', (err) => {
  log('UNCAUGHT EXCEPTION', err);
  try {
    dialog.showErrorBox('智能单词本启动失败', String(err && err.stack || err));
  } catch { /* ignore */ }
});
process.on('unhandledRejection', (err) => log('UNHANDLED REJECTION', err));

// 桌面单词本不需要 GPU；关闭硬件加速可避开部分显卡/驱动导致的启动崩溃
app.disableHardwareAcceleration();
log('hardware acceleration disabled');

log('=== startup ===');
log({
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  execPath: process.execPath,
  resourcesPath: process.resourcesPath,
  argv: process.argv,
});

// 0.1 排查阶段先关闭单实例锁：部分 Windows 环境下 requestSingleInstanceLock()
// 会在原生层直接崩溃，JS 层捕获不到。后续会用 Windows 命名互斥体替代。
log('single instance lock: disabled for troubleshooting');

function createWindow() {
  log('createWindow');
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 640,
    title: '智能单词本 0.1 beta',
    backgroundColor: '#f1f5f9',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log('did-finish-load OK');
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, desc, url) => {
    log('did-fail-load', { code, desc, url });
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log('render-process-gone', details);
  });
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    log('preload-error', { preloadPath, error: String(error && error.stack || error) });
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html')).catch(err => {
    log('loadFile failed', err);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开数据目录',
          click: () => shell.openPath(app.getPath('userData')),
        },
        { type: 'separator' },
        { label: '退出', role: 'quit' },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', role: 'undo' },
        { label: '重做', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', role: 'cut' },
        { label: '复制', role: 'copy' },
        { label: '粘贴', role: 'paste' },
        { label: '全选', role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', role: 'reload' },
        { label: '实际大小', role: 'resetZoom' },
        { label: '放大', role: 'zoomIn' },
        { label: '缩小', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ label: '开发者工具', role: 'toggleDevTools' }]),
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于智能单词本',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于智能单词本',
              message: '智能单词本 0.1 beta',
              detail: '核心感觉 + 词根演变 + 近义辨析\n\n数据默认保存在本机应用目录，请定期导出 JSON 备份。',
              buttons: ['确定'],
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function filterForKind(kind) {
  if (kind === 'json') return [{ name: 'JSON 数据', extensions: ['json'] }];
  if (kind === 'csv') return [{ name: 'CSV 表格', extensions: ['csv'] }];
  if (kind === 'md') return [{ name: 'Markdown', extensions: ['md'] }];
  if (kind === 'txt') return [{ name: '文本文件', extensions: ['txt'] }];
  return [{ name: '所有文件', extensions: ['*'] }];
}

function backupDir() {
  return path.join(app.getPath('userData'), 'backups');
}

let mirrorDb = null;
function getMirrorDb() {
  if (mirrorDb) return mirrorDb;
  const { DatabaseSync } = require('node:sqlite');
  mirrorDb = new DatabaseSync(path.join(app.getPath('userData'), 'wordbook-mirror.db'));
  mirrorDb.exec(`CREATE TABLE IF NOT EXISTS mirror (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    saved_at INTEGER NOT NULL,
    payload TEXT NOT NULL
  )`);
  return mirrorDb;
}

let appDb = null;
const DB_STORES = ['words', 'extras', 'progress', 'decks', 'deckWords', 'backups'];
function getAppDb() {
  if (appDb) return appDb;
  const { DatabaseSync } = require('node:sqlite');
  appDb = new DatabaseSync(path.join(app.getPath('userData'), 'wordbook.db'));
  appDb.exec(`
    CREATE TABLE IF NOT EXISTS objects (
      store TEXT NOT NULL,
      key TEXT NOT NULL,
      json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (store, key)
    );
    CREATE INDEX IF NOT EXISTS idx_objects_store ON objects(store);
  `);
  return appDb;
}

function rowKey(store, row) {
  if (store === 'words' || store === 'decks' || store === 'backups') return String(row.id);
  return String(row.key);
}

function assertStore(store) {
  if (!DB_STORES.includes(store)) throw new Error('未知数据表：' + store);
}

function dbReadAll(db, store) {
  assertStore(store);
  return db.prepare('SELECT json FROM objects WHERE store = ? ORDER BY key').all(store)
    .map(row => JSON.parse(row.json));
}

function dbCounts(db) {
  const counts = {};
  for (const store of DB_STORES) {
    counts[store] = db.prepare('SELECT COUNT(*) AS n FROM objects WHERE store = ?').get(store).n;
  }
  return counts;
}

function dbImportAll(db, payload) {
  const data = payload || {};
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const store of DB_STORES) {
      db.prepare('DELETE FROM objects WHERE store = ?').run(store);
      const rows = Array.isArray(data[store]) ? data[store] : [];
      const stmt = db.prepare('INSERT INTO objects (store, key, json, updated_at) VALUES (?, ?, ?, ?)');
      for (const row of rows) {
        if (!row) continue;
        stmt.run(store, rowKey(store, row), JSON.stringify(row), Date.now());
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw error;
  }
}

function safeBackupName(name) {
  const base = path.basename(String(name || ''));
  return /^[A-Za-z0-9._-]+\.json$/.test(base) ? base : null;
}

async function listBackupFiles() {
  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.json')) continue;
    try {
      const stat = await fs.stat(path.join(dir, entry.name));
      files.push({ name: entry.name, size: stat.size, mtime: stat.mtimeMs });
    } catch { /* ignore */ }
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

async function pruneBackups(keep = 7) {
  const files = await listBackupFiles();
  for (const file of files.slice(keep)) {
    try { await fs.unlink(path.join(backupDir(), file.name)); } catch { /* ignore */ }
  }
}

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('theme:desktopWallpaper', async () => {
  if (process.platform !== 'win32') return { ok: false, error: '当前只支持 Windows 桌面壁纸' };
  try {
    let wallpaperPath = '';
    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile',
        '-Command',
        "(Get-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper).Wallpaper"
      ], { windowsHide: true });
      wallpaperPath = String(stdout || '').trim();
    } catch { /* ignore */ }
    if (!wallpaperPath || !fsSync.existsSync(wallpaperPath)) {
      wallpaperPath = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper');
    }
    if (!fsSync.existsSync(wallpaperPath)) return { ok: false, error: '没有找到桌面壁纸文件' };
    const stat = await fs.stat(wallpaperPath);
    if (stat.size > 20 * 1024 * 1024) return { ok: false, error: '壁纸文件过大（超过 20MB）' };
    const data = await fs.readFile(wallpaperPath);
    const ext = path.extname(wallpaperPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
    return { ok: true, dataUrl: `data:${mime};base64,${data.toString('base64')}`, path: wallpaperPath };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
});
ipcMain.handle('app:openDataFolder', async () => {
  await shell.openPath(app.getPath('userData'));
  return { ok: true, path: app.getPath('userData') };
});
ipcMain.handle('db:info', async () => {
  try {
    const db = getAppDb();
    return { ok: true, counts: dbCounts(db), path: path.join(app.getPath('userData'), 'wordbook.db') };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
ipcMain.handle('db:getAll', async (_event, store) => {
  try {
    assertStore(store);
    return { ok: true, rows: dbReadAll(getAppDb(), store) };
  } catch (error) {
    return { ok: false, error: String(error), rows: [] };
  }
});
ipcMain.handle('db:replaceStore', async (_event, payload) => {
  const { store, rows = [] } = payload || {};
  try {
    assertStore(store);
    const db = getAppDb();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM objects WHERE store = ?').run(store);
      const stmt = db.prepare('INSERT INTO objects (store, key, json, updated_at) VALUES (?, ?, ?, ?)');
      for (const row of rows) {
        if (!row) continue;
        stmt.run(store, rowKey(store, row), JSON.stringify(row), Date.now());
      }
      db.exec('COMMIT');
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    }
    return { ok: true, count: rows.length };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
ipcMain.handle('db:importAll', async (_event, payload) => {
  try {
    dbImportAll(getAppDb(), payload);
    return { ok: true, counts: dbCounts(getAppDb()) };
  } catch (error) {
    log('db import failed', error);
    return { ok: false, error: String(error) };
  }
});
ipcMain.handle('db:put', async (_event, payload) => {
  const { store, row } = payload || {};
  try {
    assertStore(store);
    if (!row) throw new Error('缺少数据行');
    getAppDb().prepare('INSERT OR REPLACE INTO objects (store, key, json, updated_at) VALUES (?, ?, ?, ?)')
      .run(store, rowKey(store, row), JSON.stringify(row), Date.now());
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
ipcMain.handle('db:delete', async (_event, payload) => {
  const { store, key } = payload || {};
  try {
    assertStore(store);
    getAppDb().prepare('DELETE FROM objects WHERE store = ? AND key = ?').run(store, String(key));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});

ipcMain.handle('db:mirrorSave', async (_event, payload) => {
  try {
    const db = getMirrorDb();
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    db.prepare('INSERT OR REPLACE INTO mirror (id, saved_at, payload) VALUES (1, ?, ?)')
      .run(Date.now(), text);
    return { ok: true };
  } catch (error) {
    log('mirror save failed', error);
    return { ok: false, error: String(error) };
  }
});
ipcMain.handle('db:mirrorLoad', async () => {
  try {
    const row = getMirrorDb().prepare('SELECT saved_at, payload FROM mirror WHERE id = 1').get();
    if (!row) return { ok: true, empty: true };
    return { ok: true, savedAt: row.saved_at, payload: row.payload };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
ipcMain.handle('db:mirrorInfo', async () => {
  try {
    const row = getMirrorDb().prepare('SELECT saved_at, length(payload) AS size FROM mirror WHERE id = 1').get();
    if (!row) return { ok: true, empty: true };
    return { ok: true, savedAt: row.saved_at, size: row.size };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
ipcMain.handle('backup:list', async () => {
  try {
    return { ok: true, files: await listBackupFiles() };
  } catch (error) {
    return { ok: false, error: String(error), files: [] };
  }
});
ipcMain.handle('backup:save', async (_event, payload) => {
  const { content = '', filename = '' } = payload || {};
  const name = safeBackupName(filename) || `wordbook-backup-${Date.now()}.json`;
  try {
    const dir = backupDir();
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, name);
    await fs.writeFile(filePath, content, 'utf8');
    await pruneBackups(7);
    return { ok: true, filePath };
  } catch (error) {
    log('backup save failed', error);
    return { ok: false, error: String(error) };
  }
});
ipcMain.handle('backup:read', async (_event, payload) => {
  const name = safeBackupName(payload && payload.name);
  if (!name) return { ok: false, error: '无效的备份文件名' };
  try {
    const text = await fs.readFile(path.join(backupDir(), name), 'utf8');
    return { ok: true, text, name };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
});
ipcMain.handle('backup:openFolder', async () => {
  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });
  await shell.openPath(dir);
  return { ok: true, path: dir };
});
ipcMain.handle('file:saveText', async (_event, payload) => {
  const { content = '', defaultName = 'export.txt', kind = 'txt' } = payload || {};
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存文件',
    defaultPath: defaultName,
    filters: filterForKind(kind),
  });
  if (result.canceled || !result.filePath) return { ok: false, canceled: true };
  await fs.writeFile(result.filePath, content, 'utf8');
  return { ok: true, filePath: result.filePath };
});
ipcMain.handle('file:openText', async (_event, payload) => {
  const { kind = 'json' } = payload || {};
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '打开文件',
    properties: ['openFile'],
    filters: filterForKind(kind),
  });
  if (result.canceled || result.filePaths.length === 0) return { ok: false, canceled: true };
  const content = await fs.readFile(result.filePaths[0], 'utf8');
  return { ok: true, filePath: result.filePaths[0], content };
});

app.whenReady().then(() => {
  log('app ready');
  app.setAppUserModelId(APP_ID);
  log('userData:', app.getPath('userData'));
  buildMenu();
  log('menu built');
  createWindow();
  log('window created');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}).catch(err => {
  log('whenReady failed', err);
  try { dialog.showErrorBox('智能单词本启动失败', String(err && err.stack || err)); } catch { /* ignore */ }
  app.quit();
});

app.on('window-all-closed', () => {
  log('window-all-closed');
  if (process.platform !== 'darwin') app.quit();
});
