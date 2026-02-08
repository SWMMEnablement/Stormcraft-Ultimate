import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/SWMM/Header';
import { Toolbar } from '@/components/SWMM/Toolbar';
import { PropertiesPanel } from '@/components/SWMM/PropertiesPanel';
import { SimulationControls } from '@/components/SWMM/SimulationControls';
import { MapCanvas } from '@/components/SWMM/MapCanvas';
import { ProfileCanvas } from '@/components/SWMM/ProfileCanvas';
import { Minimap } from '@/components/SWMM/Minimap';
import { ProjectManager } from '@/components/SWMM/ProjectManager';
import { ImportDialog } from '@/components/SWMM/ImportDialog';
import { TutorialOverlay } from '@/components/SWMM/TutorialOverlay';
import { BudgetBar } from '@/components/SWMM/BudgetBar';
import { ChallengePicker } from '@/components/SWMM/ChallengePicker';
import { SWMMState, Tool, Node, Link, Subcatchment, SteveState } from '@/lib/swmm-types';
import { INITIAL_STEVE, updateSteve, getEmotionEmoji, getEmotionLabel } from '@/lib/steve';
import { TutorialState, INITIAL_TUTORIAL, TUTORIAL_STEPS, advanceTutorial } from '@/lib/tutorial';
import { BudgetConfig, DEFAULT_BUDGET, SANDBOX_BUDGET, canAfford } from '@/lib/budget';
import { ChallengeLevel } from '@/lib/challenges';
import { downloadInpFile } from '@/lib/swmm-export';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

