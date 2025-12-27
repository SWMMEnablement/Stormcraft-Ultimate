import React from 'react';
import { Node, Link, Subcatchment } from '@/lib/swmm-types';

interface PropertiesPanelProps {
  selectedElement: Node | Link | Subcatchment | null;
  onUpdate: (id: string, updates: any) => void;
}

export function PropertiesPanel({ selectedElement, onUpdate }: PropertiesPanelProps) {
  if (!selectedElement) {
    return (
      <div className="mc-panel p-4 h-full">
        <div className="font-minecraft text-xs text-gray-600 text-center mt-10">
          Select an element to view properties
        </div>
      </div>
    );
  }

  const handleChange = (key: string, value: string | number) => {
    // Basic type conversion
    const numValue = parseFloat(value as string);
    const finalValue = isNaN(numValue) ? value : numValue;
    onUpdate(selectedElement.id, { [key]: finalValue });
  };

  return (
    <div className="mc-panel p-3 h-full overflow-y-auto">
      <h3 className="font-minecraft text-xs border-b-2 border-gray-400 pb-2 mb-4 uppercase">
        {selectedElement.type ? selectedElement.type : 'Properties'}
      </h3>

      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="font-minecraft text-[10px] text-gray-600">ID</label>
          <input 
            className="mc-input text-sm"
            value={selectedElement.id}
            readOnly
          />
        </div>

        {/* Dynamic Fields based on type */}
        {'invertElev' in selectedElement && (
           <div className="flex flex-col gap-1">
            <label className="font-minecraft text-[10px] text-gray-600">Invert Elev (ft)</label>
            <input 
              className="mc-input text-sm"
              type="number"
              value={(selectedElement as Node).invertElev}
              onChange={(e) => handleChange('invertElev', e.target.value)}
            />
          </div>
        )}

        {'maxDepth' in selectedElement && (
           <div className="flex flex-col gap-1">
            <label className="font-minecraft text-[10px] text-gray-600">Max Depth (ft)</label>
            <input 
              className="mc-input text-sm"
              type="number"
              value={(selectedElement as Node).maxDepth}
              onChange={(e) => handleChange('maxDepth', e.target.value)}
            />
          </div>
        )}

        {'roughness' in selectedElement && (
           <div className="flex flex-col gap-1">
            <label className="font-minecraft text-[10px] text-gray-600">Roughness</label>
            <input 
              className="mc-input text-sm"
              type="number"
              step="0.001"
              value={(selectedElement as Link).roughness}
              onChange={(e) => handleChange('roughness', e.target.value)}
            />
          </div>
        )}
        
        {'area' in selectedElement && (
           <div className="flex flex-col gap-1">
            <label className="font-minecraft text-[10px] text-gray-600">Area (ac)</label>
            <input 
              className="mc-input text-sm"
              type="number"
              value={(selectedElement as Subcatchment).area}
              onChange={(e) => handleChange('area', e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
