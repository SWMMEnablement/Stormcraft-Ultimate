export type NodeType = 'junction' | 'outfall' | 'storage' | 'raingauge';
export type LinkType = 'conduit';
export type SubcatchmentType = 'subcatchment';

export interface Point {
  x: number;
  y: number;
}

export interface Node {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  invertElev: number;
  maxDepth: number;
  depth: number; // Current simulation depth
  isSurcharged: boolean;
}

export interface Link {
  id: string;
  type: LinkType;
  fromNode: string;
  toNode: string;
  length: number;
  roughness: number;
  flow: number; // Current simulation flow
  capacity: number;
}

export interface Subcatchment {
  id: string;
  type: SubcatchmentType;
  points: Point[];
  area: number;
  percentImperv: number;
  outletNode: string | null;
}

export interface SWMMState {
  nodes: Node[];
  links: Link[];
  subcatchments: Subcatchment[];
}

export type Tool = 'select' | 'pan' | 'junction' | 'outfall' | 'storage' | 'conduit' | 'subcatchment' | 'raingauge' | 'delete';
