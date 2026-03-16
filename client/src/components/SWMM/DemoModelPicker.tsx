import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DEMO_MODELS, DemoModel } from '@/lib/demo-models';
import { SWMMState } from '@/lib/swmm-types';
import { playPlop } from '@/lib/sound';

interface DemoModelPickerProps {
  onLoadModel: (model: SWMMState) => void;
}

const difficultyColor: Record<string, string> = {
  Beginner: 'text-green-400',
  Intermediate: 'text-yellow-400',
  Advanced: 'text-red-400',
};

export function DemoModelPicker({ onLoadModel }: DemoModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (demo: DemoModel) => {
    const fresh: SWMMState = JSON.parse(JSON.stringify(demo.model));
    fresh.nodes.forEach(n => { n.depth = 0; n.isSurcharged = false; });
    fresh.links.forEach(l => { l.flow = 0; });
    playPlop();
    onLoadModel(fresh);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="mc-btn-sm" data-testid="button-demos">DEMOS</button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-black/95 border-2 border-green-500 text-white" style={{ imageRendering: 'pixelated' }}>
        <DialogHeader>
          <DialogTitle
            className="text-green-400"
            style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '14px' }}
          >
            LOAD DEMO MODEL
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
          {DEMO_MODELS.map(demo => (
            <button
              key={demo.id}
              onClick={() => handleSelect(demo)}
              className="w-full text-left p-3 border-2 border-gray-700 hover:border-green-500 bg-gray-900 hover:bg-gray-800 transition-colors cursor-pointer group"
              data-testid={`demo-${demo.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{demo.emoji}</span>
                  <span
                    className="text-white group-hover:text-green-300 transition-colors"
                    style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '10px' }}
                  >
                    {demo.name}
                  </span>
                </div>
                <span
                  className={difficultyColor[demo.difficulty]}
                  style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px' }}
                >
                  {demo.difficulty.toUpperCase()}
                </span>
              </div>
              <p
                className="text-gray-400 mt-2 leading-relaxed"
                style={{ fontFamily: 'VT323, monospace', fontSize: '14px' }}
              >
                {demo.description}
              </p>
              <div
                className="flex gap-4 mt-2 text-gray-500"
                style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px' }}
              >
                <span>{demo.nodeCount} NODES</span>
                <span>{demo.linkCount} LINKS</span>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
