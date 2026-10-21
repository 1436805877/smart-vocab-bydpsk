const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:version'),
  setFullscreen: (flag) => ipcRenderer.invoke('app:setFullscreen', flag),
  isFullscreen: () => ipcRenderer.invoke('app:isFullscreen'),
  onFullscreenChanged: (callback) => {
    const listener = (_event, value) => callback(!!value);
    ipcRenderer.on('app:fullscreenChanged', listener);
    return () => ipcRenderer.removeListener('app:fullscreenChanged', listener);
  },
  getDesktopWallpaper: () => ipcRenderer.invoke('theme:desktopWallpaper'),
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
  dbReplaceStore: (store, rows) => ipcRenderer.invoke('db:replaceStore', { store, rows }),
  dbImportAll: (payload) => ipcRenderer.invoke('db:importAll', payload),
  dbPut: (store, row) => ipcRenderer.invoke('db:put', { store, row }),
  dbDelete: (store, key) => ipcRenderer.invoke('db:delete', { store, key }),
});
