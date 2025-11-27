/// <reference types="vite/client" />

interface Window {
  ipcRenderer: {
    on(channel: string, listener: (event: any, ...args: any[]) => void): void
    off(channel: string, ...args: any[]): void
    send(channel: string, ...args: any[]): void
    invoke(channel: string, ...args: any[]): Promise<any>
    minimize(): void
    maximize(): void
    close(): void
    onWindowMaximized(callback: (isMaximized: boolean) => void): () => void
    searchFiles(query: string): Promise<any[]>
    openPath(path: string): Promise<void>
    listDirectory(path: string): Promise<any[]>
    getDrives(): Promise<any[]>
    getHomeDir(): Promise<string>
    deleteFile(path: string): Promise<{ success: boolean; error?: string }>
    renameFile(oldPath: string, newName: string): Promise<{ success: boolean; error?: string }>
    startDrag(path: string): void
    getFavorites(): Promise<any[]>
    addFavorite(path: string, name: string): Promise<any[]>
    removeFavorite(path: string): Promise<any[]>
    onIndexingStatus(callback: (event: any, status: { isIndexing: boolean, message: string }) => void): () => void
    rebuildIndex(): Promise<{ success: boolean; error?: string }>
    getSettings(): Promise<any>
    saveSettings(settings: any): Promise<{ success: boolean }>
  }
}
