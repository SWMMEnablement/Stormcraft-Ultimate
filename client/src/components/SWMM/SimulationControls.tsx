import React from 'react';

interface SimulationControlsProps {
  currentTime: number;
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

  const rainIntensity = Math.max(0, Math.exp(-Math.abs(currentTime - 6) * 0.3));
  const rainBars = Math.round(rainIntensity * 8);

  return (
    <div className="bg-black/80 border-2 border-gray-600 p-2 flex flex-col gap-1.5" style={{ imageRendering: 'pixelated' }} data-testid="sim-controls">
      <div className="flex items-center gap-2">
        <div
          className="bg-black border border-gray-500 text-green-400 text-center px-2 py-1 flex-1"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '14px' }}
        >
          {formatTime(currentTime)}
        </div>
        <div className="flex flex-col items-center">
          <div className="text-[7px] text-gray-400 uppercase" style={{ fontFamily: '"Press Start 2P", monospace' }}>
            Rain
          </div>
          <div className="flex gap-px">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-3 ${i < rainBars ? 'bg-blue-400' : 'bg-gray-700'}`}
              />
            ))}
          </div>
        </div>
      </div>

      <input
        type="range"
        min="0"
        max="24"
        step="0.1"
        value={currentTime}
        onChange={(e) => onTimeChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-800 appearance-none border border-gray-600 cursor-pointer"
        data-testid="input-time-slider"
        style={{ imageRendering: 'pixelated' }}
      />

      <div className="flex gap-1">
        <button
          onClick={() => onTimeChange(0)}
          className="mc-btn-sm flex-1"
          data-testid="button-reset-sim"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px' }}
        >
          RESET
        </button>
        <button
          onClick={onPlayPause}
          className={`mc-btn-sm flex-1 ${isPlaying ? 'bg-red-700 border-red-500' : 'bg-green-700 border-green-500'}`}
          data-testid="button-play-pause"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px' }}
        >
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>
        <button
          onClick={() => onSpeedChange(simSpeed === 1 ? 5 : 1)}
          className={`mc-btn-sm flex-1 ${simSpeed > 1 ? 'bg-yellow-700 border-yellow-500 text-yellow-200' : ''}`}
          data-testid="button-speed"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '8px' }}
        >
          {simSpeed > 1 ? 'x5' : 'x1'}
        </button>
      </div>

      <div className="flex items-center justify-between text-[7px]" style={{ fontFamily: '"Press Start 2P", monospace' }}>
        <span className={isPlaying ? 'text-green-400' : 'text-gray-500'}>
          {isPlaying ? 'SIMULATING' : 'READY'}
        </span>
        <span className="text-blue-300">
          {(rainIntensity * 10).toFixed(1)}mm/hr
        </span>
      </div>
    </div>
  );
}
