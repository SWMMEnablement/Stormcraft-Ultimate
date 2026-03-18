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
        <div className="font-sans text-xs text-gray-600 text-center mt-10" title="Click on a junction, pipe, or subcatchment on the map to edit its properties here">
          Select an element to view properties
        </div>
      </div>
    );
  }

  const handleChange = (key: string, value: string | number) => {
    const numValue = parseFloat(value as string);
    const finalValue = isNaN(numValue) ? value : numValue;
    onUpdate(selectedElement.id, { [key]: finalValue });
  };

  return (
    <div className="mc-panel p-3 h-full overflow-y-auto">
      <h3 className="font-sans text-xs border-b-2 border-gray-400 pb-2 mb-4 uppercase" title={`Editing properties for this ${selectedElement.type}`}>
        {selectedElement.type ? selectedElement.type : 'Properties'}
      </h3>

      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="font-sans text-[10px] text-gray-600" title="Unique identifier for this element">ID</label>
          <input 
            className="mc-input text-sm"
            value={selectedElement.id}
            readOnly
            title="Element ID (read-only)"
          />
        </div>

        {'invertElev' in selectedElement && (
           <div className="flex flex-col gap-1">
            <label className="font-sans text-[10px] text-gray-600" title="The bottom elevation of the node — water flows from higher to lower elevations">Invert Elev (ft)</label>
            <input 
              className="mc-input text-sm"
              type="number"
              value={(selectedElement as Node).invertElev}
              onChange={(e) => handleChange('invertElev', e.target.value)}
              title="Set the invert (bottom) elevation in feet — lower values mean deeper underground"
            />
          </div>
        )}

        {'maxDepth' in selectedElement && (
           <div className="flex flex-col gap-1">
            <label className="font-sans text-[10px] text-gray-600" title="Maximum water depth this node can hold before flooding occurs">Max Depth (ft)</label>
            <input 
              className="mc-input text-sm"
              type="number"
              value={(selectedElement as Node).maxDepth}
              onChange={(e) => handleChange('maxDepth', e.target.value)}
              title="Maximum water depth in feet — if exceeded, the node will flood (surcharge)"
            />
          </div>
        )}

        {'roughness' in selectedElement && (
          <>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-gray-600" title="Internal diameter of the pipe — larger pipes carry more water but cost more">Diameter (ft)</label>
              <input 
                data-testid="input-diameter"
                className="mc-input text-sm"
                type="number"
                step="0.25"
                value={(selectedElement as Link).diameter}
                onChange={(e) => handleChange('diameter', e.target.value)}
                title="Pipe diameter in feet — typical range: 0.5 to 6.0 ft. Bigger pipes = more flow capacity"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-gray-600" title="Manning's roughness coefficient — lower = smoother pipe, higher = more friction">Roughness</label>
              <input 
                className="mc-input text-sm"
                type="number"
                step="0.001"
                value={(selectedElement as Link).roughness}
                onChange={(e) => handleChange('roughness', e.target.value)}
                title="Manning's n roughness (0.01 = smooth PVC, 0.013 = concrete, 0.024 = corrugated metal)"
              />
            </div>
          </>
        )}
        
        {'area' in selectedElement && (
          <>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-gray-600" title="Total drainage area of this subcatchment in acres">Area (ac)</label>
              <input 
                className="mc-input text-sm"
                type="number"
                value={(selectedElement as Subcatchment).area}
                onChange={(e) => handleChange('area', e.target.value)}
                title="Drainage area in acres — larger areas generate more runoff during storms"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-gray-600" title="Percentage of impervious (paved/roofed) surface — higher % means more runoff">% Impervious</label>
              <input 
                className="mc-input text-sm"
                type="number"
                value={(selectedElement as Subcatchment).percentImperv}
                onChange={(e) => handleChange('percentImperv', e.target.value)}
                title="Percent impervious (0-100) — paved areas (80-95%), residential (30-60%), parks (5-20%)"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-gray-600" title="The node where this subcatchment's runoff flows to">Outlet Node</label>
              <input 
                className="mc-input text-sm"
                value={(selectedElement as Subcatchment).outletNode || '(none)'}
                onChange={(e) => handleChange('outletNode', e.target.value === '(none)' ? '' : e.target.value)}
                title="ID of the junction or storage node that receives this subcatchment's stormwater runoff"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-gray-600" title="Number of polygon vertices defining this subcatchment's boundary">Vertices</label>
              <div className="mc-input text-sm bg-gray-300" title={`This subcatchment has ${(selectedElement as Subcatchment).points.length} boundary points`}>
                {(selectedElement as Subcatchment).points.length} points
              </div>
            </div>
          </>
        )}

        {'length' in selectedElement && (
          <>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-gray-600" title="Length of the conduit (pipe) between two nodes">Length (ft)</label>
              <input 
                className="mc-input text-sm"
                type="number"
                value={(selectedElement as any).length}
                onChange={(e) => handleChange('length', e.target.value)}
                title="Pipe length in feet — automatically calculated from node positions"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-gray-600" title="The upstream node where this pipe starts">From Node</label>
              <div className="mc-input text-sm bg-gray-300" title={`This pipe starts at node ${(selectedElement as any).fromNode}`}>
                {(selectedElement as any).fromNode}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-sans text-[10px] text-gray-600" title="The downstream node where this pipe ends">To Node</label>
              <div className="mc-input text-sm bg-gray-300" title={`This pipe ends at node ${(selectedElement as any).toNode}`}>
                {(selectedElement as any).toNode}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
