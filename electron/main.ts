import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import { initDatabase, indexDirectory, searchFiles, getFavorites, addFavorite, removeFavorite, indexerEvents, hasIndexedFiles, resetIndex } from './indexer'

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
// │
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public')

let win: BrowserWindow | null
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

async function getAvailableDrives() {
  if (process.platform === 'win32') {
    const drives = [];
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const drivePath = `${letter}:\\`;
      try {
        await fs.access(drivePath);
        drives.push({ name: `Local Disk (${letter}:)`, path: drivePath });
      } catch {}
    }
    return drives;
  }
  return [{ name: 'Root', path: '/' }];
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    // frame: false, // Removed to allow titleBarStyle to control the frame
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#ffffff',
      height: 30
    },
    transparent: true, // Needed for acrylic/glass effect
    backgroundColor: '#00000000', // Ensure transparency
    // backgroundMaterial: 'mica', // Windows 11 only, 'acrylic' or 'mica'
    vibrancy: 'under-window', // macOS
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      },
  })

  // Attempt to set acrylic effect for Windows
  // Note: 'backgroundMaterial' is available in Electron 25+
  // @ts-ignore
  if (process.platform === 'win32') {
     // @ts-ignore
    win.setBackgroundMaterial('acrylic');
  }

  win.webContents.devToolsWebContents?.openDevTools()
  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  // Window state events
  win.on('maximize', () => {
    win?.webContents.send('window-maximized', true);
  });
  win.on('unmaximize', () => {
    win?.webContents.send('window-maximized', false);
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST || '', 'index.html'))
  }
  
  // Handle window controls
  ipcMain.on('window-minimize', () => win?.minimize());
  ipcMain.on('window-maximize', () => {
      if (win?.isMaximized()) {
          win.unmaximize();
      } else {
          win?.maximize();
      }
  });
  ipcMain.on('window-close', () => win?.close());

  // Search handler
  ipcMain.handle('search-files', async (_event, query) => {
    console.log('IPC: search-files', query);
    return searchFiles(query);
  });

  ipcMain.handle('open-path', async (_event, path) => {
    console.log('IPC: open-path', path);
    await shell.openPath(path);
  });

  ipcMain.handle('list-directory', async (_event, dirPath) => {
    console.log('IPC: list-directory', dirPath);
    try {
      // Trigger lazy indexing for this directory (shallow)
      indexDirectory(dirPath, 0).catch(err => console.error('Lazy index failed:', err));

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      // Optimization: Process in chunks to avoid blocking event loop
      const results = [];
      const CHUNK_SIZE = 50;
      
      for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        const chunk = entries.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(chunk.map(async (entry) => {
          try {
            const fullPath = path.join(dirPath, entry.name);
            // Only stat if we really need size/mtime immediately. 
            // For now we do, but we catch errors individually.
            const stats = await fs.stat(fullPath);
            return {
              name: entry.name,
              path: fullPath,
              isDirectory: entry.isDirectory(),
              size: stats.size,
              mtime: stats.mtime,
            };
          } catch (e) {
            return null;
          }
        }));
        results.push(...chunkResults);
        
        // Yield to event loop every few chunks if directory is huge
        if (i % (CHUNK_SIZE * 4) === 0) {
            await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      return results.filter(f => f !== null);
    } catch (e) {
      console.error('Failed to list directory:', e);
      return [];
    }
  });

  ipcMain.handle('get-drives', async () => {
    return getAvailableDrives();
  });

  // File Operations
  ipcMain.handle('delete-file', async (_event, filePath) => {
    try {
      // Use shell.trashItem to move to recycle bin instead of permanent delete
      await shell.trashItem(filePath);
      return { success: true };
    } catch (e: any) {
      console.error('Delete failed:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('rename-file', async (_event, oldPath, newName) => {
    try {
      const dir = path.dirname(oldPath);
      const newPath = path.join(dir, newName);
      await fs.rename(oldPath, newPath);
      return { success: true };
    } catch (e: any) {
      console.error('Rename failed:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('move-file', async (_event, sourcePath, destPath) => {
    try {
      await fs.rename(sourcePath, destPath);
      return { success: true };
    } catch (e: any) {
      console.error('Move failed:', e);
      return { success: false, error: e.message };
    }
  });

  // Drag and Drop
  ipcMain.on('ondragstart', (event, filePath) => {
    event.sender.startDrag({
      file: filePath,
      icon: '' // Default icon
    });
  });

  // Favorites
  ipcMain.handle('get-favorites', async () => {
    return getFavorites();
  });

  ipcMain.handle('add-favorite', async (_event, path, name) => {
    addFavorite(path, name);
    return getFavorites();
  });

  ipcMain.handle('remove-favorite', async (_event, path) => {
    removeFavorite(path);
    return getFavorites();
  });

  // Home Directory
  ipcMain.handle('get-home-dir', () => {
    return app.getPath('home');
  });

  // Rebuild Index
  ipcMain.handle('rebuild-index', async () => {
    console.log('IPC: rebuild-index');
    try {
      win?.webContents.send('indexing-status', { isIndexing: true, message: 'Clearing index...' });
      
      await resetIndex();
      
      const home = app.getPath('home');
      win?.webContents.send('indexing-status', { isIndexing: true, message: 'Rescanning...' });
      
      // Start fresh index
      await indexDirectory(home, 99);
      
      win?.webContents.send('indexing-status', { isIndexing: false, message: 'Ready' });
      return { success: true };
    } catch (e: any) {
      console.error('Rebuild failed:', e);
      win?.webContents.send('indexing-status', { isIndexing: false, message: 'Rebuild failed' });
      return { success: false, error: e.message };
    }
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  createWindow();
  
  // Wait for window to be ready to receive messages
  win?.webContents.once('did-finish-load', async () => {
    try {
      initDatabase();
      
      // Send initial indexing status
      win?.webContents.send('indexing-status', { isIndexing: true, message: 'Starting Indexer...' });
      
      // Listen for progress updates
      const isBackground = hasIndexedFiles();
      
      const onProgress = (count: number) => {
        win?.webContents.send('indexing-status', { 
          isIndexing: !isBackground, 
          message: `Indexed ${count.toLocaleString()} files...` 
        });
      };
      indexerEvents.on('progress', onProgress);

      // Index home directory on startup
      const home = app.getPath('home');
      
      if (isBackground) {
        console.log('Index already exists. Starting background update...');
        // If we have data, show UI immediately but keep updating status
        win?.webContents.send('indexing-status', { isIndexing: false, message: 'Checking for changes...' });
        
        // Run indexing in background to pick up changes
        indexDirectory(home, 99).catch(console.error);
      } else {
        console.log('First run. Performing initial index...');
        // Perform a complete initial scan (depth 99) and wait for it
        await indexDirectory(home, 99); 
        // Notify UI we are ready
        win?.webContents.send('indexing-status', { isIndexing: false, message: 'Ready' });
      }
      
      // Cleanup listener
      indexerEvents.off('progress', onProgress);
      
    } catch (err) {
      console.error('Failed to init:', err);
      win?.webContents.send('indexing-status', { isIndexing: false, message: 'Error initializing' });
    }
  });
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});
