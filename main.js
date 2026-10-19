const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Supported image extensions
const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.svg', '.avif', '.tiff', '.tif'
]);

let mainWindow = null;

// Register custom protocol for fast, secure local file loading
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'photo-app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0c0e14',
    title: 'Photo Selector',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Protocol handler for loading local photos safely without CORS/webSecurity issues
  protocol.handle('photo-app', (request) => {
    try {
      // Decode URL and extract file path
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);
      
      // On Windows, pathname begins with /D:/... remove leading slash
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch (err) {
      console.error('Failed to load local photo:', err);
      return new Response('File not found', { status: 404 });
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: Open directory picker dialog
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Pilih Folder Foto'
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// IPC: Scan folder for photos
ipcMain.handle('photos:scan', async (event, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    throw new Error('Folder tidak ditemukan');
  }

  const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
  const photos = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext)) {
        const fullPath = path.join(folderPath, entry.name);
        try {
          const stats = await fs.promises.stat(fullPath);
          photos.push({
            filename: entry.name,
            fullPath: fullPath,
            size: stats.size,
            mtime: stats.mtimeMs
          });
        } catch {
          // Skip if unable to stat
        }
      }
    }
  }

  // Natural alphabetical sorting (e.g., IMG_1, IMG_2, IMG_10)
  photos.sort((a, b) =>
    a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' })
  );

  return photos;
});

// IPC: Load selection-data.json from target folder
ipcMain.handle('storage:load', async (event, folderPath) => {
  const dataPath = path.join(folderPath, 'selection-data.json');
  if (fs.existsSync(dataPath)) {
    try {
      const content = await fs.promises.readFile(dataPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Error parsing selection-data.json:', err);
      return null;
    }
  }
  return null;
});

// IPC: Save selection-data.json
ipcMain.handle('storage:save', async (event, folderPath, data) => {
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { success: false, error: 'Folder tidak valid' };
  }

  const dataPath = path.join(folderPath, 'selection-data.json');
  const tempPath = path.join(folderPath, 'selection-data.json.tmp');

  try {
    const jsonString = JSON.stringify(data, null, 2);
    // Atomic write via temp file
    await fs.promises.writeFile(tempPath, jsonString, 'utf8');
    await fs.promises.rename(tempPath, dataPath);
    return { success: true };
  } catch (err) {
    console.error('Error saving selection-data.json:', err);
    return { success: false, error: err.message };
  }
});

// IPC: Export photos (copy or move)
ipcMain.handle('photos:export', async (event, { folderPath, mode, targets }) => {
  // mode: 'copy' | 'move'
  // targets: array of { filename, fullPath, status }
  if (!folderPath || !fs.existsSync(folderPath)) {
    return { success: false, error: 'Folder sumber tidak valid' };
  }

  const subdirs = {
    pick: path.join(folderPath, 'picks'),
    reject: path.join(folderPath, 'rejects'),
    maybe: path.join(folderPath, 'maybes')
  };

  // Ensure destination folders exist if there are photos for them
  const neededDirs = new Set();
  for (const item of targets) {
    if (subdirs[item.status]) {
      neededDirs.add(subdirs[item.status]);
    }
  }

  for (const dir of neededDirs) {
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true });
    }
  }

  const results = {
    total: targets.length,
    processed: 0,
    failed: 0,
    errors: []
  };

  for (const item of targets) {
    const destDir = subdirs[item.status];
    if (!destDir) continue;

    const sourcePath = item.fullPath;
    const destPath = path.join(destDir, item.filename);

    try {
      if (mode === 'move') {
        await fs.promises.rename(sourcePath, destPath);
      } else {
        await fs.promises.copyFile(sourcePath, destPath);
      }
      results.processed++;
    } catch (err) {
      results.failed++;
      results.errors.push(`${item.filename}: ${err.message}`);
    }
  }

  return { success: true, results };
});

// IPC: Show item in OS File Explorer
ipcMain.handle('photos:showInFolder', async (event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});
