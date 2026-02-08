import React from 'react';
import { SWMMState } from '@/lib/swmm-types';
import { BudgetConfig, calculateSpent, getRemaining, formatMoney } from '@/lib/budget';

interface BudgetBarProps {
  model: SWMMState;
  budget: BudgetConfig;
}

export function BudgetBar({ model, budget }: BudgetBarProps) {
  if (budget.total === Infinity) return null;

  const spent = calculateSpent(model, budget);
  const remaining = getRemaining(model, budget);
  const pct = Math.min(100, (spent / budget.total) * 100);
  const isOverBudget = remaining < 0;
  const isWarning = pct > 75 && !isOverBudget;

  return (
    <div className="bg-black/80 border-2 border-gray-600 p-2" data-testid="budget-bar" style={{ imageRendering: 'pixelated' }}>
      <div className="flex items-center justify-between mb-1">
        <span
          className="text-yellow-400"
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px' }}
        >
          BUDGET
        </span>
        <span
          className={isOverBudget ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-green-400'}
          style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '7px' }}
        >
          {formatMoney(remaining)}
        </span>
      </div>
      <div className="h-2 bg-gray-800 border border-gray-600 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isOverBudget ? 'bg-red-500' :
            isWarning ? 'bg-yellow-500' :
            'bg-green-500'
          }`}
          style={{ width: `${Math.min(100, pct)}%`, imageRendering: 'pixelated' }}
        />
      </div>
      <div className="flex justify-between mt-1" style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '6px' }}>
        <span className="text-gray-400">{formatMoney(spent)}</span>
        <span className="text-gray-400">{formatMoney(budget.total)}</span>
      </div>
    </div>
  );
}
