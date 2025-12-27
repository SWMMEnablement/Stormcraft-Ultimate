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
}

export function Header({ onUndo, onRedo, onCopy, onPaste, onAutoLayout, onExport, onProfile, toggleTheme }: HeaderProps) {
  return (
    <header className="h-14 bg-gradient-to-b from-gray-800 to-black border-b-4 border-black px-4 flex items-center justify-between text-white shrink-0">
      <div className="flex items-center gap-2">
        <div className="font-minecraft text-lg text-green-500 drop-shadow-md">
          SWMM<span className="text-blue-500">CRAFT</span> <small className="text-yellow-400 text-[10px]">ULTIMATE</small>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button onClick={onUndo} className="mc-btn">↶ UNDO</button>
        <button onClick={onRedo} className="mc-btn">↷ REDO</button>
        <div className="w-[2px] h-6 bg-gray-600 mx-1"></div>
        <button onClick={onCopy} className="mc-btn">📋 COPY</button>
        <button onClick={onPaste} className="mc-btn">📄 PASTE</button>
        <div className="w-[2px] h-6 bg-gray-600 mx-1"></div>
        <button onClick={onAutoLayout} className="mc-btn">🔀 LAYOUT</button>
        <button onClick={onProfile} className="mc-btn">📈 PROFILE</button>
        <button onClick={onExport} className="mc-btn">💾 EXPORT</button>
        <div className="w-[2px] h-6 bg-gray-600 mx-1"></div>
        <button onClick={toggleTheme} className="mc-btn">🌙</button>
      </div>
    </header>
  );
}
