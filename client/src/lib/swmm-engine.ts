import { Node, Link, SWMMState } from './swmm-types';

export interface SimulationOptions {
  stormIntensityPeak: number;
  stormPeakHour: number;
  stormDuration: number;
  units: 'US' | 'SI';
}

export const DEFAULT_SIM_OPTIONS: SimulationOptions = {
  stormIntensityPeak: 2.0,
  stormPeakHour: 6,
  stormDuration: 12,
  units: 'US',
};

export interface NodeResult {
  id: string;
  depth: number;
  head: number;
  volume: number;
  lateralInflow: number;
  totalInflow: number;
  flooding: number;
  isSurcharged: boolean;
}

export interface LinkResult {
  id: string;
  flow: number;
  velocity: number;
  depthFraction: number;
  capacity: number;
}

export interface SimulationStep {
  time: number;
  nodeResults: Map<string, NodeResult>;
  linkResults: Map<string, LinkResult>;
  totalRainfall: number;
  totalRunoff: number;
  totalFlooding: number;
}

function computeRainfall(
  timeHours: number,
  peakIntensity: number,
  peakHour: number,
  duration: number
): number {
  if (timeHours < 0 || timeHours > duration) return 0;
  const sigma = duration / 6;
  const dist = timeHours - peakHour;
  return peakIntensity * Math.exp(-(dist * dist) / (2 * sigma * sigma));
}

function manningCircular(
  diameter: number,
  slope: number,
  roughness: number,
  depthFraction: number,
  manningK: number
): { flow: number; velocity: number; area: number } {
  if (depthFraction <= 0.001 || slope <= 0 || roughness <= 0 || diameter <= 0) {
    return { flow: 0, velocity: 0, area: 0 };
  }

  const d = Math.min(depthFraction, 0.99);
  const D = diameter;
  const theta = 2 * Math.acos(1 - 2 * d);
  const area = (D * D / 8) * (theta - Math.sin(theta));
  const perimeter = (D / 2) * theta;

  if (perimeter <= 1e-6 || area <= 1e-6) {
    return { flow: 0, velocity: 0, area: 0 };
  }

  const rh = area / perimeter;
  const velocity = (manningK / roughness) * Math.pow(rh, 2 / 3) * Math.pow(slope, 0.5);
  const flow = velocity * area;

  return { flow: Math.max(0, flow), velocity: Math.max(0, velocity), area };
}

function fullPipeFlow(
  diameter: number,
  slope: number,
  roughness: number,
  manningK: number
): number {
  if (slope <= 0 || roughness <= 0 || diameter <= 0) return 0.01;
  const area = Math.PI * (diameter / 2) ** 2;
  const rh = diameter / 4;
  const velocity = (manningK / roughness) * Math.pow(rh, 2 / 3) * Math.pow(slope, 0.5);
  return velocity * area;
}

function getTopologicalOrder(nodes: Node[], links: Link[]): string[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  nodes.forEach(n => {
    inDegree.set(n.id, 0);
    adjList.set(n.id, []);
  });

  links.forEach(l => {
    inDegree.set(l.toNode, (inDegree.get(l.toNode) || 0) + 1);
    const adj = adjList.get(l.fromNode) || [];
    adj.push(l.toNode);
    adjList.set(l.fromNode, adj);
  });

  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const order: string[] = [];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    order.push(current);
    const neighbors = adjList.get(current) || [];
    for (const neighbor of neighbors) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  nodes.forEach(n => {
    if (!visited.has(n.id)) order.push(n.id);
  });

  return order;
}

export class SwmmEngine {
  private nodes: Node[];
  private links: Link[];
  private options: SimulationOptions;
  private manningK: number;
  private nodeDepths: Map<string, number>;
  private nodeVolumes: Map<string, number>;
  private linkFlows: Map<string, number>;
  private topoOrder: string[];
  private nodeMap: Map<string, Node>;
  private inLinks: Map<string, Link[]>;
  private outLinks: Map<string, Link[]>;
  private totalFlooding: number;
  private totalRunoff: number;

