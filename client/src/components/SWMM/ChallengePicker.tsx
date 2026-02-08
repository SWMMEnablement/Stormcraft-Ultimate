import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CHALLENGE_LEVELS, ChallengeLevel } from '@/lib/challenges';
import { formatMoney } from '@/lib/budget';

interface ChallengePickerProps {
  currentLevel: ChallengeLevel | null;
  onSelectLevel: (level: ChallengeLevel | null) => void;
}

export function ChallengePicker({ currentLevel, onSelectLevel }: ChallengePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (level: ChallengeLevel | null) => {
    onSelectLevel(level);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="mc-btn" data-testid="button-challenges">
          {currentLevel ? `${currentLevel.emoji} Lv${currentLevel.id}` : '🎮 CHALLENGE'}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-gray-900 border-4 border-yellow-500 text-white">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl text-yellow-400">Challenge Levels</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-96 overflow-y-auto">
          {/* Sandbox mode */}
          <div
            className={`p-3 border-2 rounded cursor-pointer transition-colors ${
              !currentLevel ? 'border-cyan-400 bg-gray-700' : 'border-gray-600 hover:border-gray-400 bg-gray-800'
            }`}
            onClick={() => handleSelect(null)}
            data-testid="challenge-sandbox"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xl mr-2">🏗</span>
                <span className="font-bold text-cyan-300">Sandbox Mode</span>
              </div>
              <span className="text-xs text-gray-400">Infinite Budget</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">No constraints. Build anything. Test any storm. Learn freely.</p>
          </div>

          {CHALLENGE_LEVELS.map(level => (
            <div
              key={level.id}
              className={`p-3 border-2 rounded cursor-pointer transition-colors ${
                currentLevel?.id === level.id
                  ? 'border-yellow-400 bg-gray-700'
                  : 'border-gray-600 hover:border-gray-400 bg-gray-800'
              }`}
              onClick={() => handleSelect(level)}
              data-testid={`challenge-level-${level.id}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl mr-2">{level.emoji}</span>
                  <span className="font-bold">{level.name}</span>
                  <span className="text-gray-400 text-xs ml-2">— {level.subtitle}</span>
                </div>
                <span className="text-xs text-green-400">{formatMoney(level.budget)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{level.description}</p>
              <div className="flex gap-4 mt-2 text-xs">
                <span>Storm: {level.stormReturn}-yr</span>
                <span>Terrain: {level.terrain}</span>
                <span>Max Flood: {level.maxFloodingAllowed < 0 ? 'Minimize!' : `${level.maxFloodingAllowed}ft`}</span>
              </div>
              <div className="text-xs text-cyan-400 mt-1 italic">Steve: "{level.steveComment}"</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
