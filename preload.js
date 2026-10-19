const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isElectron: true,
  platform: process.platform,
  getVersion: () => ipcRenderer.invoke('app:version'),
  openDataFolder: () => ipcRenderer.invoke('app:openDataFolder'),
  saveTextFile: (payload) => ipcRenderer.invoke('file:saveText', payload),
  openTextFile: (payload) => ipcRenderer.invoke('file:openText', payload),
});
