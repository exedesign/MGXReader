const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog APIs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // PDF APIs
  parsePDF: (filePath) => ipcRenderer.invoke('pdf:parse', filePath),

  // File APIs
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  saveFileContent: (options) => ipcRenderer.invoke('file:save', options),

  // App APIs
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),

  // Window APIs
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
  exitFullscreen: () => ipcRenderer.invoke('window:exitFullscreen'),

  // Platform info
  platform: process.platform,
});
