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

const tools: { id: Tool; label: string; slot: string }[] = [
  { id: 'select', label: 'Select', slot: '1' },
  { id: 'pan', label: 'Pan', slot: '2' },
  { id: 'junction', label: 'Junction', slot: '3' },
  { id: 'outfall', label: 'Outfall', slot: '4' },
  { id: 'storage', label: 'Storage', slot: '5' },
  { id: 'conduit', label: 'Conduit', slot: '6' },
  { id: 'subcatchment', label: 'Subcatch', slot: '7' },
  { id: 'raingauge', label: 'Rain', slot: '8' },
  { id: 'delete', label: 'Delete', slot: '9' },
];

export function Toolbar({ activeTool, onToolChange, toggle3D, is3D }: ToolbarProps) {
  const handleToolClick = (toolId: Tool) => {
    playClick();
    onToolChange(toolId);
  };

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 pb-2 pointer-events-none" data-testid="toolbar-hotbar">
      <div className="flex items-end gap-0 pointer-events-auto">
        {tools.map((tool) => (
          <button
            key={tool.id}
            data-testid={`button-tool-${tool.id}`}
            onClick={() => handleToolClick(tool.id)}
            className={cn(
              "w-12 h-12 flex flex-col items-center justify-center relative border-2 transition-all",
              activeTool === tool.id
                ? "bg-gray-500 border-white scale-110 z-10 shadow-lg shadow-white/20"
                : "bg-gray-700 border-gray-500 hover:bg-gray-600 hover:border-gray-400"
            )}
            style={{
              borderStyle: 'outset',
              imageRendering: 'pixelated',
            }}
            title={`${tool.label} (${tool.slot})`}
          >
            <PixelIcon type={tool.id} />
            <span
              className={cn(
                "absolute -top-0.5 -right-0.5 text-[8px] font-bold px-1 leading-none",
                activeTool === tool.id ? "text-yellow-300" : "text-gray-400"
              )}
              style={{ fontFamily: '"Press Start 2P", monospace' }}
            >
              {tool.slot}
            </span>
            {activeTool === tool.id && (
              <span
                className="absolute -bottom-4 text-[7px] text-white whitespace-nowrap"
                style={{ fontFamily: '"Press Start 2P", monospace', textShadow: '1px 1px 0 #000' }}
              >
                {tool.label}
              </span>
            )}
          </button>
        ))}
        <div className="w-1" />
        <button
          data-testid="button-toggle-3d"
          onClick={() => { playClick(); toggle3D(); }}
          className={cn(
            "w-12 h-12 flex items-center justify-center border-2 transition-all",
            is3D
              ? "bg-purple-700 border-purple-400 scale-110"
              : "bg-gray-700 border-gray-500 hover:bg-gray-600"
          )}
          style={{ borderStyle: 'outset' }}
          title="Toggle 3D (Tab)"
        >
          <PixelIcon type="3d" />
        </button>
      </div>
    </div>
  );
}
