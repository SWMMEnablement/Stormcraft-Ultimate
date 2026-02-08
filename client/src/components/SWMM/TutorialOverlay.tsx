import React, { useEffect, useState } from 'react';
import { TutorialState, TUTORIAL_STEPS } from '@/lib/tutorial';
import { getEmotionEmoji } from '@/lib/steve';

interface TutorialOverlayProps {
  tutorial: TutorialState;
  onDismiss: () => void;
  onAutoAdvance: () => void;
}

export function TutorialOverlay({ tutorial, onDismiss, onAutoAdvance }: TutorialOverlayProps) {
  const [visible, setVisible] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);

  const step = TUTORIAL_STEPS[tutorial.currentStep];

  useEffect(() => {
    setFadeIn(false);
    const t = setTimeout(() => setFadeIn(true), 50);
    return () => clearTimeout(t);
  }, [tutorial.currentStep]);

  useEffect(() => {
    if (step?.requiredAction === 'auto_advance' && step.autoAdvanceMs) {
      const timer = setTimeout(onAutoAdvance, step.autoAdvanceMs);
      return () => clearTimeout(timer);
    }
  }, [tutorial.currentStep, step]);

  if (!tutorial.active || tutorial.completed || tutorial.dismissed || !step) return null;

  const progress = ((tutorial.currentStep) / (TUTORIAL_STEPS.length - 1)) * 100;

  return (
    <>
      <div
        className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 transition-all duration-500 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        style={{ maxWidth: '500px', width: '90%' }}
        data-testid="tutorial-overlay"
      >
        <div className="bg-gray-900 border-4 border-yellow-500 rounded-lg shadow-2xl overflow-hidden">
          {/* Progress bar */}
          <div className="h-2 bg-gray-700">
            <div
              className="h-full bg-gradient-to-r from-green-400 to-cyan-400 transition-all duration-700"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-4">
            {/* Steve's speech */}
            <div className="flex items-start gap-3 mb-3">
              <div className="text-3xl shrink-0">{getEmotionEmoji('inspecting')}</div>
              <div>
                <div className="text-yellow-400 font-bold text-sm mb-1">STEVE SAYS:</div>
                <div className="text-white text-sm leading-relaxed">{step.steveSpeech}</div>
              </div>
            </div>

            {/* Instruction */}
            <div className="bg-gray-800 border border-gray-600 rounded p-2 mb-3">
              <div className="text-cyan-300 text-xs font-bold">{step.instruction}</div>
            </div>

            {/* Tool hint */}
            {step.highlightTool && (
              <div className="text-xs text-gray-400">
                Keyboard shortcut: <span className="bg-gray-700 px-2 py-0.5 rounded text-yellow-300 font-bold">
                  {step.highlightTool === 'junction' ? 'J' :
                   step.highlightTool === 'outfall' ? 'O' :
                   step.highlightTool === 'conduit' ? 'C' :
                   step.highlightTool === 'storage' ? 'S' : step.highlightTool.toUpperCase()}
                </span>
              </div>
            )}

            {/* Step counter + skip */}
            <div className="flex items-center justify-between mt-3">
              <div className="text-gray-500 text-xs">
                Step {tutorial.currentStep + 1} of {TUTORIAL_STEPS.length}
              </div>
              <button
                onClick={onDismiss}
                className="text-gray-500 hover:text-gray-300 text-xs underline"
                data-testid="button-skip-tutorial"
              >
                Skip Tutorial
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Glow hint on canvas */}
      {step.glowPosition && (
        <div
          className="absolute z-40 pointer-events-none"
          style={{
            left: step.glowPosition.x - 25,
            top: step.glowPosition.y - 25,
            width: 50,
            height: 50,
          }}
        >
          <div className="w-full h-full rounded-full border-4 border-yellow-400 animate-pulse opacity-60" />
        </div>
      )}
    </>
  );
}
