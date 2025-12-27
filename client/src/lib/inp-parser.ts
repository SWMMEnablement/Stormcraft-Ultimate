import { SWMMState, Node, Link, Subcatchment, Point } from './swmm-types';

export function parseInpFile(content: string): SWMMState {
  const lines = content.split('\n').map(line => line.trim());
  
  const nodes: Node[] = [];
  const links: Link[] = [];
  const subcatchments: Subcatchment[] = [];
  
  let currentSection = '';
  const coordinates: Map<string, { x: number; y: number }> = new Map();
  const polygons: Map<string, Point[]> = new Map();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines and comments
    if (!line || line.startsWith(';')) continue;
    
    // Section header
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line.slice(1, -1).toUpperCase();
      continue;
    }
    
    // Parse based on section
    const parts = line.split(/\s+/).filter(p => p);
    if (parts.length === 0) continue;
    
    switch (currentSection) {
      case 'JUNCTIONS':
        if (parts.length >= 2) {
          nodes.push({
            id: parts[0],
            type: 'junction',
            x: 0, // Will be set from COORDINATES
            y: 0,
            invertElev: parseFloat(parts[1]) || 0,
            maxDepth: parseFloat(parts[2]) || 10,
            depth: 0,
            isSurcharged: false,
          });
        }
        break;
        
      case 'OUTFALLS':
        if (parts.length >= 2) {
          nodes.push({
            id: parts[0],
            type: 'outfall',
            x: 0,
            y: 0,
            invertElev: parseFloat(parts[1]) || 0,
            maxDepth: 0,
            depth: 0,
            isSurcharged: false,
          });
        }
        break;
        
      case 'STORAGE':
        if (parts.length >= 2) {
          nodes.push({
            id: parts[0],
            type: 'storage',
            x: 0,
            y: 0,
            invertElev: parseFloat(parts[1]) || 0,
            maxDepth: parseFloat(parts[2]) || 10,
            depth: 0,
            isSurcharged: false,
          });
        }
        break;
        
      case 'RAINGAGES':
        if (parts.length >= 1) {
          nodes.push({
            id: parts[0],
            type: 'raingauge',
            x: 0,
            y: 0,
            invertElev: 0,
            maxDepth: 0,
            depth: 0,
            isSurcharged: false,
          });
        }
        break;
        
      case 'CONDUITS':
        if (parts.length >= 3) {
          links.push({
            id: parts[0],
            type: 'conduit',
            fromNode: parts[1],
            toNode: parts[2],
            length: parseFloat(parts[3]) || 100,
            roughness: parseFloat(parts[4]) || 0.013,
            flow: 0,
            capacity: 10,
          });
        }
        break;
        
      case 'SUBCATCHMENTS':
        if (parts.length >= 3) {
          subcatchments.push({
            id: parts[0],
            type: 'subcatchment',
            points: [], // Will be set from POLYGONS
            area: parseFloat(parts[3]) || 5,
            percentImperv: parseFloat(parts[4]) || 50,
            outletNode: parts[2] || null,
          });
        }
        break;
        
      case 'COORDINATES':
        if (parts.length >= 3) {
          coordinates.set(parts[0], {
            x: parseFloat(parts[1]) || 0,
            y: parseFloat(parts[2]) || 0,
          });
        }
        break;
        
      case 'POLYGONS':
        if (parts.length >= 3) {
          const polyId = parts[0];
          const point = { x: parseFloat(parts[1]) || 0, y: parseFloat(parts[2]) || 0 };
          if (!polygons.has(polyId)) {
            polygons.set(polyId, []);
          }
          polygons.get(polyId)!.push(point);
        }
        break;
    }
  }
  
  // Apply coordinates to nodes
  nodes.forEach(node => {
    const coord = coordinates.get(node.id);
    if (coord) {
      node.x = coord.x;
      node.y = coord.y;
    }
  });
  
  // Apply polygons to subcatchments
  subcatchments.forEach(sub => {
    const poly = polygons.get(sub.id);
    if (poly) {
      sub.points = poly;
    }
  });
  
  // Normalize coordinates to fit on screen (0-800 range)
  const allX = nodes.map(n => n.x).filter(x => x !== 0);
  const allY = nodes.map(n => n.y).filter(y => y !== 0);
  
  if (allX.length > 0 && allY.length > 0) {
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;
    const scale = Math.min(600 / rangeX, 400 / rangeY);
    
    nodes.forEach(node => {
      if (node.x !== 0 || node.y !== 0) {
        node.x = (node.x - minX) * scale + 100;
        node.y = (maxY - node.y) * scale + 100; // Flip Y axis
      }
    });
    
    subcatchments.forEach(sub => {
      sub.points = sub.points.map(p => ({
        x: (p.x - minX) * scale + 100,
        y: (maxY - p.y) * scale + 100,
      }));
    });
  }
  
  // Assign default coordinates to nodes without them
  let defaultX = 100;
  nodes.forEach(node => {
    if (node.x === 0 && node.y === 0) {
      node.x = defaultX;
      node.y = 300;
      defaultX += 100;
    }
  });
  
  return { nodes, links, subcatchments };
}
