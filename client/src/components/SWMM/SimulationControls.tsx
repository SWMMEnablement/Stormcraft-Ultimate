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
  const rainPct = Math.round(rainIntensity * 100);
  const rainBars = Math.round(rainIntensity * 8);

  return (
    <div
      className="border-2 p-2 flex flex-col gap-1.5"
      style={{
        imageRendering: 'pixelated',
        background: 'rgba(0,0,0,0.85)',
        borderColor: '#555',
        minWidth: 200,
      }}
      data-testid="sim-controls"
      title="Simulation Controls — Run a 24-hour storm event and watch water flow through your network"
    >
      <div
        className="text-center px-2 py-1"
        style={{
          background: '#000',
          border: '2px inset #555',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '18px',
          color: '#55FF55',
          textShadow: '0 0 8px #00ff00',
          letterSpacing: '4px',
        }}
        title={`Simulation time: ${formatTime(currentTime)} (hour ${Math.floor(currentTime)} of 24)`}
      >
        {formatTime(currentTime)}
      </div>

      <div className="flex items-center gap-2" title={`Rainfall intensity: ${(rainIntensity * 10).toFixed(1)} mm/hr — peaks at hour 6`}>
        <span
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            color: '#aaa',
            textTransform: 'uppercase',
          }}
        >
          RAIN
        </span>
        <div
          className="flex-1 relative"
          style={{
            height: 8,
            background: '#333',
            border: '1px solid #666',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${rainPct}%`,
              background: '#4488ff',
              transition: 'width 0.3s',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -2,
              left: `${rainPct}%`,
              transform: 'translateX(-4px)',
              width: 8,
              height: 8,
              background: '#ff3333',
              borderRadius: '50%',
              border: '1px solid #cc0000',
              transition: 'left 0.3s',
            }}
          />
        </div>
        <span
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            color: '#4488ff',
          }}
        >
          {(rainIntensity * 10).toFixed(1)}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max="24"
        step="0.1"
        value={currentTime}
        onChange={(e) => onTimeChange(parseFloat(e.target.value))}
        className="w-full h-2 appearance-none cursor-pointer"
        data-testid="input-time-slider"
        title={`Drag to scrub through the 24-hour simulation — currently at ${formatTime(currentTime)}`}
        style={{
          imageRendering: 'pixelated',
          background: '#333',
          border: '1px solid #555',
        }}
      />

      <div className="flex gap-1">
        <button
          onClick={() => onTimeChange(0)}
          className="mc-btn-sm flex-1"
          data-testid="button-reset-sim"
          title="Reset simulation back to hour 0"
        >
          RESET
        </button>
        <button
          onClick={onPlayPause}
          className="mc-btn-sm flex-1"
          data-testid="button-play-pause"
          title={isPlaying ? 'Pause the simulation' : 'Start simulating the storm event'}
          style={{
            backgroundColor: isPlaying ? '#7a1a1a' : '#1a5c1a',
            ...(isPlaying
              ? { boxShadow: 'inset -1px -2px 0px 0px #550000, inset 1px 1px 0px 0px #cc4444' }
              : { boxShadow: 'inset -1px -2px 0px 0px #003300, inset 1px 1px 0px 0px #44cc44' }
            ),
          }}
        >
          {isPlaying ? 'PAUSE' : 'PLAY'}
        </button>
        <button
          onClick={() => onSpeedChange(simSpeed === 1 ? 5 : 1)}
          className="mc-btn-sm flex-1"
          data-testid="button-speed"
          title={simSpeed > 1 ? 'Switch to normal speed (1x)' : 'Speed up simulation to 5x'}
          style={simSpeed > 1 ? {
            backgroundColor: '#6b5c00',
            color: '#FFFF55',
            boxShadow: 'inset -1px -2px 0px 0px #4a3d00, inset 1px 1px 0px 0px #ccbb44',
          } : {}}
        >
          {simSpeed > 1 ? 'x5' : 'x1'}
        </button>
      </div>

      <div className="flex items-center justify-between" style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px' }}>
        <span style={{ color: isPlaying ? '#55FF55' : '#666' }} title={isPlaying ? 'Simulation is running' : 'Click PLAY to start the simulation'}>
          {isPlaying ? 'SIMULATING' : 'READY'}
        </span>
        <span style={{ color: '#4488ff' }} title="Current rainfall rate in millimeters per hour">
          {(rainIntensity * 10).toFixed(1)}mm/hr
        </span>
      </div>
    </div>
  );
}
