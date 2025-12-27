import React from 'react';
import { Play, Pause, FastForward, SkipBack } from 'lucide-react';

interface SimulationControlsProps {
  currentTime: number; // 0-24 hours
  isPlaying: boolean;
  onPlayPause: () => void;
  onTimeChange: (time: number) => void;
  onSpeedChange: (speed: number) => void;
  simSpeed: number;
}

export function SimulationControls({ currentTime, isPlaying, onPlayPause, onTimeChange, onSpeedChange, simSpeed }: SimulationControlsProps) {
  const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mc-panel p-2 flex flex-col gap-2">
      <div className="bg-black text-green-500 font-minecraft text-center p-2 border-2 border-gray-600 border-b-white border-r-white text-xl">
        {formatTime(currentTime)}
      </div>
      
      <input
        type="range"
        min="0"
        max="24"
        step="0.1"
        value={currentTime}
        onChange={(e) => onTimeChange(parseFloat(e.target.value))}
        className="w-full h-4 bg-gray-700 appearance-none border-2 border-gray-900 cursor-pointer"
      />
      
      <div className="flex gap-2">
        <button onClick={() => onTimeChange(0)} className="mc-btn flex-1 flex justify-center"><SkipBack className="h-3 w-3" /></button>
        <button onClick={onPlayPause} className="mc-btn flex-1 flex justify-center">
          {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        </button>
        <button onClick={() => onSpeedChange(simSpeed === 1 ? 5 : 1)} className={
          `mc-btn flex-1 flex justify-center ${simSpeed > 1 ? 'bg-green-500 text-white border-green-300' : ''}`
        }>
          <FastForward className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-1">
        <div className="bg-black p-1 border border-gray-600">
           <div className="text-[8px] text-gray-400 font-minecraft uppercase">Status</div>
           <div className="text-green-500 font-sans text-lg">{isPlaying ? "RUNNING" : "PAUSED"}</div>
        </div>
        <div className="bg-black p-1 border border-gray-600">
           <div className="text-[8px] text-gray-400 font-minecraft uppercase">Rainfall</div>
           <div className="text-blue-400 font-sans text-lg">{(Math.sin(currentTime) * 10).toFixed(1)} mm</div>
        </div>
      </div>
    </div>
  );
}
