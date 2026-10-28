const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:version'),
  ensureBuiltinWordbook: () => ipcRenderer.invoke('app:ensureBuiltinWordbook'),
  restoreBuiltinWordbook: () => ipcRenderer.invoke('app:restoreBuiltinWordbook'),
  readSettings: () => ipcRenderer.invoke('storage:readSettings'),
  writeSettings: (data) => ipcRenderer.invoke('storage:writeSettings', data),
  listWallpapers: () => ipcRenderer.invoke('wallpaper:list'),
  getWallpaper: (id) => ipcRenderer.invoke('wallpaper:get', id),
  saveWallpaper: (payload) => ipcRenderer.invoke('wallpaper:save', payload),
  deleteWallpaper: (id) => ipcRenderer.invoke('wallpaper:delete', id),
  setWallpaperPreset: (id, preset) => ipcRenderer.invoke('wallpaper:setPreset', { id, preset }),
  setFullscreen: (flag) => ipcRenderer.invoke('app:setFullscreen', flag),
  isFullscreen: () => ipcRenderer.invoke('app:isFullscreen'),
  onFullscreenChanged: (callback) => {
    const listener = (_event, value) => callback(!!value);
    ipcRenderer.on('app:fullscreenChanged', listener);
    return () => ipcRenderer.removeListener('app:fullscreenChanged', listener);
  },
  getDesktopWallpaper: () => ipcRenderer.invoke('theme:desktopWallpaper'),
  getUpdateState: () => ipcRenderer.invoke('update:getState'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  openUpdateRelease: () => ipcRenderer.invoke('update:openRelease'),
  onUpdateState: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on('update:state', listener);
    return () => ipcRenderer.removeListener('update:state', listener);
  },
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  saveTextFile: (payload) => ipcRenderer.invoke('file:saveText', payload),
  openTextFile: (payload) => ipcRenderer.invoke('file:openText', payload),
  saveBackup: (content, filename) => ipcRenderer.invoke('backup:save', { content, filename }),
  listBackups: () => ipcRenderer.invoke('backup:list'),
  readBackup: (name) => ipcRenderer.invoke('backup:read', { name }),
  openBackupFolder: () => ipcRenderer.invoke('backup:openFolder'),
  mirrorSave: (payload) => ipcRenderer.invoke('db:mirrorSave', payload),
  mirrorLoad: () => ipcRenderer.invoke('db:mirrorLoad'),
  mirrorInfo: () => ipcRenderer.invoke('db:mirrorInfo'),
  dbInfo: () => ipcRenderer.invoke('db:info'),
  dbGetAll: (store) => ipcRenderer.invoke('db:getAll', store),
  dbGetBackupMetas: () => ipcRenderer.invoke('db:getBackupMetas'),
  dbGetBackup: (id) => ipcRenderer.invoke('db:getBackup', id),
  dbReplaceStore: (store, rows) => ipcRenderer.invoke('db:replaceStore', { store, rows }),
  dbImportAll: (payload) => ipcRenderer.invoke('db:importAll', payload),
  dbPut: (store, row) => ipcRenderer.invoke('db:put', { store, row }),
  dbDelete: (store, key) => ipcRenderer.invoke('db:delete', { store, key }),
});
