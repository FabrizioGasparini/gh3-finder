import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Folder, File, Settings, X, Minus, Square, ArrowLeft, ArrowRight, HardDrive, Plus, Star, LayoutGrid, List, AlignJustify, ArrowDownAZ, ArrowUpAZ, Calendar, HardDriveDownload, ChevronRight, Palette, Droplets, Eye, RefreshCw } from 'lucide-react'
import { ContextMenu } from './components/ContextMenu'
import { LoadingScreen } from './components/LoadingScreen'

interface Tab {
  id: string
  path: string
  history: string[]
  historyIndex: number
  files: any[]
  scrollPos: number
}

type ViewMode = 'grid' | 'list' | 'details'
type SortBy = 'name' | 'date' | 'size' | 'type'
type SortOrder = 'asc' | 'desc'

interface AppSettings {
  accentColor: string;
  blurStrength: string;
  bgOpacity: number;
}

function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [drives, setDrives] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [isIndexing, setIsIndexing] = useState(true) // Tracks if backend is indexing
  const [showSplash, setShowSplash] = useState(true) // Tracks if splash screen is visible
  const [indexingMessage, setIndexingMessage] = useState('Initializing...')
  const [isMaximized, setIsMaximized] = useState(false)
  
  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    accentColor: 'blue',
    blurStrength: 'backdrop-blur-2xl',
    bgOpacity: 0.4
  })
  const [showSettings, setShowSettings] = useState(false)

  // Path Bar State
  const [isEditingPath, setIsEditingPath] = useState(false)
  const [pathInput, setPathInput] = useState('')
  const pathInputRef = useRef<HTMLInputElement>(null)

  // View & Sort State
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortBy, setSortBy] = useState<SortBy>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // Tabs State
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState('1')
  
  const activeTab = tabs.find(t => t.id === activeTabId) || { id: '1', path: '', history: [], historyIndex: 0, files: [], scrollPos: 0 }

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; item: any | null }>({
    visible: false,
    x: 0,
    y: 0,
    item: null,
  })

  useEffect(() => {
    if (isEditingPath && pathInputRef.current) {
      pathInputRef.current.focus()
      pathInputRef.current.select()
    }
  }, [isEditingPath])

  useEffect(() => {
    console.log('App mounted');
    const init = async () => {
      console.log('Loading drives...');
      loadDrives()
      console.log('Loading favorites...');
      loadFavorites()
      
      // Start at home directory instead of C:\ to avoid permission issues
      try {
        console.log('Getting home dir...');
        const home = await window.ipcRenderer.getHomeDir()
        console.log('Home dir:', home);
        setTabs([{ id: '1', path: home, history: [home], historyIndex: 0, files: [], scrollPos: 0 }])
        setActiveTabId('1')
        console.log('Navigating to home...');
        navigateTo(home, false, '1')
      } catch (e) {
        console.error('Failed to get home dir, falling back to C:\\', e)
        navigateTo('C:\\', false, '1')
      }
    }
    init()

    // Listen for window maximize state
    const removeMaximizeListener = window.ipcRenderer.onWindowMaximized((maximized) => {
      setIsMaximized(maximized)
    })

    // Listen for indexing status
    const removeListener = window.ipcRenderer.onIndexingStatus((_event, status) => {
      setIsIndexing(status.isIndexing)
      setIndexingMessage(status.message)
      
      // If indexing is done, hide splash
      if (!status.isIndexing) {
        // Wait a bit for the user to see "Ready" or similar
        setTimeout(() => setShowSplash(false), 500)
      } else {
        setShowSplash(true)
      }
    })

    return () => {
      removeListener()
      removeMaximizeListener()
    }
  }, [])

  const loadDrives = async () => {
    try {
      const d = await window.ipcRenderer.getDrives()
      setDrives(d)
    } catch (e) {
      console.error(e)
    }
  }

  const loadFavorites = async () => {
    try {
      const f = await window.ipcRenderer.getFavorites()
      setFavorites(f)
    } catch (e) {
      console.error(e)
    }
  }

  const navigateTo = async (path: string, addToHistory = true, tabId = activeTabId) => {
    console.log('navigateTo called:', path, tabId);
    try {
      const items = await window.ipcRenderer.listDirectory(path)
      console.log('listDirectory result items:', items.length);
      
      setTabs(prevTabs => prevTabs.map(tab => {
        if (tab.id === tabId) {
          const newHistory = addToHistory ? [...tab.history.slice(0, tab.historyIndex + 1), path] : tab.history
          const newIndex = addToHistory ? newHistory.length - 1 : tab.historyIndex
          return {
            ...tab,
            path,
            files: items,
            history: newHistory,
            historyIndex: newIndex
          }
        }
        return tab
      }))
    } catch (e) {
      console.error('Failed to navigate:', e)
    }
  }

  // Sorting Logic
  const sortedFiles = useMemo(() => {
    const files = [...activeTab.files]
    return files.sort((a, b) => {
      // Always keep folders on top
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }

      let comparison = 0
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = (a.size || 0) - (b.size || 0)
          break
        case 'date':
          comparison = new Date(a.mtime).getTime() - new Date(b.mtime).getTime()
          break
        case 'type':
           // Simple extension check
           const extA = a.name.split('.').pop() || ''
           const extB = b.name.split('.').pop() || ''
           comparison = extA.localeCompare(extB)
           break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [activeTab.files, sortBy, sortOrder])

  const handleBack = () => {
    if (activeTab.historyIndex > 0) {
      const prevPath = activeTab.history[activeTab.historyIndex - 1]
      // Update index first then navigate (but navigateTo handles index update if we pass false for addToHistory? No, we need to manually set index)
      // Actually navigateTo logic above is a bit rigid. Let's just update state directly for back/forward.
      
      const prevIndex = activeTab.historyIndex - 1
      setTabs(prevTabs => prevTabs.map(t => t.id === activeTabId ? { ...t, historyIndex: prevIndex } : t))
      navigateTo(prevPath, false)
    }
  }

  const handleForward = () => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const nextPath = activeTab.history[activeTab.historyIndex + 1]
      const nextIndex = activeTab.historyIndex + 1
      setTabs(prevTabs => prevTabs.map(t => t.id === activeTabId ? { ...t, historyIndex: nextIndex } : t))
      navigateTo(nextPath, false)
    }
  }

  const handleNewTab = () => {
    const newId = Date.now().toString()
    const newTab: Tab = { id: newId, path: 'C:\\', history: ['C:\\'], historyIndex: 0, files: [], scrollPos: 0 }
    setTabs([...tabs, newTab])
    setActiveTabId(newId)
    navigateTo('C:\\', false, newId)
  }

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (tabs.length === 1) return // Don't close last tab
    
    const newTabs = tabs.filter(t => t.id !== id)
    setTabs(newTabs)
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id)
    }
  }

  const handleAddFavorite = async () => {
    const name = activeTab.path.split('\\').pop() || activeTab.path
    const newFavs = await window.ipcRenderer.addFavorite(activeTab.path, name)
    setFavorites(newFavs)
  }

  const handleRemoveFavorite = async (path: string) => {
    const newFavs = await window.ipcRenderer.removeFavorite(path)
    setFavorites(newFavs)
  }

  const handleItemClick = (item: any) => {
    if (item.isDirectory) {
      navigateTo(item.path)
    } else {
      window.ipcRenderer.openPath(item.path)
    }
  }


  const handleContextMenu = (e: React.MouseEvent, item: any) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      item: item,
    })
  }

  const handleMenuClose = () => {
    setContextMenu({ ...contextMenu, visible: false })
  }

  const handleMenuOpen = () => {
    if (contextMenu.item) {
      handleItemClick(contextMenu.item)
    }
    handleMenuClose()
  }

  const handleMenuDelete = async () => {
    if (contextMenu.item && confirm(`Are you sure you want to delete ${contextMenu.item.name}?`)) {
      await window.ipcRenderer.deleteFile(contextMenu.item.path)
      // Refresh current directory
      navigateTo(activeTab.path, false)
    }
    handleMenuClose()
  }

  const handleMenuRename = async () => {
    if (contextMenu.item) {
      const newName = prompt('Enter new name:', contextMenu.item.name)
      if (newName && newName !== contextMenu.item.name) {
        await window.ipcRenderer.renameFile(contextMenu.item.path, newName)
        // Refresh current directory
        navigateTo(activeTab.path, false)
      }
    }
    handleMenuClose()
  }

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, file: any) => {
    e.preventDefault()
    window.ipcRenderer.startDrag(file.path)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, targetFolder?: string) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const targetPath = targetFolder || activeTab.path

    for (const file of files) {
      const sourcePath = (file as any).path
      const fileName = (file as any).name
      
      if (sourcePath.startsWith(targetPath)) continue
      
      await window.ipcRenderer.invoke('move-file', sourcePath, targetPath + '\\' + fileName)
    }
    navigateTo(activeTab.path, false)
  }

  // Search effect
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim()) {
        try {
          const results = await window.ipcRenderer.searchFiles(searchQuery)
          setSearchResults(results)
        } catch (e) {
          console.error(e)
        }
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleMinimize = () => {
    window.ipcRenderer.minimize()
  }
  const handleMaximize = () => {
    window.ipcRenderer.maximize()
  }
  const handleClose = () => {
    window.ipcRenderer.close()
  }

  // Path Bar Logic
  const handlePathClick = () => {
    setPathInput(activeTab.path)
    setIsEditingPath(true)
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    navigateTo(pathInput)
    setIsEditingPath(false)
  }

  const handlePathBlur = () => {
    setIsEditingPath(false)
  }

  const Breadcrumbs = () => {
    const parts = activeTab.path.split(/[/\\]/).filter(Boolean)
    return (
      <div className="flex items-center h-full overflow-hidden" onClick={handlePathClick}>
        {parts.map((part, index) => {
          const fullPath = parts.slice(0, index + 1).join('\\') + (index === 0 && parts[0].includes(':') ? '\\' : '')
          return (
            <React.Fragment key={index}>
              <button 
                onClick={(e) => { e.stopPropagation(); navigateTo(fullPath) }}
                className="px-1.5 py-0.5 hover:bg-white/10 rounded text-white/80 hover:text-white transition-colors text-xs font-medium truncate max-w-[150px]"
              >
                {part}
              </button>
              {index < parts.length - 1 && <ChevronRight className="w-3 h-3 text-white/30 mx-0.5 flex-shrink-0" />}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  // Dynamic Styles based on settings
  const getAccentColor = (opacity = 1) => {
    const colors: Record<string, string> = {
      blue: `rgba(59, 130, 246, ${opacity})`,
      purple: `rgba(168, 85, 247, ${opacity})`,
      emerald: `rgba(16, 185, 129, ${opacity})`,
      rose: `rgba(244, 63, 94, ${opacity})`,
      amber: `rgba(245, 158, 11, ${opacity})`,
    }
    return colors[settings.accentColor] || colors.blue
  }

  return (
    <div 
      className={`flex flex-col h-screen text-white overflow-hidden relative shadow-2xl selection:bg-white/20 transition-all duration-200 ${isMaximized ? 'rounded-none border-0' : 'rounded-xl border border-white/10'}`}
      style={{ 
        backgroundColor: `rgba(0, 0, 0, ${settings.bgOpacity})`,
      }}
    >
      {/* Apply blur class dynamically if it's a tailwind class, otherwise inline style handled above (but tailwind classes are better for blur) */}
      <div className={`absolute inset-0 -z-10 ${settings.blurStrength} transition-all duration-300`} />

      {showSplash && <LoadingScreen message={indexingMessage} />}

      {/* Titlebar & Tabs Container */}
      <div className="h-10 flex items-end px-2 gap-2 bg-gradient-to-b from-white/5 to-transparent drag-region pt-1" onDoubleClick={handleMaximize}>
        
        {/* Window Controls Spacer (Left) */}
        <div className="w-2" />

        {/* Tabs */}
        <div className="flex-1 flex items-end gap-1 overflow-x-auto no-scrollbar h-full pl-1">
          {tabs.map(tab => (
            <div 
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`
                group relative flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer transition-all min-w-[120px] max-w-[200px] border-t border-x border-white/5 no-drag
                ${activeTabId === tab.id 
                  ? `bg-white/10 text-white shadow-[0_-1px_0_0_rgba(255,255,255,0.1)] ${settings.blurStrength} z-10 h-full` 
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 h-[calc(100%-4px)] mt-1'
                }
              `}
            >
              <Folder className={`w-3.5 h-3.5 ${activeTabId === tab.id ? '' : 'opacity-50'}`} style={{ color: activeTabId === tab.id ? getAccentColor() : undefined }} />
              <span className="truncate flex-1 font-medium">{tab.path.split('\\').pop() || 'Local Disk'}</span>
              
              <button 
                onClick={(e) => handleCloseTab(e, tab.id)}
                className="p-0.5 rounded-md transition-all opacity-0 group-hover:opacity-100 hover:bg-white/20"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button 
            onClick={handleNewTab} 
            className="mb-1.5 p-1 hover:bg-white/10 rounded-md transition-colors text-white/40 hover:text-white no-drag"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Background Indexing Indicator */}
        {!showSplash && (indexingMessage.includes('Indexed') || indexingMessage.includes('Checking')) && (
           <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-[10px] font-medium text-white/60 mr-2 no-drag select-none">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
             <span className="truncate max-w-[150px]">{indexingMessage}</span>
           </div>
        )}
        
        {/* Settings Toggle */}
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`mb-1.5 p-1.5 rounded-md transition-colors no-drag ${showSettings ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10 hover:text-white'}`}
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Spacer for Windows Controls (Right side) */}
        <div className="w-32 h-full" />
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className={`absolute top-12 right-4 z-50 w-64 bg-black/60 ${settings.blurStrength} border border-white/10 rounded-xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-2`}>
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-4">Appearance</h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/70 mb-2 flex items-center gap-2">
                <Palette className="w-3 h-3" /> Accent Color
              </label>
              <div className="flex gap-2">
                {['blue', 'purple', 'emerald', 'rose', 'amber'].map(color => (
                  <button
                    key={color}
                    onClick={() => setSettings({ ...settings, accentColor: color })}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${settings.accentColor === color ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: (({
                      blue: '#3b82f6', purple: '#a855f7', emerald: '#10b981', rose: '#f43f5e', amber: '#f59e0b'
                    } as any)[color]) }}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-white/70 mb-2 flex items-center gap-2">
                <Droplets className="w-3 h-3" /> Blur Strength
              </label>
              <select 
                value={settings.blurStrength}
                onChange={(e) => setSettings({ ...settings, blurStrength: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-white/30"
              >
                <option value="backdrop-blur-none">None</option>
                <option value="backdrop-blur-sm">Low</option>
                <option value="backdrop-blur-md">Medium</option>
                <option value="backdrop-blur-xl">High</option>
                <option value="backdrop-blur-3xl">Ultra</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-white/70 mb-2 flex items-center gap-2">
                <Eye className="w-3 h-3" /> Opacity
              </label>
              <input 
                type="range" 
                min="0.1" 
                max="0.9" 
                step="0.1" 
                value={settings.bgOpacity}
                onChange={(e) => setSettings({ ...settings, bgOpacity: parseFloat(e.target.value) })}
                className="w-full accent-white/50"
              />
            </div>

            <div className="pt-2 border-t border-white/10">
              <button 
                onClick={() => {
                  if (confirm('Are you sure you want to rebuild the index? This may take a while.')) {
                    window.ipcRenderer.rebuildIndex();
                    setShowSettings(false);
                  }
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-xs text-white/70 hover:text-white transition-all"
              >
                <RefreshCw className="w-3 h-3" /> Rebuild Index
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white/[0.02] relative overflow-hidden">
        
        {/* Toolbar */}
        <div className="h-12 flex items-center gap-3 px-4 border-b border-white/5 bg-white/[0.02]">
           <div className="flex items-center gap-1">
             <button onClick={handleBack} disabled={activeTab.historyIndex <= 0} className="p-1.5 hover:bg-white/10 rounded-md disabled:opacity-30 transition-colors">
               <ArrowLeft className="w-4 h-4" />
             </button>
             <button onClick={handleForward} disabled={activeTab.historyIndex >= activeTab.history.length - 1} className="p-1.5 hover:bg-white/10 rounded-md disabled:opacity-30 transition-colors">
               <ArrowRight className="w-4 h-4" />
             </button>
           </div>

           {/* Breadcrumbs / Path Bar */}
           <div 
             className={`flex-1 flex items-center gap-2 px-3 py-1.5 bg-black/20 rounded-md border border-white/5 text-sm shadow-inner group transition-all ${isEditingPath ? 'ring-2 ring-white/20' : 'hover:bg-black/30'}`}
           >
             <Folder className="w-4 h-4" style={{ color: getAccentColor(0.8) }} />
             
             <div className="flex-1 min-w-0 h-6 relative">
               {isEditingPath ? (
                 <form onSubmit={handlePathSubmit} className="w-full h-full">
                   <input
                     ref={pathInputRef}
                     type="text"
                     value={pathInput}
                     onChange={(e) => setPathInput(e.target.value)}
                     onBlur={handlePathBlur}
                     className="w-full h-full bg-transparent border-none outline-none text-white text-sm font-mono"
                   />
                 </form>
               ) : (
                 <Breadcrumbs />
               )}
             </div>

             <button onClick={handleAddFavorite} className="p-1 hover:bg-white/10 rounded text-white/20 hover:text-yellow-400 transition-colors">
               <Star className="w-3.5 h-3.5" />
             </button>
           </div>

           {/* Search Bar */}
           <div className="relative w-64 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-white/30 group-focus-within:text-white transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-9 pr-3 py-1.5 bg-black/20 border border-white/5 rounded-md text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-black/40 transition-all"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* View & Sort Controls */}
          <div className="flex items-center gap-1 ml-2 border-l border-white/10 pl-3">
             <div className="flex bg-black/20 rounded-lg p-0.5 border border-white/5">
               <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`} title="Grid View">
                 <LayoutGrid className="w-3.5 h-3.5" />
               </button>
               <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`} title="List View">
                 <List className="w-3.5 h-3.5" />
               </button>
               <button onClick={() => setViewMode('details')} className={`p-1.5 rounded-md transition-all ${viewMode === 'details' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`} title="Details View">
                 <AlignJustify className="w-3.5 h-3.5" />
               </button>
             </div>

             <div className="flex bg-black/20 rounded-lg p-0.5 border border-white/5 ml-2">
               <button onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/5 transition-all" title="Toggle Sort Order">
                 {sortOrder === 'asc' ? <ArrowDownAZ className="w-3.5 h-3.5" /> : <ArrowUpAZ className="w-3.5 h-3.5" />}
               </button>
               <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="bg-transparent text-xs text-white/70 focus:outline-none cursor-pointer hover:text-white px-1"
               >
                 <option value="name" className="bg-gray-900">Name</option>
                 <option value="date" className="bg-gray-900">Date</option>
                 <option value="size" className="bg-gray-900">Size</option>
                 <option value="type" className="bg-gray-900">Type</option>
               </select>
             </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className={`w-56 flex flex-col gap-6 bg-white/[0.01] p-3 border-r border-white/5 ${settings.blurStrength}`}>
            
            <div>
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 px-2">Favorites</div>
              <div className="space-y-0.5">
                {favorites.map((item) => (
                  <button 
                    key={item.path}
                    onClick={() => navigateTo(item.path)}
                    className="w-full flex items-center gap-3 px-3 py-1.5 text-left text-sm rounded-md hover:bg-white/5 text-white/70 hover:text-white transition-all group"
                  >
                    <Star className="w-3.5 h-3.5 text-yellow-400/50 group-hover:text-yellow-400 transition-colors" />
                    <span className="truncate flex-1">{item.name}</span>
                    <div 
                      onClick={(e) => { e.stopPropagation(); handleRemoveFavorite(item.path); }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded"
                    >
                      <X className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 px-2">Locations</div>
              <div className="space-y-0.5">
                {drives.map((item) => (
                  <button 
                    key={item.path} 
                    onClick={() => navigateTo(item.path)}
                    className="w-full flex items-center gap-3 px-3 py-1.5 rounded-md hover:bg-white/5 text-left text-sm text-white/70 hover:text-white transition-all"
                  >
                    <HardDrive className="w-3.5 h-3.5" style={{ color: getAccentColor(0.6) }} />
                    {item.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* File List */}
          <div 
            className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-white/[0.02] to-transparent"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e)}
          >
             <div className="flex-1 overflow-y-auto p-4">
                {searchQuery ? (
                  // Search Results
                  searchResults.length > 0 ? (
                    <div className="grid grid-cols-1 gap-1">
                      {searchResults.map((file, i) => (
                        <div 
                          key={i} 
                          onClick={() => window.ipcRenderer.openPath(file.path)}
                          className="flex items-center gap-4 p-3 hover:bg-white/5 rounded-xl cursor-pointer transition-all group border border-transparent hover:border-white/5"
                        >
                          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <File className="w-5 h-5" style={{ color: getAccentColor() }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-white/90 truncate">{file.name}</div>
                            <div className="text-xs text-white/40 truncate">{file.path}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white/30 gap-4">
                      <Search className="w-12 h-12 opacity-20" />
                      <p>No results found</p>
                    </div>
                  )
                ) : (
                  // File Browser
                  sortedFiles.length > 0 ? (
                    <div className={`
                      ${viewMode === 'grid' ? 'grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-4' : ''}
                      ${viewMode === 'list' ? 'flex flex-col gap-1' : ''}
                      ${viewMode === 'details' ? 'flex flex-col gap-0' : ''}
                    `}>
                      {viewMode === 'details' && (
                        <div className={`flex items-center px-4 py-2 text-xs font-medium text-white/30 border-b border-white/5 mb-2 sticky top-0 bg-black/40 ${settings.blurStrength} z-10`}>
                          <div className="flex-1 cursor-pointer hover:text-white" onClick={() => setSortBy('name')}>Name</div>
                          <div className="w-32 text-right cursor-pointer hover:text-white" onClick={() => setSortBy('date')}>Date Modified</div>
                          <div className="w-24 text-right cursor-pointer hover:text-white" onClick={() => setSortBy('type')}>Type</div>
                          <div className="w-24 text-right cursor-pointer hover:text-white" onClick={() => setSortBy('size')}>Size</div>
                        </div>
                      )}

                      {sortedFiles.map((file: any, i: number) => (
                        <div 
                          key={i} 
                          draggable
                          onDragStart={(e) => handleDragStart(e, file)}
                          onClick={() => handleItemClick(file)}
                          onContextMenu={(e) => handleContextMenu(e, file)}
                          onDragOver={(e) => {
                            if (file.isDirectory) {
                              e.preventDefault()
                              e.currentTarget.classList.add('ring-2', 'ring-white/20', 'bg-white/5')
                            }
                          }}
                          onDragLeave={(e) => {
                            if (file.isDirectory) {
                              e.currentTarget.classList.remove('ring-2', 'ring-white/20', 'bg-white/5')
                            }
                          }}
                          onDrop={(e) => {
                            if (file.isDirectory) {
                              e.preventDefault()
                              e.stopPropagation()
                              e.currentTarget.classList.remove('ring-2', 'ring-white/20', 'bg-white/5')
                              handleDrop(e, file.path)
                            }
                          }}
                          className={`
                            group cursor-pointer transition-all border border-transparent
                            ${viewMode === 'grid' ? 'flex flex-col items-center gap-2 p-3 hover:bg-white/10 rounded-xl hover:border-white/5 hover:shadow-lg text-center' : ''}
                            ${viewMode === 'list' ? 'flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg' : ''}
                            ${viewMode === 'details' ? 'flex items-center gap-4 px-4 py-2 hover:bg-white/5 border-b border-white/[0.02] text-sm' : ''}
                          `}
                        >
                          {/* Icon */}
                          <div className={`
                            flex items-center justify-center transition-transform duration-200
                            ${viewMode === 'grid' ? 'w-14 h-14 group-hover:scale-110' : 'w-5 h-5'}
                          `}>
                            {file.isDirectory ? (
                              <Folder 
                                className={`
                                  ${viewMode === 'grid' ? 'w-12 h-12 drop-shadow-lg' : 'w-5 h-5'} 
                                `} 
                                style={{ color: getAccentColor(0.8) }}
                                fill="currentColor" 
                                fillOpacity={0.2} 
                              />
                            ) : (
                              <File 
                                className={`
                                  ${viewMode === 'grid' ? 'w-10 h-10' : 'w-4 h-4'} 
                                  text-white/40 group-hover:text-white/60
                                `} 
                              />
                            )}
                          </div>

                          {/* Content */}
                          {viewMode === 'grid' ? (
                            <div className="w-full">
                              <div className="text-xs font-medium text-white/80 truncate px-1">{file.name}</div>
                              <div className="text-[10px] text-white/30 mt-0.5">
                                {file.isDirectory ? '' : `${(file.size / 1024).toFixed(0)} KB`}
                              </div>
                            </div>
                          ) : viewMode === 'list' ? (
                            <div className="flex-1 min-w-0">
                               <div className="text-sm text-white/90 truncate">{file.name}</div>
                            </div>
                          ) : (
                            // Details View
                            <>
                              <div className="flex-1 min-w-0 truncate text-white/90">{file.name}</div>
                              <div className="w-32 text-right text-white/40 text-xs">{new Date(file.mtime).toLocaleDateString()}</div>
                              <div className="w-24 text-right text-white/40 text-xs">{file.isDirectory ? 'Folder' : file.name.split('.').pop()?.toUpperCase() || 'FILE'}</div>
                              <div className="w-24 text-right text-white/40 text-xs">{file.isDirectory ? '-' : `${(file.size / 1024).toFixed(0)} KB`}</div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-white/30 gap-4">
                      <Folder className="w-12 h-12 opacity-20" />
                      <p>Empty folder</p>
                    </div>
                  )
                )}
             </div>
          </div>
        </div>
      </div>
      
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={handleMenuClose}
        onOpen={handleMenuOpen}
        onDelete={handleMenuDelete}
        onRename={handleMenuRename}
      />
    </div>
  )
}

export default App
