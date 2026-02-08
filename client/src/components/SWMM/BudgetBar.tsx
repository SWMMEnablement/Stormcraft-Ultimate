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
    <div className="mc-panel p-2 text-xs" data-testid="budget-bar">
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold">
          {isOverBudget ? '🚨' : '💰'} BUDGET
        </span>
        <span className={isOverBudget ? 'text-red-600 font-bold' : isWarning ? 'text-yellow-600' : 'text-green-600'}>
          {formatMoney(remaining)} left
        </span>
      </div>
      <div className="h-3 bg-gray-400 border border-gray-600 rounded-sm overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isOverBudget ? 'bg-red-500' :
            isWarning ? 'bg-yellow-500' :
            'bg-green-500'
          }`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-gray-600">
        <span>Spent: {formatMoney(spent)}</span>
        <span>Total: {formatMoney(budget.total)}</span>
      </div>
    </div>
  );
}
