const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:version'),
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
});
