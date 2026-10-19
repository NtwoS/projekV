const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanPhotos: (folderPath) => ipcRenderer.invoke('photos:scan', folderPath),
  loadSelection: (folderPath) => ipcRenderer.invoke('storage:load', folderPath),
  saveSelection: (folderPath, data) => ipcRenderer.invoke('storage:save', folderPath, data),
  exportPhotos: (params) => ipcRenderer.invoke('photos:export', params),
  showInFolder: (filePath) => ipcRenderer.invoke('photos:showInFolder', filePath),
  
  // Helper to convert full local path to custom protocol URL
  toPhotoUrl: (fullPath) => {
    return `photo-app://view/?file=${encodeURIComponent(fullPath)}`;
  },

  // Listen to native menu actions
  onMenuAction: (callback) => {
    ipcRenderer.on('menu:action', (_event, action) => callback(action));
  }
});
