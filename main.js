const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

const APP_ID = 'com.mokiklok.smartvocab';
let mainWindow = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function createWindow() {
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

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

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

ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:openDataFolder', async () => {
  await shell.openPath(app.getPath('userData'));
  return { ok: true, path: app.getPath('userData') };
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
  app.setAppUserModelId(APP_ID);
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