  constructor(model: SWMMState, options?: Partial<SimulationOptions>) {
    this.nodes = model.nodes.filter(n => n.type !== 'raingauge');
    this.links = model.links;
    this.options = { ...DEFAULT_SIM_OPTIONS, ...options };
    this.manningK = this.options.units === 'US' ? 1.49 : 1.0;

    this.nodeDepths = new Map();
    this.nodeVolumes = new Map();
    this.linkFlows = new Map();
    this.nodeMap = new Map();
    this.inLinks = new Map();
    this.outLinks = new Map();
    this.totalFlooding = 0;
    this.totalRunoff = 0;

    this.nodes.forEach(n => {
      this.nodeDepths.set(n.id, 0);
      this.nodeVolumes.set(n.id, 0);
      this.nodeMap.set(n.id, n);
      this.inLinks.set(n.id, []);
      this.outLinks.set(n.id, []);
    });

    this.links.forEach(l => {
      this.linkFlows.set(l.id, 0);
      const inList = this.inLinks.get(l.toNode);
      if (inList) inList.push(l);
      const outList = this.outLinks.get(l.fromNode);
      if (outList) outList.push(l);
    });

    this.topoOrder = getTopologicalOrder(this.nodes, this.links);
  }

  step(currentTimeHours: number, dtSeconds: number): SimulationStep {
    const rainfall = computeRainfall(
      currentTimeHours,
      this.options.stormIntensityPeak,
      this.options.stormPeakHour,
      this.options.stormDuration
    );

    const nodeResults = new Map<string, NodeResult>();
    const linkResults = new Map<string, LinkResult>();
    let stepFlooding = 0;
    let stepRunoff = 0;

    const lateralInflows = new Map<string, number>();

    for (const nodeId of this.topoOrder) {
      const node = this.nodeMap.get(nodeId);
      if (!node) continue;

      let lateralInflow = 0;
      if (node.type === 'junction' || node.type === 'storage') {
        const catchmentArea = node.type === 'storage' ? 2.0 : 5.0;
        const runoffCoeff = node.type === 'storage' ? 0.3 : 0.7;
        lateralInflow = (rainfall / 12.0) * runoffCoeff * catchmentArea * 43560 / 3600;
        stepRunoff += lateralInflow;
      }
      lateralInflows.set(nodeId, lateralInflow);
    }

    for (const nodeId of this.topoOrder) {
      const node = this.nodeMap.get(nodeId);
      if (!node) continue;

      const lateralInflow = lateralInflows.get(nodeId) || 0;
      const incomingLinks = this.inLinks.get(nodeId) || [];
      let totalInflow = lateralInflow;
      for (const link of incomingLinks) {
        totalInflow += this.linkFlows.get(link.id) || 0;
      }

      const currentDepth = this.nodeDepths.get(nodeId) || 0;
      const storageArea = node.type === 'storage' ? 500 : 50;
      const currentVolume = currentDepth * storageArea;

      let newVolume = currentVolume + totalInflow * dtSeconds;

      const outgoingLinks = this.outLinks.get(nodeId) || [];
      let totalOutflow = 0;

      if (node.type === 'outfall') {
        totalOutflow = totalInflow;
        newVolume = 0;
      } else {
        for (const link of outgoingLinks) {
          const toNode = this.nodeMap.get(link.toNode);
          if (!toNode) continue;

          const elevDiff = node.invertElev - toNode.invertElev;
          const linkLength = Math.max(1, link.length);
          const slope = elevDiff / linkLength;

          const effectiveSlope = Math.max(0, slope);

          const maxDepth = node.maxDepth > 0 ? node.maxDepth : 10;
          const depthFraction = Math.min(1.0, currentDepth / maxDepth);

          const D = link.diameter > 0 ? link.diameter : 1.5;

          let linkFlow: number;
          const qFull = fullPipeFlow(D, Math.max(0.001, effectiveSlope), link.roughness, this.manningK);

          if (effectiveSlope <= 0) {
            linkFlow = 0;
          } else {
            const manning = manningCircular(D, effectiveSlope, link.roughness, depthFraction, this.manningK);
            linkFlow = manning.flow;

            if (depthFraction >= 1.0) {
              const surchargeHead = Math.max(0, currentDepth - maxDepth);
              linkFlow = qFull * (1 + surchargeHead * 0.05);
            }
          }

          const availableVolume = Math.max(0, newVolume);
          const maxFlowFromVolume = availableVolume / dtSeconds / Math.max(1, outgoingLinks.length);
          linkFlow = Math.min(linkFlow, maxFlowFromVolume);
          linkFlow = Math.max(0, linkFlow);

          this.linkFlows.set(link.id, linkFlow);
          totalOutflow += linkFlow;

          const depthFrac = qFull > 0 ? Math.min(1.0, linkFlow / qFull) : 0;
          const manning = manningCircular(D, Math.max(0.001, effectiveSlope), link.roughness, depthFrac, this.manningK);
          linkResults.set(link.id, {
            id: link.id,
            flow: linkFlow,
            velocity: manning.velocity,
            depthFraction: depthFrac,
            capacity: qFull,
          });
        }

        for (const link of outgoingLinks) {
          if (!linkResults.has(link.id)) {
            linkResults.set(link.id, {
              id: link.id,
              flow: 0,
              velocity: 0,
              depthFraction: 0,
              capacity: 1,
            });
          }
        }
      }

      newVolume = Math.max(0, newVolume - totalOutflow * dtSeconds);

      let newDepth = newVolume / storageArea;
      let flooding = 0;
      const maxDepth = node.maxDepth > 0 ? node.maxDepth : 999;

      if (newDepth > maxDepth && node.type !== 'outfall') {
        const excessVolume = (newDepth - maxDepth) * storageArea;
        flooding = excessVolume / dtSeconds;
        newDepth = maxDepth;
        newVolume = maxDepth * storageArea;
        stepFlooding += flooding;
      }

      this.nodeDepths.set(nodeId, newDepth);
      this.nodeVolumes.set(nodeId, newVolume);

      const isSurcharged = node.maxDepth > 0 && newDepth >= node.maxDepth * 0.95;

      nodeResults.set(nodeId, {
        id: nodeId,
        depth: newDepth,
        head: node.invertElev + newDepth,
        volume: newVolume,
        lateralInflow: lateralInflow,
        totalInflow: totalInflow,
        flooding: flooding,
        isSurcharged: isSurcharged,
      });
    }

    this.totalFlooding += stepFlooding * dtSeconds;
    this.totalRunoff += stepRunoff * dtSeconds;

    return {
      time: currentTimeHours,
      nodeResults,
      linkResults,
      totalRainfall: rainfall,
      totalRunoff: stepRunoff,
      totalFlooding: stepFlooding,
    };
  }

  reset() {
    this.nodeDepths.forEach((_, key) => this.nodeDepths.set(key, 0));
    this.nodeVolumes.forEach((_, key) => this.nodeVolumes.set(key, 0));
    this.linkFlows.forEach((_, key) => this.linkFlows.set(key, 0));
    this.totalFlooding = 0;
    this.totalRunoff = 0;
  }

  getTotalFlooding(): number {
    return this.totalFlooding;
  }

  getTotalRunoff(): number {
    return this.totalRunoff;
  }
}

export function applySimStepToModel(
  model: SWMMState,
  stepResult: SimulationStep
): SWMMState {
  const newNodes = model.nodes.map(n => {
    const result = stepResult.nodeResults.get(n.id);
    if (!result) return n;
    return {
      ...n,
      depth: result.depth,
      isSurcharged: result.isSurcharged,
    };
  });

  const newLinks = model.links.map(l => {
    const result = stepResult.linkResults.get(l.id);
    if (!result) return l;
    return {
      ...l,
      flow: result.flow,
    };
  });

  return { ...model, nodes: newNodes, links: newLinks };
}
