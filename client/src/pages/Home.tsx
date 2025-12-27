import React, { useState, useEffect } from 'react';
import { Header } from '@/components/SWMM/Header';
import { Toolbar } from '@/components/SWMM/Toolbar';
import { PropertiesPanel } from '@/components/SWMM/PropertiesPanel';
import { SimulationControls } from '@/components/SWMM/SimulationControls';
import { MapCanvas } from '@/components/SWMM/MapCanvas';
import { ProfileCanvas } from '@/components/SWMM/ProfileCanvas';
import { Minimap } from '@/components/SWMM/Minimap';
import { SWMMState, Tool, Node, Link, Subcatchment, SteveState } from '@/lib/swmm-types';
import { INITIAL_STEVE, updateSteve } from '@/lib/steve';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export default function Home() {
  // Application State
  const [model, setModel] = useState<SWMMState>({
    nodes: [
      { id: 'J1', type: 'junction', x: 200, y: 300, invertElev: 100, maxDepth: 10, depth: 0, isSurcharged: false },
      { id: 'J2', type: 'junction', x: 400, y: 300, invertElev: 98, maxDepth: 10, depth: 0, isSurcharged: false },
      { id: 'O1', type: 'outfall', x: 600, y: 350, invertElev: 95, maxDepth: 0, depth: 0, isSurcharged: false },
    ],
    links: [
      { id: 'C1', type: 'conduit', fromNode: 'J1', toNode: 'J2', length: 200, roughness: 0.013, flow: 0, capacity: 10 },
      { id: 'C2', type: 'conduit', fromNode: 'J2', toNode: 'O1', length: 200, roughness: 0.013, flow: 0, capacity: 10 },
    ],
    subcatchments: []
  });

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Steve State
  const [steve, setSteve] = useState<SteveState>(INITIAL_STEVE);

  // Simulation State
  const [simTime, setSimTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);

  // Computed helper to find selected element
  const selectedElement = 
    model.nodes.find(n => n.id === selectedId) || 
    model.links.find(l => l.id === selectedId) || 
    model.subcatchments.find(s => s.id === selectedId) || null;

  // Simulation Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setSimTime(prev => {
          const next = prev + (0.1 * simSpeed);
          return next > 24 ? 0 : next;
        });

        // Simple physics update (fake simulation)
        setModel(prev => {
          const newNodes = prev.nodes.map(n => {
            // Sine wave water level based on time and random offset per node
            const baseLevel = Math.sin((simTime / 24) * Math.PI * 2) * 2;
            return { 
                ...n, 
                depth: Math.max(0, baseLevel + (n.id === 'J1' ? 1 : 0)) 
            };
          });
          
          const newLinks = prev.links.map(l => {
              // Flow correlated with upstream depth
              const upNode = newNodes.find(n => n.id === l.fromNode);
              return {
                  ...l,
                  flow: upNode ? upNode.depth * 2 : 0
              };
          });

          // Update Steve
          setSteve(currentSteve => updateSteve(currentSteve, newNodes, 0.1));

          return { ...prev, nodes: newNodes, links: newLinks };
        });

      }, 100); // 100ms tick
    }
    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, simTime]);

  // Actions
  const handleUpdateElement = (id: string, updates: any) => {
    setModel(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
      links: prev.links.map(l => l.id === id ? { ...l, ...updates } : l),
      subcatchments: prev.subcatchments.map(s => s.id === id ? { ...s, ...updates } : s),
    }));
  };

  const toggleThemeHandler = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      <Header 
        onUndo={() => {}} 
        onRedo={() => {}} 
        onCopy={() => {}} 
        onPaste={() => {}} 
        onAutoLayout={() => {}} 
        onExport={() => {}}
        onProfile={() => setShowProfile(!showProfile)}
        toggleTheme={toggleThemeHandler}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <Toolbar 
          activeTool={activeTool} 
          onToolChange={setActiveTool}
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          toggle3D={() => setIs3D(!is3D)}
          is3D={is3D}
        />
        
        <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={80}>
                <ResizablePanelGroup direction="vertical">
                    <ResizablePanel defaultSize={70}>
                        <div className="h-full relative flex flex-col bg-gray-100 dark:bg-gray-900">
                            <div className="flex-1 relative">
                                <Minimap nodes={model.nodes} links={model.links} steve={steve} />
                                <MapCanvas 
                                   nodes={model.nodes}
                                   links={model.links}
                                   subcatchments={model.subcatchments}
                                   tool={activeTool}
                                   selectedId={selectedId}
                                   onSelect={setSelectedId}
                                   onAddNode={(n) => setModel(prev => ({...prev, nodes: [...prev.nodes, n]}))}
                                   onAddLink={(l) => setModel(prev => ({...prev, links: [...prev.links, l]}))}
                                   onAddSubcatchment={(s) => setModel(prev => ({...prev, subcatchments: [...prev.subcatchments, s]}))}
                                   is3D={is3D}
                                   simulationTime={simTime}
                                   steve={steve}
                                />
                                
                                {/* Overlay Controls */}
                                <div className="absolute bottom-4 left-4 w-64">
                                    <SimulationControls 
                                      currentTime={simTime}
                                      isPlaying={isPlaying}
                                      onPlayPause={() => setIsPlaying(!isPlaying)}
                                      onTimeChange={setSimTime}
                                      onSpeedChange={setSimSpeed}
                                      simSpeed={simSpeed}
                                    />
                                </div>
                            </div>
                        </div>
                    </ResizablePanel>
                    
                    {showProfile && (
                        <>
                            <ResizableHandle withHandle />
                            <ResizablePanel defaultSize={30} minSize={20}>
                                <ProfileCanvas 
                                    nodes={model.nodes}
                                    links={model.links}
                                    selectedId={selectedId}
                                    simulationTime={simTime}
                                />
                            </ResizablePanel>
                        </>
                    )}
                </ResizablePanelGroup>
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
                <PropertiesPanel 
                   selectedElement={selectedElement}
                   onUpdate={handleUpdateElement}
                />
            </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
