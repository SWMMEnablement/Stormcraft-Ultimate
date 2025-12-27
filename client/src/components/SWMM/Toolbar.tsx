import React from 'react';
import { cn } from '@/lib/utils';
import { Tool } from '@/lib/swmm-types';
import { playClick } from '@/lib/sound';
import { MousePointer2, Hand, Box, DoorOpen, Archive, ArrowRight, CloudRain, CloudLightning, Trash2, ZoomIn, ZoomOut, BoxSelect } from 'lucide-react';

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  toggle3D: () => void;
  is3D: boolean;
}

export function Toolbar({ activeTool, onToolChange, onZoomIn, onZoomOut, toggle3D, is3D }: ToolbarProps) {
  const tools: { id: Tool; icon: React.ReactNode; label: string; shortcut: string }[] = [
    { id: 'select', icon: <MousePointer2 className="h-5 w-5" />, label: 'Select', shortcut: 'V' },
    { id: 'pan', icon: <Hand className="h-5 w-5" />, label: 'Pan', shortcut: 'H' },
    { id: 'junction', icon: <Box className="h-5 w-5" />, label: 'Junction', shortcut: 'J' },
    { id: 'outfall', icon: <DoorOpen className="h-5 w-5" />, label: 'Outfall', shortcut: 'O' },
    { id: 'storage', icon: <Archive className="h-5 w-5" />, label: 'Storage', shortcut: 'S' },
    { id: 'conduit', icon: <ArrowRight className="h-5 w-5" />, label: 'Conduit', shortcut: 'C' },
    { id: 'subcatchment', icon: <CloudRain className="h-5 w-5" />, label: 'Subcatch', shortcut: 'A' },
    { id: 'raingauge', icon: <CloudLightning className="h-5 w-5" />, label: 'Rain Gauge', shortcut: 'R' },
    { id: 'delete', icon: <Trash2 className="h-5 w-5" />, label: 'Delete', shortcut: 'Del' },
  ];

  const handleToolClick = (toolId: Tool) => {
    playClick();
    onToolChange(toolId);
  };

  return (
    <div className="w-14 bg-gray-800 border-r-4 border-black flex flex-col p-2 gap-2 shadow-xl z-10">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => handleToolClick(tool.id)}
          className={cn(
            "w-10 h-10 flex items-center justify-center border-2 transition-all relative group",
            activeTool === tool.id
              ? "bg-green-600 border-white border-b-green-800 border-r-green-800 translate-y-[1px]"
              : "bg-gray-600 border-gray-400 border-b-gray-800 border-r-gray-800 hover:bg-gray-500"
          )}
          title={`${tool.label} (${tool.shortcut})`}
        >
          {tool.icon}
          <div className="absolute left-full ml-2 bg-black text-white text-[10px] p-1 px-2 border border-white whitespace-nowrap hidden group-hover:block z-50 font-sans">
            {tool.label} ({tool.shortcut})
          </div>
        </button>
      ))}
      
      <div className="flex-1" />
      
      <div className="flex flex-col gap-2 border-t-2 border-gray-600 pt-2">
        <button onClick={() => { playClick(); onZoomIn(); }} className="w-10 h-10 bg-gray-600 border-2 border-gray-400 border-b-gray-800 border-r-gray-800 flex items-center justify-center hover:bg-gray-500">
          <ZoomIn className="h-5 w-5" />
        </button>
        <button onClick={() => { playClick(); onZoomOut(); }} className="w-10 h-10 bg-gray-600 border-2 border-gray-400 border-b-gray-800 border-r-gray-800 flex items-center justify-center hover:bg-gray-500">
          <ZoomOut className="h-5 w-5" />
        </button>
         <button 
           onClick={() => { playClick(); toggle3D(); }} 
           className={cn(
             "w-10 h-10 border-2 flex items-center justify-center hover:bg-gray-500 transition-all",
              is3D 
              ? "bg-purple-600 border-white border-b-purple-800 border-r-purple-800"
              : "bg-gray-600 border-gray-400 border-b-gray-800 border-r-gray-800"
           )}
           title="Toggle 3D View"
         >
          <BoxSelect className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
