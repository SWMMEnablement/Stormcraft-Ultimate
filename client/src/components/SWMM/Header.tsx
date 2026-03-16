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
  demoPickerSlot?: React.ReactNode;
}

export function Header({ onUndo, onRedo, onCopy, onPaste, onAutoLayout, onExport, onProfile, toggleTheme, projectManagerSlot, importSlot, demoPickerSlot }: HeaderProps) {
  return (
    <header
      className="h-10 px-3 flex items-center justify-between text-white shrink-0 z-20"
      style={{
        background: 'rgba(0,0,0,0.9)',
        borderBottom: '2px solid #555',
        imageRendering: 'pixelated',
      }}
      data-testid="header"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1" style={{ fontFamily: '"Press Start 2P", monospace' }}>
          <span style={{ color: '#55FF55', fontSize: '12px', letterSpacing: '2px' }}>SWMM</span>
          <span style={{ color: '#5555FF', fontSize: '12px', letterSpacing: '2px' }}>CRAFT</span>
          <span style={{ color: '#FFFF55', fontSize: '7px', marginLeft: 4, opacity: 0.8 }}>ULTIMATE</span>
        </div>
        <div style={{ width: 1, height: 20, background: '#555' }} />
        <div className="flex items-center gap-1">
          {projectManagerSlot}
          {demoPickerSlot}
          {importSlot}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={onUndo} className="mc-btn-sm" data-testid="button-undo">UNDO</button>
        <button onClick={onRedo} className="mc-btn-sm" data-testid="button-redo">REDO</button>
        <div style={{ width: 1, height: 16, background: '#555' }} />
        <button onClick={onCopy} className="mc-btn-sm" data-testid="button-copy">COPY</button>
        <button onClick={onPaste} className="mc-btn-sm" data-testid="button-paste">PASTE</button>
        <div style={{ width: 1, height: 16, background: '#555' }} />
        <button onClick={onAutoLayout} className="mc-btn-sm" data-testid="button-layout">LAYOUT</button>
        <button onClick={onProfile} className="mc-btn-sm" data-testid="button-profile">PROFILE</button>
        <button onClick={onExport} className="mc-btn-sm mc-btn-primary-sm" data-testid="button-export">EXPORT</button>
        <div style={{ width: 1, height: 16, background: '#555' }} />
        <button onClick={toggleTheme} className="mc-btn-sm" data-testid="button-theme">DAY/NIGHT</button>
      </div>
    </header>
  );
}
