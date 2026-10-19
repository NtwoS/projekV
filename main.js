const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// Supported image extensions
const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.svg', '.avif', '.tiff', '.tif'
]);

let mainWindow = null;

// GPU: gunakan software rendering sebagai fallback aman
// Ini mencegah crash "GPU process exited unexpectedly: exit_code=34"
// pada PC/laptop dengan GPU lemah atau driver lama
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.disableHardwareAcceleration();

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

function buildAppMenu(windowInstance) {
  const isMac = process.platform === 'darwin';

  const template = [
    // File Menu
    {
      label: '&File',
      submenu: [
        {
          label: '&Buka Folder Foto...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            windowInstance.webContents.send('menu:action', 'open-folder');
          }
        },
        {
          label: 'Buka Ulang Folder Ini (Refresh)',
          accelerator: 'F5',
          click: () => {
            windowInstance.webContents.send('menu:action', 'refresh-folder');
          }
        },
        { type: 'separator' },
        {
          label: '&Export Foto Terseleksi...',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            windowInstance.webContents.send('menu:action', 'open-export');
          }
        },
        {
          label: 'Buka Folder di File &Explorer',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            windowInstance.webContents.send('menu:action', 'open-in-explorer');
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { label: '&Keluar', role: 'quit', accelerator: 'Alt+F4' }
      ]
    },
    // Edit Menu
    {
      label: '&Edit',
      submenu: [
        {
          label: '&Undo Seleksi Terakhir',
          accelerator: 'CmdOrCtrl+Z',
          click: () => {
            windowInstance.webContents.send('menu:action', 'undo');
          }
        },
        { type: 'separator' },
        {
          label: '✅ Pick (Pilih Foto)',
          accelerator: '1',
          click: () => {
            windowInstance.webContents.send('menu:action', 'mark-pick');
          }
        },
        {
          label: '❌ Reject (Tolak Foto)',
          accelerator: '2',
          click: () => {
            windowInstance.webContents.send('menu:action', 'mark-reject');
          }
        },
        {
          label: '🤔 Maybe (Ragu-ragu)',
          accelerator: '3',
          click: () => {
            windowInstance.webContents.send('menu:action', 'mark-maybe');
          }
        },
        {
          label: '⚪ Reset Status',
          accelerator: '0',
          click: () => {
            windowInstance.webContents.send('menu:action', 'mark-reset');
          }
        },
        { type: 'separator' },
        {
          label: '⏭ Toggle &Auto-Advance',
          accelerator: 'Shift+A',
          click: () => {
            windowInstance.webContents.send('menu:action', 'toggle-autoadvance');
          }
        },
        { type: 'separator' },
        {
          label: '&Pengaturan Tombol & Controller...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            windowInstance.webContents.send('menu:action', 'open-settings');
          }
        }
      ]
    },
    // View Menu
    {
      label: '&View',
      submenu: [
        {
          label: 'Foto &Berikutnya (Next)',
          accelerator: 'Space',
          click: () => {
            windowInstance.webContents.send('menu:action', 'next-photo');
          }
        },
        {
          label: 'Foto &Sebelumnya (Prev)',
          accelerator: 'Q',
          click: () => {
            windowInstance.webContents.send('menu:action', 'prev-photo');
          }
        },
        { type: 'separator' },
        {
          label: '🔍 Toggle Toolbar &Filter & Sort',
          accelerator: 'Shift+F',
          click: () => {
            windowInstance.webContents.send('menu:action', 'toggle-viewer-filter');
          }
        },
        {
          label: 'Filter Cepat',
          submenu: [
            {
              label: 'Semua Foto (All)',
              click: () => windowInstance.webContents.send('menu:action', 'filter-all')
            },
            {
              label: 'Belum Ditinjau (Unmarked)',
              click: () => windowInstance.webContents.send('menu:action', 'filter-unmarked')
            },
            {
              label: 'Pick (Pilihan)',
              click: () => windowInstance.webContents.send('menu:action', 'filter-pick')
            },
            {
              label: 'Reject (Ditolak)',
              click: () => windowInstance.webContents.send('menu:action', 'filter-reject')
            },
            {
              label: 'Maybe (Ragu-ragu)',
              click: () => windowInstance.webContents.send('menu:action', 'filter-maybe')
            }
          ]
        },
        {
          label: 'Urutan Foto (Sort)',
          submenu: [
            {
              label: 'Nama File (A → Z)',
              click: () => windowInstance.webContents.send('menu:action', 'sort-name-asc')
            },
            {
              label: 'Nama File (Z → A)',
              click: () => windowInstance.webContents.send('menu:action', 'sort-name-desc')
            },
            {
              label: 'Waktu / Tanggal (Terbaru)',
              click: () => windowInstance.webContents.send('menu:action', 'sort-date-desc')
            },
            {
              label: 'Waktu / Tanggal (Terlama)',
              click: () => windowInstance.webContents.send('menu:action', 'sort-date-asc')
            },
            {
              label: 'Ukuran File (Terbesar)',
              click: () => windowInstance.webContents.send('menu:action', 'sort-size-desc')
            },
            {
              label: 'Status Seleksi',
              click: () => windowInstance.webContents.send('menu:action', 'sort-status')
            }
          ]
        },
        { type: 'separator' },
        {
          label: '&Toggle Panel Daftar Seleksi',
          accelerator: 'Tab',
          click: () => {
            windowInstance.webContents.send('menu:action', 'toggle-sidebar');
          }
        },
        {
          label: 'Toggle &Filmstrip Bawah',
          accelerator: 'Shift+B',
          click: () => {
            windowInstance.webContents.send('menu:action', 'toggle-filmstrip');
          }
        },
        { type: 'separator' },
        {
          label: 'Zoom &In',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            windowInstance.webContents.send('menu:action', 'zoom-in');
          }
        },
        {
          label: 'Zoom &Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            windowInstance.webContents.send('menu:action', 'zoom-out');
          }
        },
        {
          label: '&Reset Zoom (100%)',
          accelerator: 'R',
          click: () => {
            windowInstance.webContents.send('menu:action', 'reset-zoom');
          }
        },
        { type: 'separator' },
        { label: '&Layar Penuh (Toggle Full Screen)', role: 'togglefullscreen' },
        { label: 'Toggle Developer &Tools', role: 'toggleDevTools' },
        { label: '&Reload Halaman', role: 'reload' }
      ]
    },
    // Help Menu
    {
      label: '&Help',
      submenu: [
        {
          label: '&Panduan Controller & Shortcut Keyboard',
          accelerator: 'F1',
          click: () => {
            windowInstance.webContents.send('menu:action', 'show-help');
          }
        },
        {
          label: 'Pengaturan &Controller / Joystick...',
          click: () => {
            windowInstance.webContents.send('menu:action', 'open-settings');
          }
        },
        { type: 'separator' },
        {
          label: '&Tentang Photo Selector',
          click: () => {
            dialog.showMessageBox(windowInstance, {
              type: 'info',
              title: 'Tentang Photo Selector',
              message: 'Photo Selector v1.0.0',
              detail: 'Aplikasi desktop culling & seleksi foto berkecepatan tinggi dengan dukungan Joystick / Controller dan Keyboard.\n\nLisensi: MIT\nPengembang: NtwoS',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#080808',
    title: 'Photo Selector',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    autoHideMenuBar: false,
    show: false
  });

  buildAppMenu(mainWindow);

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
      const url = new URL(request.url);
      let filePath = url.searchParams.get('file');

      // Fallback if accessed via pathname
      if (!filePath) {
        filePath = decodeURIComponent(url.pathname);
        if (process.platform === 'win32' && filePath.startsWith('/')) {
          filePath = filePath.slice(1);
        }
      }

      if (!filePath || !fs.existsSync(filePath)) {
        return new Response('File not found: ' + filePath, { status: 404 });
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch (err) {
      console.error('Failed to load local photo:', err);
      return new Response('File error: ' + err.message, { status: 500 });
    }
  });

  createWindow();

  // Tangani GPU crash — jangan biarkan aplikasi mati total
  app.on('gpu-process-crashed', (event, killed) => {
    console.warn('GPU process crashed. Killed:', killed);
    // Reload halaman agar tetap bisa dipakai
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.reload();
    }
  });

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

// IPC: Scan folder for photos — instant, no per-file stat()
// Photo viewers are fast because they just list files and show them.
// Metadata (size, mtime) is fetched lazily only when needed.
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
        photos.push({
          filename: entry.name,
          fullPath: path.join(folderPath, entry.name),
          size: 0,    // fetched lazily
          mtime: 0    // fetched lazily
        });
      }
    }
  }

  // Natural alphabetical sorting (e.g., IMG_1, IMG_2, IMG_10)
  photos.sort((a, b) =>
    a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: 'base' })
  );

  return photos;
});

