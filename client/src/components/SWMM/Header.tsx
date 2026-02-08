import React from 'react';

interface HeaderProps {
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onAutoLayout: () => void;
  onExport: () => void;
  onProfile: () => void;
  toggleTheme: () => void;
  projectManagerSlot?: React.ReactNode;
  importSlot?: React.ReactNode;
}

export function Header({ onUndo, onRedo, onCopy, onPaste, onAutoLayout, onExport, onProfile, toggleTheme, projectManagerSlot, importSlot }: HeaderProps) {
  return (
    <header className="h-10 bg-black/90 border-b-2 border-gray-700 px-3 flex items-center justify-between text-white shrink-0 z-20" data-testid="header">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1" style={{ fontFamily: '"Press Start 2P", monospace' }}>
          <span className="text-green-400 text-sm tracking-wide">SWMM</span>
          <span className="text-blue-400 text-sm tracking-wide">CRAFT</span>
          <span className="text-yellow-400 text-[7px] ml-1 opacity-80">ULTIMATE</span>
        </div>
        <div className="w-px h-5 bg-gray-600" />
        <div className="flex items-center gap-1">
          {projectManagerSlot}
          {importSlot}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={onUndo} className="mc-btn-sm" data-testid="button-undo">UNDO</button>
        <button onClick={onRedo} className="mc-btn-sm" data-testid="button-redo">REDO</button>
        <div className="w-px h-4 bg-gray-600" />
        <button onClick={onCopy} className="mc-btn-sm" data-testid="button-copy">COPY</button>
        <button onClick={onPaste} className="mc-btn-sm" data-testid="button-paste">PASTE</button>
        <div className="w-px h-4 bg-gray-600" />
        <button onClick={onAutoLayout} className="mc-btn-sm" data-testid="button-layout">LAYOUT</button>
        <button onClick={onProfile} className="mc-btn-sm" data-testid="button-profile">PROFILE</button>
        <button onClick={onExport} className="mc-btn-sm mc-btn-primary-sm" data-testid="button-export">EXPORT</button>
        <div className="w-px h-4 bg-gray-600" />
        <button onClick={toggleTheme} className="mc-btn-sm" data-testid="button-theme">DAY/NIGHT</button>
      </div>
    </header>
  );
}
