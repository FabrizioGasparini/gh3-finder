import React, { useEffect, useRef } from 'react';
import { Trash2, Edit2, FolderOpen, Copy, Clipboard } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  onOpen: () => void;
  onDelete: () => void;
  onRename: () => void;
  onCopyPath: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, visible, onClose, onOpen, onDelete, onRename, onCopyPath }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-48 bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl py-1 text-sm text-white/90 animate-in fade-in zoom-in-95 duration-100"
      style={{ top: y, left: x }}
    >
      <button onClick={onOpen} className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 transition-colors">
        <FolderOpen className="w-4 h-4 text-blue-400" />
        Open
      </button>
      <div className="h-px bg-white/10 my-1" />
      <button onClick={onCopyPath} className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 transition-colors">
        <Clipboard className="w-4 h-4 text-white/60" />
        Copy Path
      </button>
      <button onClick={onRename} className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 transition-colors">
        <Edit2 className="w-4 h-4 text-white/60" />
        Rename
      </button>
      <button className="w-full px-3 py-2 text-left hover:bg-white/10 flex items-center gap-2 transition-colors opacity-50 cursor-not-allowed">
        <Copy className="w-4 h-4 text-white/60" />
        Copy File
      </button>
      <div className="h-px bg-white/10 my-1" />
      <button onClick={onDelete} className="w-full px-3 py-2 text-left hover:bg-red-500/20 text-red-400 flex items-center gap-2 transition-colors">
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
};
