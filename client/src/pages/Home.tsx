import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { downloadInpFile, generateInpFile } from '@/lib/swmm-export';
import { SimulationResults } from '@/components/SWMM/SimulationResults';
import { DemoOverlay } from '@/components/SWMM/DemoOverlay';
import { DemoModelPicker } from '@/components/SWMM/DemoModelPicker';
import { SwmmEngine, applySimStepToModel } from '@/lib/swmm-engine';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ThreeCanvas } from '@/components/SWMM/ThreeCanvas';

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
  const [simResults, setSimResults] = useState<{ inp: string; rpt: string } | null>(null);
  const [isRunningSwmm, setIsRunningSwmm] = useState(false);
  const [showDemo, setShowDemo] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('swmmcraft_demo_seen');
    }
    return true;
  });

  const selectedElement = 
    model.nodes.find(n => n.id === selectedId) || 
    model.links.find(l => l.id === selectedId) || 
    model.subcatchments.find(s => s.id === selectedId) || null;

  // Update Steve's tutorial speech based on current tutorial step
  useEffect(() => {
    if (tutorial.active && !tutorial.dismissed && !tutorial.completed) {
      const step = TUTORIAL_STEPS[tutorial.currentStep];
      if (step) {
        setSteve(s => ({
          ...s,
          tutorialSpeech: step.steveSpeech,
          action: step.glowPosition ? 'pointing' as const : s.action,
        }));
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

  const engineRef = useRef<SwmmEngine | null>(null);
  const simTimeRef = useRef(0);

  useEffect(() => {
    simTimeRef.current = simTime;
  }, [simTime]);

  const initEngine = useCallback(() => {
    const intensity = challenge ? challenge.stormIntensity : 2.0;
    engineRef.current = new SwmmEngine(model, {
      stormIntensityPeak: intensity,
      stormPeakHour: 6,
      stormDuration: 12,
    });
  }, [challenge]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      if (!engineRef.current) {
        initEngine();
      }
      interval = setInterval(() => {
        const currentTime = simTimeRef.current;
        const dt = 0.1 * simSpeed;
        const nextTime = currentTime + dt;

        if (nextTime > 24) {
          setIsPlaying(false);
          const flooding = engineRef.current?.getTotalFlooding() || 0;
          const floodMsg = flooding > 0
            ? `Storm's over! Total flooding: ${flooding.toFixed(1)} ft³. Let's improve the design!`
            : "Storm's over! No flooding — great engineering!";
          setSteve(s => ({ ...s, action: 'celebrating' as const, speech: floodMsg }));
          setSimTime(24);
          return;
        }

        if (engineRef.current) {
          const subSteps = 5;
          const subDt = dt / subSteps;
          let lastStep;
          for (let i = 0; i < subSteps; i++) {
            lastStep = engineRef.current.step(currentTime + subDt * i, subDt * 3600);
          }
          if (lastStep) {
            setModel(prev => applySimStepToModel(prev, lastStep));
          }
        }

        setSimTime(nextTime);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, simSpeed, initEngine]);

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
        if (simTimeRef.current >= 24) {
          setSimTime(0);
          simTimeRef.current = 0;
          engineRef.current = null;
          setModel(m => ({
            ...m,
            nodes: m.nodes.map(n => ({ ...n, depth: 0, isSurcharged: false })),
            links: m.links.map(l => ({ ...l, flow: 0 })),
          }));
        }
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

  const handleRunSwmm5 = useCallback(async () => {
    if (model.nodes.length === 0) {
      setSteve(s => ({ ...s, speech: "Need some nodes first! Build a network, then run SWMM5." }));
      return;
    }
    setIsRunningSwmm(true);
    setSteve(s => ({ ...s, speech: "Running the real EPA SWMM5 engine... hang tight!" }));
    try {
      const inpContent = generateInpFile(model, 'SWMMCraft Simulation');
      const resp = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inpContent }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setSimResults({ inp: data.inpContent, rpt: data.rptContent });
      setSteve(s => ({ ...s, speech: "SWMM5 simulation complete! Check the results." }));
    } catch (err) {
      setSteve(s => ({ ...s, speech: "SWMM5 run failed: " + (err instanceof Error ? err.message : String(err)) }));
    } finally {
      setIsRunningSwmm(false);
    }
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

  const handleDismissDemo = useCallback(() => {
    setShowDemo(false);
    sessionStorage.setItem('swmmcraft_demo_seen', '1');
  }, []);

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${theme === 'dark' ? 'dark' : ''}`}>
      {showDemo && <DemoOverlay onDismiss={handleDismissDemo} />}
      {simResults && (
        <SimulationResults
          inpContent={simResults.inp}
          rptContent={simResults.rpt}
          onClose={() => setSimResults(null)}
        />
      )}
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
        demoPickerSlot={
          <DemoModelPicker onLoadModel={setModel} />
        }
        importSlot={
          <>
            <ImportDialog onImport={setModel} />
            <ChallengePicker currentLevel={challenge} onSelectLevel={handleSelectChallenge} />
          </>
        }
      />
      
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
            <ResizablePanel defaultSize={80}>
                <ResizablePanelGroup direction="vertical">
                    <ResizablePanel defaultSize={70}>
                        <div className="h-full relative flex flex-col">
                            <div className="flex-1 relative">
                                <Minimap nodes={model.nodes} links={model.links} steve={steve} />
                                {is3D ? (
                                  <ThreeCanvas
                                    nodes={model.nodes}
                                    links={model.links}
                                    subcatchments={model.subcatchments}
                                    selectedId={selectedId}
                                    onSelect={setSelectedId}
                                    simulationTime={simTime}
                                    steve={steve}
                                  />
                                ) : (
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
                                )}

                                <TutorialOverlay
                                  tutorial={tutorial}
                                  onDismiss={handleDismissTutorial}
                                  onAutoAdvance={handleTutorialAutoAdvance}
                                />

                                <div className="absolute top-4 left-4 w-56 space-y-2 z-20">
                                    <SimulationControls 
                                      currentTime={simTime}
                                      isPlaying={isPlaying}
                                      onPlayPause={handlePlayPause}
                                      onTimeChange={setSimTime}
                                      onSpeedChange={setSimSpeed}
                                      simSpeed={simSpeed}
                                    />
                                    <button
                                      onClick={handleRunSwmm5}
                                      disabled={isRunningSwmm || model.nodes.length === 0}
                                      data-testid="button-run-swmm5"
                                      title="Run your model through the real EPA SWMM5 hydraulic engine and view the full report"
                                      className="w-full"
                                      style={{
                                        background: isRunningSwmm ? '#333' : '#1a3a5c',
                                        color: isRunningSwmm ? '#888' : '#55CCFF',
                                        border: '2px solid #4488CC',
                                        padding: '6px 8px',
                                        fontFamily: '"Press Start 2P", monospace',
                                        fontSize: 8,
                                        cursor: isRunningSwmm ? 'wait' : 'pointer',
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                        imageRendering: 'pixelated',
                                      }}
                                    >
                                      {isRunningSwmm ? 'RUNNING ENGINE...' : 'RUN SWMM5 ENGINE'}
                                    </button>
                                    <BudgetBar model={model} budget={budget} />
                                </div>

                                <Toolbar
                                  activeTool={activeTool}
                                  onToolChange={setActiveTool}
                                  onZoomIn={() => {}}
                                  onZoomOut={() => {}}
                                  toggle3D={() => setIs3D(!is3D)}
                                  is3D={is3D}
                                />
                                
                                {challenge && (
                                  <div className="absolute bottom-16 right-4 bg-black/80 border-2 border-gray-600 p-2 max-w-48 z-20" data-testid="challenge-info">
                                    <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px' }} className="text-yellow-400">
                                      {challenge.emoji} {challenge.name}
                                    </div>
                                    <div style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '6px' }} className="text-gray-400 mt-1">
                                      {challenge.stormReturn}-yr storm | {challenge.terrain}
                                    </div>
                                  </div>
                                )}
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
