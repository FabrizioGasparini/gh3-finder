import { contextBridge, ipcRenderer } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onWindowMaximized: (callback: (isMaximized: boolean) => void) => {
    const subscription = (_event: any, isMaximized: boolean) => callback(isMaximized)
    ipcRenderer.on('window-maximized', subscription)
    return () => ipcRenderer.removeListener('window-maximized', subscription)
  },

  // Search
  searchFiles: (query: string) => ipcRenderer.invoke('search-files', query),
  openPath: (path: string) => ipcRenderer.invoke('open-path', path),
  
  // File System
  listDirectory: (path: string) => ipcRenderer.invoke('list-directory', path),
  getDrives: () => ipcRenderer.invoke('get-drives'),
  
  // Operations
  deleteFile: (path: string) => ipcRenderer.invoke('delete-file', path),
  renameFile: (oldPath: string, newName: string) => ipcRenderer.invoke('rename-file', oldPath, newName),
  startDrag: (path: string) => ipcRenderer.send('ondragstart', path),
  
  // Favorites
  getFavorites: () => ipcRenderer.invoke('get-favorites'),
  addFavorite: (path: string, name: string) => ipcRenderer.invoke('add-favorite', path, name),
  removeFavorite: (path: string) => ipcRenderer.invoke('remove-favorite', path),

  // Indexing events
  onIndexingStatus: (callback: (event: any, status: { isIndexing: boolean, message: string }) => void) => {
    const subscription = (_event: any, status: any) => callback(_event, status)
    ipcRenderer.on('indexing-status', subscription)
    return () => ipcRenderer.removeListener('indexing-status', subscription)
  },
  rebuildIndex: () => ipcRenderer.invoke('rebuild-index'),

  // Home Directory
  getHomeDir: () => ipcRenderer.invoke('get-home-dir'),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
})
