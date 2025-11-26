# Glass Explorer

A modern, glassy file explorer for Windows built with Electron, React, and Vite.
Features a reverse index search powered by SQLite FTS5.

## Features

- **Glassy UI**: Acrylic/Mica effect on Windows 11.
- **Fast Search**: Reverse index search for instant results.
- **Modern Design**: Clean, dark-themed UI with Tailwind CSS.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Run in development mode:
    ```bash
    npm run dev
    ```

3.  Build for production:
    ```bash
    npm run build
    ```

## Architecture

- **Main Process**: Handles window creation, SQLite database, and file indexing.
- **Renderer Process**: React UI with Tailwind CSS.
- **IPC**: Communication between Main and Renderer for search and file operations.
- **Database**: `better-sqlite3` with FTS5 for full-text search.

## Troubleshooting

- **Native Modules**: If you encounter errors with `better-sqlite3`, ensure you have build tools installed or run `npm rebuild`.
- **Acrylic Effect**: Requires Windows 10/11. On older versions, it might fall back to transparent or opaque.