// IPC: Fetch metadata (size, mtime) for a batch of files — called lazily
ipcMain.handle('photos:metadata', async (event, filePaths) => {
  const results = {};
  const tasks = filePaths.map(async (fp) => {
    try {
      const stats = await fs.promises.stat(fp);
      results[fp] = { size: stats.size, mtime: stats.mtimeMs };
    } catch {
      results[fp] = { size: 0, mtime: 0 };
    }
  });
  await Promise.all(tasks);
  return results;
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

// Helper: path to keybindings.json in app userData
function getKeybindingsFilePath() {
  return path.join(app.getPath('userData'), 'keybindings.json');
}

// IPC: Load keybindings configuration
ipcMain.handle('keybindings:load', async () => {
  const filePath = getKeybindingsFilePath();
  if (fs.existsSync(filePath)) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error('Error loading keybindings.json:', err);
      return null;
    }
  }
  return null;
});

// IPC: Save keybindings configuration
ipcMain.handle('keybindings:save', async (event, data) => {
  const filePath = getKeybindingsFilePath();
  const tempPath = filePath + '.tmp';
  try {
    const jsonString = JSON.stringify(data, null, 2);
    await fs.promises.writeFile(tempPath, jsonString, 'utf8');
    await fs.promises.rename(tempPath, filePath);
    return { success: true };
  } catch (err) {
    console.error('Error saving keybindings.json:', err);
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

// IPC: Open folder directly in OS File Explorer
ipcMain.handle('photos:openFolderInExplorer', async (event, folderPath) => {
  if (folderPath && fs.existsSync(folderPath)) {
    shell.openPath(folderPath);
    return true;
  }
  return false;
});
