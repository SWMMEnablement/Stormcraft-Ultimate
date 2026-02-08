import { Node, Link, SWMMState } from './swmm-types';

export interface BudgetConfig {
  total: number;
  costs: {
    junction: number;
    outfall: number;
    storage: number;
    raingauge: number;
    conduitPerFt: number;
  };
}

export const DEFAULT_BUDGET: BudgetConfig = {
  total: 500000,
  costs: {
    junction: 10000,
    outfall: 25000,
    storage: 50000,
    raingauge: 5000,
    conduitPerFt: 100,
  },
};

export const SANDBOX_BUDGET: BudgetConfig = {
  total: Infinity,
  costs: {
    junction: 0,
    outfall: 0,
    storage: 0,
    raingauge: 0,
    conduitPerFt: 0,
  },
};

export function calculateSpent(model: SWMMState, config: BudgetConfig): number {
  let spent = 0;
  model.nodes.forEach(n => {
    switch (n.type) {
      case 'junction': spent += config.costs.junction; break;
      case 'outfall': spent += config.costs.outfall; break;
      case 'storage': spent += config.costs.storage; break;
      case 'raingauge': spent += config.costs.raingauge; break;
    }
  });
  model.links.forEach(l => {
    spent += l.length * config.costs.conduitPerFt;
  });
  return spent;
}

export function getRemaining(model: SWMMState, config: BudgetConfig): number {
  return config.total - calculateSpent(model, config);
}

export function formatMoney(amount: number): string {
  if (amount === Infinity) return 'UNLIMITED';
  if (amount < 0) return `-$${Math.abs(amount).toLocaleString()}`;
  return `$${amount.toLocaleString()}`;
}

export function canAfford(model: SWMMState, config: BudgetConfig, itemType: string, length?: number): boolean {
  if (config.total === Infinity) return true;
  const remaining = getRemaining(model, config);
  switch (itemType) {
    case 'junction': return remaining >= config.costs.junction;
    case 'outfall': return remaining >= config.costs.outfall;
    case 'storage': return remaining >= config.costs.storage;
    case 'raingauge': return remaining >= config.costs.raingauge;
    case 'conduit': return remaining >= (length || 100) * config.costs.conduitPerFt;
    default: return true;
  }
}
