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

  const barColor = isOverBudget ? '#FF5555' : isWarning ? '#FFFF55' : '#55FF55';
  const labelColor = isOverBudget ? '#FF5555' : isWarning ? '#FFFF55' : '#55FF55';

  return (
    <div
      className="p-2"
      style={{
        background: 'rgba(0,0,0,0.85)',
        border: '2px solid #555',
        imageRendering: 'pixelated',
      }}
      data-testid="budget-bar"
    >
      <div className="flex items-center justify-between mb-1">
        <span
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            color: '#FFFF55',
            textShadow: '1px 1px 0 #000',
          }}
        >
          BUDGET
        </span>
        <span
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: '7px',
            color: labelColor,
            textShadow: '1px 1px 0 #000',
          }}
        >
          {formatMoney(remaining)}
        </span>
      </div>
      <div style={{ height: 6, background: '#333', border: '1px solid #555', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, pct)}%`,
            background: barColor,
            transition: 'width 0.3s',
            imageRendering: 'pixelated',
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#888', textShadow: '1px 1px 0 #000' }}>
          {formatMoney(spent)}
        </span>
        <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: '6px', color: '#888', textShadow: '1px 1px 0 #000' }}>
          {formatMoney(budget.total)}
        </span>
      </div>
    </div>
  );
}
