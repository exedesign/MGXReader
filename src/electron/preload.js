const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Dialog APIs
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // PDF APIs
  getPDFInfo: (filePath) => ipcRenderer.invoke('pdf:getInfo', filePath),
  parsePDF: (filePath, selectedPages) => ipcRenderer.invoke('pdf:parse', filePath, selectedPages),
  pdfToImages: (filePath, selectedPages) => ipcRenderer.invoke('pdf:toImages', filePath, selectedPages),
  
  // OCR APIs
  ocrCleanup: (tmpDir) => ipcRenderer.invoke('ocr:cleanup', tmpDir),

  // File APIs
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  saveFileContent: (options) => ipcRenderer.invoke('file:saveContent', options),
  generateDocument: (options) => ipcRenderer.invoke('document:generate', options),
  readFileContent: (filePath) => ipcRenderer.invoke('file:readContent', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('file:exists', filePath),
  directoryExists: (dirPath) => ipcRenderer.invoke('file:directoryExists', dirPath),
  ensureDir: (dirPath) => ipcRenderer.invoke('file:ensureDir', dirPath),
  listDirectory: (dirPath) => ipcRenderer.invoke('file:listDirectory', dirPath),
  deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),
  getTempDir: () => ipcRenderer.invoke('file:getTempDir'),

  // App APIs
  getAppPath: (name) => ipcRenderer.invoke('app:getPath', name),
  closeApp: () => ipcRenderer.invoke('app:quit'),

  // Window APIs
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  isFullscreen: () => ipcRenderer.invoke('window:isFullscreen'),
  exitFullscreen: () => ipcRenderer.invoke('window:exitFullscreen'),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // Platform info
  platform: process.platform,
});
