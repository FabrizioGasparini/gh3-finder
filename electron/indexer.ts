import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { app } from 'electron';
import chokidar from 'chokidar';
import { EventEmitter } from 'node:events';

export const indexerEvents = new EventEmitter();

const dbPath = path.join(app.getPath('userData'), 'index.db');
let db: Database.Database;
let totalIndexedFiles = 0;

export function initDatabase() {
  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL'); // Performance optimization
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        extension TEXT,
        size INTEGER,
        mtime INTEGER,
        parent_path TEXT
      );
      
      CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(name, path, content);

      CREATE TABLE IF NOT EXISTS favorites (
        path TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );

      -- Triggers to keep FTS index in sync automatically
      CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
        INSERT INTO files_fts(rowid, name, path, content) VALUES (new.id, new.name, new.path, new.name);
      END;
      CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
        INSERT INTO files_fts(files_fts, rowid, name, path, content) VALUES('delete', old.id, old.name, old.path, old.name);
      END;
      CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
        INSERT INTO files_fts(files_fts, rowid, name, path, content) VALUES('delete', old.id, old.name, old.path, old.name);
        INSERT INTO files_fts(rowid, name, path, content) VALUES (new.id, new.name, new.path, new.name);
      END;
    `);

    console.log('Database initialized at', dbPath);
  } catch (err) {
    console.error('Failed to initialize database:', err);
  }
}

export function searchFiles(query: string) {
  if (!db) return [];
  
  try {
    // Simple FTS search
    const stmt = db.prepare(`
      SELECT * FROM files_fts 
      WHERE files_fts MATCH ? 
      ORDER BY rank 
      LIMIT 100
    `);
    // Append wildcard for prefix search
    const searchPattern = `"${query}"* OR ${query}*`; 
    return stmt.all(searchPattern);
  } catch (err) {
    console.error('Search failed:', err);
    return [];
  }
}

// Batching configuration
interface FileQueueItem {
  path: string;
  stats?: Stats;
}

let fileQueue: FileQueueItem[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
const BATCH_SIZE = 500; // Reduced to avoid blocking main thread
const FLUSH_DELAY = 200;

// Watcher management
const watchers = new Map<string, chokidar.FSWatcher>();

export async function indexDirectory(dirPath: string, depth: number = 0): Promise<void> {
  // Check if we already have a watcher for this path
  if (watchers.has(dirPath)) {
    console.log(`Watcher for ${dirPath} already exists. Skipping.`);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log('Indexing directory:', dirPath, 'depth:', depth);
    
    // Use chokidar for watching and initial scan
    const watcher = chokidar.watch(dirPath, {
      ignored: [
        /(^|[\/\\])\../, // ignore dotfiles
        /(^|[\/\\])node_modules($|[\/\\])/, // ignore node_modules
        /(^|[\/\\])\.git($|[\/\\])/, // ignore .git
        /(^|[\/\\])AppData($|[\/\\])/, // ignore AppData (caches, logs, etc)
        /(^|[\/\\])(hiberfil\.sys|pagefile\.sys|swapfile\.sys|DumpStack\.log\.tmp)/i, // ignore system files
        /(^|[\/\\])(System Volume Information|\$RECYCLE\.BIN|Config\.Msi|Windows|Program Files|Program Files \(x86\))/i // ignore system folders
      ],
      persistent: true,
      depth: depth, 
      ignorePermissionErrors: true,
      alwaysStat: true // Get stats directly from watcher to avoid extra syscalls
    });

    watchers.set(dirPath, watcher);

    watcher
      .on('add', (filePath, stats) => queueFileForIndex(filePath, stats))
      .on('change', (filePath, stats) => queueFileForIndex(filePath, stats))
      .on('unlink', (filePath) => removeFileFromIndex(filePath))
      .on('error', (error) => console.log(`Watcher error: ${error}`))
      .on('ready', () => {
        console.log('Initial scan complete for', dirPath);
        resolve();
      });
  });
}

function queueFileForIndex(filePath: string, stats?: Stats) {
  fileQueue.push({ path: filePath, stats });
  if (fileQueue.length >= BATCH_SIZE) {
    flushQueue();
  } else if (!flushTimeout) {
    flushTimeout = setTimeout(flushQueue, FLUSH_DELAY);
  }
}

function flushQueue() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  if (fileQueue.length === 0 || !db) return;

  const batch = [...fileQueue];
  fileQueue = [];

  try {
    // Use ON CONFLICT DO UPDATE to avoid unnecessary writes/trigger firings for unchanged files
    const insert = db.prepare(`
      INSERT INTO files (path, name, extension, size, mtime, parent_path)
      VALUES (@path, @name, @extension, @size, @mtime, @parentDir)
      ON CONFLICT(path) DO UPDATE SET
        name=excluded.name,
        extension=excluded.extension,
        size=excluded.size,
        mtime=excluded.mtime,
        parent_path=excluded.parent_path
      WHERE files.mtime != excluded.mtime OR files.size != excluded.size
    `);
    
    // FTS updates are now handled by triggers

    const transaction = db.transaction((items: FileQueueItem[]) => {
      for (const item of items) {
        try {
            const filePath = item.path;
            const name = path.basename(filePath);
            const ext = path.extname(filePath);
            const parentDir = path.dirname(filePath);
            const size = item.stats ? item.stats.size : 0;
            const mtime = item.stats ? item.stats.mtimeMs : Date.now();
            
            insert.run({ 
              path: filePath, 
              name, 
              extension: ext, 
              size, 
              mtime, 
              parentDir 
            });
        } catch (e) {
            // ignore individual errors
        }
      }
    });

    transaction(batch);
    
    totalIndexedFiles += batch.length;
    indexerEvents.emit('progress', totalIndexedFiles);
    
    // console.log(`Indexed batch of ${batch.length} files`);
  } catch (err) {
    console.error('Failed to batch index:', err);
  }
}

function addFileToIndex(filePath: string) {
  // Deprecated in favor of queueFileForIndex, but keeping for reference if needed
  queueFileForIndex(filePath);
}

function removeFileFromIndex(filePath: string) {
  if (!db) return;
  try {
    db.prepare('DELETE FROM files WHERE path = ?').run(filePath);
    // FTS deletion handled by trigger
  } catch (err) {
    console.error('Failed to remove file:', filePath, err);
  }
}

export function getFavorites() {
  if (!db) return [];
  try {
    return db.prepare('SELECT * FROM favorites').all();
  } catch (err) {
    console.error('Failed to get favorites:', err);
    return [];
  }
}

export function addFavorite(path: string, name: string) {
  if (!db) return;
  try {
    db.prepare('INSERT OR IGNORE INTO favorites (path, name) VALUES (?, ?)').run(path, name);
  } catch (err) {
    console.error('Failed to add favorite:', err);
  }
}

export function removeFavorite(path: string) {
  if (!db) return;
  try {
    db.prepare('DELETE FROM favorites WHERE path = ?').run(path);
  } catch (err) {
    console.error('Failed to remove favorite:', err);
  }
}

export function hasIndexedFiles(): boolean {
  if (!db) return false;
  try {
    const result = db.prepare('SELECT id FROM files LIMIT 1').get();
    return !!result;
  } catch (err) {
    console.error('Failed to check file count:', err);
    return false;
  }
}

export async function resetIndex() {
  console.log('Resetting index...');
  
  // Close watchers
  for (const [path, watcher] of watchers) {
    await watcher.close();
  }
  watchers.clear();
  
  // Clear queue
  fileQueue = [];
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  // Clear DB
  if (db) {
    try {
      // Transaction for speed
      const transaction = db.transaction(() => {
        db.prepare('DELETE FROM files').run();
      });
      transaction();
      
      totalIndexedFiles = 0;
      console.log('Index cleared.');
    } catch (err) {
      console.error('Failed to clear index:', err);
    }
  }
}