export default function Home() {
  const [model, setModel] = useState<SWMMState>({
    nodes: [],
    links: [],
    subcatchments: []
  });

  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [is3D, setIs3D] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [steve, setSteve] = useState<SteveState>(INITIAL_STEVE);
  const [tutorial, setTutorial] = useState<TutorialState>(INITIAL_TUTORIAL);
  const [budget, setBudget] = useState<BudgetConfig>(SANDBOX_BUDGET);
  const [challenge, setChallenge] = useState<ChallengeLevel | null>(null);

  const [simTime, setSimTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);

  const selectedElement = 
    model.nodes.find(n => n.id === selectedId) || 
    model.links.find(l => l.id === selectedId) || 
    model.subcatchments.find(s => s.id === selectedId) || null;

  // Update Steve's tutorial speech based on current tutorial step
  useEffect(() => {
    if (tutorial.active && !tutorial.dismissed && !tutorial.completed) {
      const step = TUTORIAL_STEPS[tutorial.currentStep];
      if (step) {
        setSteve(s => ({ ...s, tutorialSpeech: step.steveSpeech }));
        if (step.highlightTool) {
          setActiveTool(step.highlightTool);
        }
      }
    } else {
      setSteve(s => ({ ...s, tutorialSpeech: null }));
    }
  }, [tutorial.currentStep, tutorial.active, tutorial.dismissed, tutorial.completed]);

  const handleTutorialAutoAdvance = useCallback(() => {
    setTutorial(prev => {
      const nextStep = prev.currentStep + 1;
      if (nextStep >= TUTORIAL_STEPS.length) {
        return { ...prev, currentStep: nextStep, completed: true, active: false };
      }
      return { ...prev, currentStep: nextStep };
    });
  }, []);

  const handleDismissTutorial = useCallback(() => {
    setTutorial(prev => ({ ...prev, dismissed: true, active: false }));
    setSteve(s => ({ ...s, tutorialSpeech: null, speech: null }));
  }, []);

  const handleSelectChallenge = useCallback((level: ChallengeLevel | null) => {
    setChallenge(level);
    if (level) {
      setBudget({ ...DEFAULT_BUDGET, total: level.budget });
      setModel({ nodes: [], links: [], subcatchments: [] });
      setSimTime(0);
      setIsPlaying(false);
      setSteve(prev => ({ ...prev, speech: level.steveComment, tutorialSpeech: null }));
      setTutorial(prev => ({ ...prev, dismissed: true, active: false }));
    } else {
      setBudget(SANDBOX_BUDGET);
    }
  }, []);

  // Steve tick loop (always running)
  useEffect(() => {
    const steveInterval = setInterval(() => {
      setSteve(prev => updateSteve(prev, model.nodes, model.links, 0.1, isPlaying, simTime));
    }, 150);
    return () => clearInterval(steveInterval);
  }, [model.nodes, model.links, isPlaying, simTime]);

  // Simulation Loop
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setSimTime(prev => {
          const next = prev + (0.1 * simSpeed);
          if (next > 24) {
            setIsPlaying(false);
            setSteve(s => ({ ...s, action: 'celebrating' as const, speech: "Storm's over! Let's see how we did!" }));
            return 24;
          }
          return next;
        });

        setModel(prev => {
          const intensity = challenge ? challenge.stormIntensity : 0.5;
          const newNodes = prev.nodes.map(n => {
            const stormPeak = 6;
            const dist = Math.abs(simTime - stormPeak);
            const rainIntensity = Math.max(0, intensity * Math.exp(-dist * 0.3));
            const upstreamLinks = prev.links.filter(l => l.toNode === n.id);
            const upstreamFlow = upstreamLinks.reduce((sum, l) => sum + l.flow, 0);
            const inflow = rainIntensity * 2 + upstreamFlow * 0.3;
            const downstreamLinks = prev.links.filter(l => l.fromNode === n.id);
            const outflow = downstreamLinks.length > 0 ? n.depth * 0.5 : n.depth * 0.1;
            const newDepth = Math.max(0, n.depth + (inflow - outflow) * 0.05);
            return { 
              ...n, 
              depth: newDepth,
              isSurcharged: n.maxDepth > 0 && newDepth >= n.maxDepth,
            };
          });
          
          const newLinks = prev.links.map(l => {
            const upNode = newNodes.find(n => n.id === l.fromNode);
            return {
              ...l,
              flow: upNode ? Math.max(0, upNode.depth * 1.5) : 0
            };
          });

          return { ...prev, nodes: newNodes, links: newLinks };
        });

      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, simTime, challenge]);

  const handleAddNode = useCallback((n: Node) => {
    setModel(prev => ({...prev, nodes: [...prev.nodes, n]}));
    setTutorial(prev => advanceTutorial(prev, 'node_added', { type: n.type }));
  }, []);

  const handleAddLink = useCallback((l: Link) => {
    setModel(prev => ({...prev, links: [...prev.links, l]}));
    setTutorial(prev => advanceTutorial(prev, 'link_added'));
  }, []);

  const handleAddSubcatchment = useCallback((s: Subcatchment) => {
    setModel(prev => ({...prev, subcatchments: [...prev.subcatchments, s]}));
  }, []);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(prev => {
      if (!prev) {
        setTutorial(t => advanceTutorial(t, 'sim_started'));
      }
      return !prev;
    });
  }, []);

  const handleUpdateElement = (id: string, updates: any) => {
    setModel(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === id ? { ...n, ...updates } : n),
      links: prev.links.map(l => l.id === id ? { ...l, ...updates } : l),
      subcatchments: prev.subcatchments.map(s => s.id === id ? { ...s, ...updates } : s),
    }));
  };

  const handleExport = useCallback(() => {
    downloadInpFile(model, 'swmmcraft_export.inp');
  }, [model]);

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
        onExport={handleExport}
        onProfile={() => setShowProfile(!showProfile)}
        toggleTheme={toggleThemeHandler}
        projectManagerSlot={
          <ProjectManager 
            currentModel={model} 
            onLoadProject={setModel}
          />
        }
        importSlot={
          <>
            <ImportDialog onImport={setModel} />
            <ChallengePicker currentLevel={challenge} onSelectLevel={handleSelectChallenge} />
          </>
        }
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
                                   onAddNode={handleAddNode}
                                   onAddLink={handleAddLink}
                                   onAddSubcatchment={handleAddSubcatchment}
                                   is3D={is3D}
                                   simulationTime={simTime}
                                   steve={steve}
                                />

                                {/* Tutorial overlay */}
                                <TutorialOverlay
                                  tutorial={tutorial}
                                  onDismiss={handleDismissTutorial}
                                  onAutoAdvance={handleTutorialAutoAdvance}
                                />
                                
                                {/* Overlay Controls */}
                                <div className="absolute bottom-4 left-4 w-64 space-y-2">
                                    <SimulationControls 
                                      currentTime={simTime}
                                      isPlaying={isPlaying}
                                      onPlayPause={handlePlayPause}
                                      onTimeChange={setSimTime}
                                      onSpeedChange={setSimSpeed}
                                      simSpeed={simSpeed}
                                    />
                                    <BudgetBar model={model} budget={budget} />
                                </div>
                                
                                {/* Steve Tracker */}
                                <div className="absolute bottom-4 right-4 mc-panel p-2 text-xs max-w-48" data-testid="steve-tracker">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">{getEmotionEmoji(steve.action)}</span>
                                    <span className="font-sans font-bold">
                                      Steve: {getEmotionLabel(steve.action)}
                                    </span>
                                  </div>
                                  {steve.targetNodeId && (
                                    <div className="text-gray-500 mt-1">
                                      Target: {steve.targetNodeId}
                                    </div>
                                  )}
                                  <div className="text-gray-500 mt-1">
                                    ({Math.round(steve.x)}, {Math.round(steve.y)})
                                  </div>
                                  {steve.speech && !tutorial.active && (
                                    <div className="mt-1 bg-yellow-100 border border-yellow-400 p-1 text-yellow-800 text-[10px]">
                                      💬 {steve.speech}
                                    </div>
                                  )}

                                  {/* Challenge info */}
                                  {challenge && (
                                    <div className="mt-2 pt-2 border-t border-gray-400">
                                      <div className="font-bold text-xs">
                                        {challenge.emoji} {challenge.name}
                                      </div>
                                      <div className="text-gray-500 text-[10px]">
                                        {challenge.stormReturn}-yr storm | {challenge.terrain}
                                      </div>
                                    </div>
                                  )}
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
