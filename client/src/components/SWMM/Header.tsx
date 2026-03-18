import React, { useState } from 'react';

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
  demoPickerSlot?: React.ReactNode;
}

export function Header({ onUndo, onRedo, onCopy, onPaste, onAutoLayout, onExport, onProfile, toggleTheme, projectManagerSlot, importSlot, demoPickerSlot }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="h-10 px-3 flex items-center justify-between text-white shrink-0 z-20 relative"
      style={{
        background: 'rgba(0,0,0,0.9)',
        borderBottom: '2px solid #555',
        imageRendering: 'pixelated',
      }}
      data-testid="header"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex items-center gap-1 shrink-0" style={{ fontFamily: '"Press Start 2P", monospace' }} title="SWMMCraft Ultimate — Storm Water Management Simulator">
          <span style={{ color: '#55FF55', fontSize: '12px', letterSpacing: '2px' }}>SWMM</span>
          <span style={{ color: '#5555FF', fontSize: '12px', letterSpacing: '2px' }}>CRAFT</span>
          <span className="hidden sm:inline" style={{ color: '#FFFF55', fontSize: '7px', marginLeft: 4, opacity: 0.8 }}>ULTIMATE</span>
        </div>
        <div className="hidden md:flex items-center gap-1" style={{ borderLeft: '1px solid #555', paddingLeft: 8 }}>
          {projectManagerSlot}
          {demoPickerSlot}
          {importSlot}
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-1">
        <button onClick={onUndo} className="mc-btn-sm" data-testid="button-undo" title="Undo last action (Ctrl+Z)">UNDO</button>
        <button onClick={onRedo} className="mc-btn-sm" data-testid="button-redo" title="Redo last undone action (Ctrl+Y)">REDO</button>
        <div style={{ width: 1, height: 16, background: '#555' }} />
        <button onClick={onCopy} className="mc-btn-sm" data-testid="button-copy" title="Copy selected element (Ctrl+C)">COPY</button>
        <button onClick={onPaste} className="mc-btn-sm" data-testid="button-paste" title="Paste copied element (Ctrl+V)">PASTE</button>
        <div style={{ width: 1, height: 16, background: '#555' }} />
        <button onClick={onAutoLayout} className="mc-btn-sm" data-testid="button-layout" title="Auto-arrange nodes for a cleaner layout">LAYOUT</button>
        <button onClick={onProfile} className="mc-btn-sm" data-testid="button-profile" title="Toggle profile view — shows pipe elevations and water levels in cross-section">PROFILE</button>
        <button onClick={onExport} className="mc-btn-sm mc-btn-primary-sm" data-testid="button-export" title="Export your model as a standard SWMM .inp file">EXPORT</button>
        <div style={{ width: 1, height: 16, background: '#555' }} />
        <button onClick={toggleTheme} className="mc-btn-sm" data-testid="button-theme" title="Switch between light and dark theme">DAY/NIGHT</button>
      </div>

      <button
        className="lg:hidden mc-btn-sm"
        onClick={() => setMenuOpen(!menuOpen)}
        data-testid="button-mobile-menu"
        title="Menu"
        style={{ fontSize: 14, padding: '6px 10px', lineHeight: 1, minHeight: 44, minWidth: 44 }}
      >
        {menuOpen ? '\u2715' : '\u2630'}
      </button>

      {menuOpen && (
        <div
          className="lg:hidden absolute top-10 right-0 z-50 flex flex-col gap-1 p-3"
          style={{
            background: 'rgba(0,0,0,0.95)',
            border: '2px solid #555',
            borderTop: 'none',
            minWidth: 180,
          }}
          data-testid="mobile-menu"
        >
          <div className="md:hidden flex flex-col gap-1 pb-2 mb-2" style={{ borderBottom: '1px solid #444' }}>
            {projectManagerSlot}
            {demoPickerSlot}
            {importSlot}
          </div>
          <button onClick={() => { onUndo(); setMenuOpen(false); }} className="mc-btn-sm w-full text-left">UNDO</button>
          <button onClick={() => { onRedo(); setMenuOpen(false); }} className="mc-btn-sm w-full text-left">REDO</button>
          <button onClick={() => { onCopy(); setMenuOpen(false); }} className="mc-btn-sm w-full text-left">COPY</button>
          <button onClick={() => { onPaste(); setMenuOpen(false); }} className="mc-btn-sm w-full text-left">PASTE</button>
          <button onClick={() => { onAutoLayout(); setMenuOpen(false); }} className="mc-btn-sm w-full text-left">LAYOUT</button>
          <button onClick={() => { onProfile(); setMenuOpen(false); }} className="mc-btn-sm w-full text-left">PROFILE</button>
          <button onClick={() => { onExport(); setMenuOpen(false); }} className="mc-btn-sm mc-btn-primary-sm w-full text-left">EXPORT</button>
          <button onClick={() => { toggleTheme(); setMenuOpen(false); }} className="mc-btn-sm w-full text-left">DAY/NIGHT</button>
        </div>
      )}
    </header>
  );
}
