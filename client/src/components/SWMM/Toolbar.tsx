import React from 'react';
import { cn } from '@/lib/utils';
import { Tool } from '@/lib/swmm-types';
import { playClick } from '@/lib/sound';

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  toggle3D: () => void;
  is3D: boolean;
}

function PixelIcon({ type }: { type: string }) {
  const size = 24;
  return (
    <canvas
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated', width: size, height: size }}
      ref={canvas => {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);

        if (type === 'select') {
          ctx.fillStyle = '#FFF';
          ctx.beginPath();
          ctx.moveTo(4, 2);
          ctx.lineTo(4, 18);
          ctx.lineTo(9, 14);
          ctx.lineTo(14, 20);
          ctx.lineTo(17, 18);
          ctx.lineTo(12, 12);
          ctx.lineTo(18, 12);
          ctx.closePath();
          ctx.fill();
        } else if (type === 'pan') {
          ctx.fillStyle = '#FFF';
          ctx.fillRect(10, 2, 4, 6);
          ctx.fillRect(4, 8, 16, 4);
          ctx.fillRect(10, 12, 4, 6);
          ctx.fillRect(2, 10, 4, 4);
          ctx.fillRect(18, 10, 4, 4);
        } else if (type === 'junction') {
          ctx.fillStyle = '#888';
          ctx.fillRect(4, 4, 16, 16);
          ctx.fillStyle = '#AAA';
          ctx.fillRect(5, 5, 14, 14);
          ctx.fillStyle = '#555';
          ctx.beginPath();
          ctx.arc(12, 12, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#777';
          ctx.fillRect(10, 8, 4, 1);
          ctx.fillRect(11, 9, 2, 6);
        } else if (type === 'outfall') {
          ctx.fillStyle = '#2E8B57';
          ctx.fillRect(4, 4, 16, 16);
          ctx.fillStyle = '#3CB371';
          ctx.fillRect(5, 5, 14, 14);
          ctx.fillStyle = '#4A90E2';
          ctx.fillRect(7, 10, 10, 4);
          ctx.fillStyle = '#FFF';
          ctx.beginPath();
          ctx.moveTo(16, 9);
          ctx.lineTo(20, 12);
          ctx.lineTo(16, 15);
          ctx.fill();
        } else if (type === 'storage') {
          ctx.fillStyle = '#B8860B';
          ctx.fillRect(4, 4, 16, 18);
          ctx.fillStyle = '#DAA520';
          ctx.fillRect(5, 5, 14, 16);
          ctx.fillStyle = '#4A90E2';
          ctx.fillRect(6, 12, 12, 8);
        } else if (type === 'conduit') {
          ctx.fillStyle = '#555';
          ctx.fillRect(2, 10, 20, 6);
          ctx.fillStyle = '#444';
          ctx.fillRect(3, 11, 18, 4);
          ctx.fillStyle = '#4A90E2';
          ctx.fillRect(4, 12, 16, 2);
          ctx.fillStyle = '#888';
          ctx.fillRect(2, 10, 2, 6);
          ctx.fillRect(10, 10, 2, 6);
          ctx.fillRect(20, 10, 2, 6);
        } else if (type === 'subcatchment') {
          ctx.fillStyle = 'rgba(46,139,87,0.6)';
          ctx.beginPath();
          ctx.moveTo(4, 18);
          ctx.lineTo(8, 4);
          ctx.lineTo(18, 6);
          ctx.lineTo(20, 16);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#2E8B57';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (type === 'raingauge') {
          ctx.fillStyle = '#9C27B0';
          ctx.fillRect(6, 4, 12, 16);
          ctx.fillStyle = '#BA68C8';
          ctx.fillRect(7, 5, 10, 14);
          ctx.fillStyle = '#4A90E2';
          ctx.fillRect(10, 6, 2, 4);
          ctx.fillRect(12, 10, 2, 4);
          ctx.fillRect(9, 14, 2, 3);
        } else if (type === 'delete') {
          ctx.fillStyle = '#E74C3C';
          ctx.fillRect(6, 6, 12, 14);
          ctx.fillStyle = '#C0392B';
          ctx.fillRect(4, 4, 16, 4);
          ctx.fillRect(10, 2, 4, 3);
          ctx.fillStyle = '#FFF';
          ctx.fillRect(8, 9, 2, 8);
          ctx.fillRect(11, 9, 2, 8);
          ctx.fillRect(14, 9, 2, 8);
        } else if (type === '3d') {
          ctx.fillStyle = '#9B59B6';
          ctx.fillRect(4, 8, 12, 12);
          ctx.fillStyle = '#8E44AD';
          ctx.fillRect(16, 4, 4, 12);
          ctx.beginPath();
          ctx.moveTo(4, 8);
          ctx.lineTo(8, 4);
          ctx.lineTo(20, 4);
          ctx.lineTo(16, 8);
          ctx.closePath();
          ctx.fillStyle = '#A569BD';
          ctx.fill();
        }
      }}
    />
  );
}

const tools: { id: Tool; label: string; slot: string; tip: string }[] = [
  { id: 'select', label: 'Select', slot: '1', tip: 'Select & inspect elements — click nodes or pipes to view properties' },
  { id: 'pan', label: 'Pan', slot: '2', tip: 'Pan the map — click and drag to move around' },
  { id: 'junction', label: 'Junction', slot: '3', tip: 'Place a junction node — where pipes connect and water is collected' },
  { id: 'outfall', label: 'Outfall', slot: '4', tip: 'Place an outfall — the discharge point where water exits your network' },
  { id: 'storage', label: 'Storage', slot: '5', tip: 'Place a storage unit — holds water to reduce peak flows downstream' },
  { id: 'conduit', label: 'Conduit', slot: '6', tip: 'Draw a conduit (pipe) — click two nodes to connect them' },
  { id: 'subcatchment', label: 'Subcatch', slot: '7', tip: 'Draw a subcatchment area — defines a drainage zone that generates runoff' },
  { id: 'raingauge', label: 'Rain', slot: '8', tip: 'Place a rain gauge — measures rainfall for nearby subcatchments' },
  { id: 'delete', label: 'Delete', slot: '9', tip: 'Delete mode — click any element to remove it from the network' },
];

export function Toolbar({ activeTool, onToolChange, toggle3D, is3D }: ToolbarProps) {
  const handleToolClick = (toolId: Tool) => {
    playClick();
    onToolChange(toolId);
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-30 pointer-events-none" data-testid="toolbar-hotbar">
      <div
        className="flex items-end gap-0.5 sm:gap-1 pointer-events-auto overflow-x-auto toolbar-scroll"
        style={{
          padding: '4px 6px',
          background: 'rgba(0,0,0,0.75)',
          border: '2px solid #aaa',
          borderBottom: 'none',
        }}
      >
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              data-testid={`button-tool-${tool.id}`}
              onClick={() => handleToolClick(tool.id)}
              className="flex flex-col items-center justify-center relative shrink-0"
              style={{
                width: 'clamp(44px, 8vw, 52px)',
                height: 'clamp(44px, 8vw, 52px)',
                background: isActive ? '#555' : '#2a2a2a',
                border: isActive ? '2px solid #fff' : '2px solid #555',
                cursor: 'pointer',
                imageRendering: 'pixelated',
                boxShadow: isActive
                  ? 'inset 1px 1px 0 #888, inset -1px -1px 0 #000, 0 0 0 2px #fff'
                  : 'inset 1px 1px 0 #555, inset -1px -1px 0 #000',
                transition: 'background 0.1s, border-color 0.1s',
                transform: isActive ? 'translateY(-4px)' : 'none',
              }}
              title={`${tool.tip} (${tool.slot})`}
            >
              <PixelIcon type={tool.id} />
              <span
                className="absolute hidden sm:block"
                style={{
                  top: 2,
                  left: 4,
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: '7px',
                  color: isActive ? '#FFFF55' : '#aaa',
                  textShadow: '1px 1px #000',
                }}
              >
                {tool.slot}
              </span>
              {isActive && (
                <span
                  className="absolute whitespace-nowrap hidden sm:block"
                  style={{
                    bottom: -14,
                    fontFamily: '"Press Start 2P", monospace',
                    fontSize: '7px',
                    color: '#fff',
                    textShadow: '1px 1px 0 #000',
                  }}
                >
                  {tool.label}
                </span>
              )}
            </button>
          );
        })}
        <div style={{ width: 4 }} className="shrink-0" />
        <button
          data-testid="button-toggle-3d"
          onClick={() => { playClick(); toggle3D(); }}
          className="flex items-center justify-center shrink-0"
          style={{
            width: 'clamp(44px, 8vw, 52px)',
            height: 'clamp(44px, 8vw, 52px)',
            background: is3D ? '#5c2d8c' : '#2a2a2a',
            border: is3D ? '2px solid #a569bd' : '2px solid #555',
            cursor: 'pointer',
            imageRendering: 'pixelated',
            boxShadow: is3D
              ? 'inset 1px 1px 0 #a569bd, inset -1px -1px 0 #000, 0 0 0 2px #a569bd'
              : 'inset 1px 1px 0 #555, inset -1px -1px 0 #000',
            transform: is3D ? 'translateY(-4px)' : 'none',
            transition: 'background 0.1s',
          }}
          title={is3D ? "Switch back to 2D map view (Tab)" : "Switch to 3D Minecraft-style view — orbit with mouse, zoom with scroll (Tab)"}
        >
          <PixelIcon type="3d" />
        </button>
      </div>
    </div>
  );
}
