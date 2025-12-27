import React, { useRef, useEffect } from 'react';
import { Node, Link } from '@/lib/swmm-types';

interface ProfileCanvasProps {
  nodes: Node[];
  links: Link[];
  selectedId: string | null;
  simulationTime: number;
}

export function ProfileCanvas({ nodes, links, selectedId, simulationTime }: ProfileCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize
    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = canvas.parentElement?.clientHeight || 200;

    const render = () => {
        // Clear (Black background for profile as per reference style)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Find a path to draw
        // For mockup: just draw all nodes/links in a linear sequence if connected, 
        // or just draw the selected node and neighbors.
        // Let's draw a simple hardcoded "longitudinal profile" for demonstration if nothing complex is selected.
        
        const pathNodes = nodes; // Just draw all nodes sorted by X for now as a "profile"
        // In real SWMM, this is a graph traversal from upstream to outfall.
        
        if (pathNodes.length < 2) return;

        const padding = 40;
        const graphWidth = canvas.width - padding * 2;
        const graphHeight = canvas.height - padding * 2;

        // Scales
        const minX = Math.min(...pathNodes.map(n => n.x));
        const maxX = Math.max(...pathNodes.map(n => n.x));
        const totalLen = maxX - minX || 1;
        
        const minZ = Math.min(...pathNodes.map(n => n.invertElev));
        const maxZ = Math.max(...pathNodes.map(n => n.invertElev + n.maxDepth + 5)); // +5 buffer
        const elevRange = maxZ - minZ || 10;

        const mapX = (x: number) => padding + ((x - minX) / totalLen) * graphWidth;
        const mapY = (z: number) => canvas.height - padding - ((z - minZ) / elevRange) * graphHeight;

        // Draw Axes
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();

        // Draw Nodes (Manholes)
        pathNodes.forEach(node => {
            const screenX = mapX(node.x);
            const invertY = mapY(node.invertElev);
            const rimY = mapY(node.invertElev + node.maxDepth);
            
            // Manhole shaft
            ctx.fillStyle = '#444';
            ctx.fillRect(screenX - 10, rimY, 20, invertY - rimY);
            ctx.strokeStyle = '#888';
            ctx.strokeRect(screenX - 10, rimY, 20, invertY - rimY);
            
            // Water Level (HGL)
            const hglY = mapY(node.invertElev + node.depth);
            ctx.fillStyle = 'rgba(74, 144, 226, 0.7)'; // Water Blue
            ctx.fillRect(screenX - 8, hglY, 16, invertY - hglY);

            // Labels
            ctx.fillStyle = '#AAA';
            ctx.font = '10px monospace';
            ctx.fillText(node.id, screenX - 10, invertY + 15);
        });

        // Draw Links (Pipes)
        links.forEach(link => {
            const startNode = nodes.find(n => n.id === link.fromNode);
            const endNode = nodes.find(n => n.id === link.toNode);
            if (startNode && endNode) {
                const x1 = mapX(startNode.x);
                const y1 = mapY(startNode.invertElev);
                const x2 = mapX(endNode.x);
                const y2 = mapY(endNode.invertElev);

                // Pipe Line (Invert)
                ctx.strokeStyle = '#FFE66D'; // Yellow for pipe bottom
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
                
                // Crown (Top of pipe) - assume 2ft diameter for visuals
                const y1Top = mapY(startNode.invertElev + 2);
                const y2Top = mapY(endNode.invertElev + 2);
                ctx.strokeStyle = '#FFE66D';
                ctx.setLineDash([2,2]);
                ctx.beginPath();
                ctx.moveTo(x1, y1Top);
                ctx.lineTo(x2, y2Top);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Water in pipe (Linear interpolation of depth)
                ctx.fillStyle = 'rgba(80, 227, 194, 0.5)'; // Flow Cyan
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                
                // HGL at nodes
                const hgl1 = mapY(startNode.invertElev + startNode.depth);
                const hgl2 = mapY(endNode.invertElev + endNode.depth);
                
                ctx.lineTo(x2, hgl2);
                ctx.lineTo(x1, hgl1);
                ctx.closePath();
                ctx.fill();
            }
        });

        // HGL Line (Connecting water surfaces)
        ctx.strokeStyle = '#4A90E2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Simple line connecting water levels
        for (let i = 0; i < pathNodes.length - 1; i++) {
            const n1 = pathNodes[i];
            const n2 = pathNodes[i+1];
            // Only connect if linked
            if (links.some(l => (l.fromNode === n1.id && l.toNode === n2.id) || (l.fromNode === n2.id && l.toNode === n1.id))) {
                ctx.moveTo(mapX(n1.x), mapY(n1.invertElev + n1.depth));
                ctx.lineTo(mapX(n2.x), mapY(n2.invertElev + n2.depth));
            }
        }
        ctx.stroke();
    };

    render();
    // Simple animation loop for water updates
    const anim = requestAnimationFrame(render);
    return () => cancelAnimationFrame(anim);

  }, [nodes, links, simulationTime]);

  return (
    <div className="w-full h-full bg-black border-t-4 border-green-500 relative">
        <div className="absolute top-0 left-0 bg-gray-900 text-green-500 font-sans text-[10px] px-2 py-1 border-b border-r border-gray-600">
            HYDRAULIC PROFILE
        </div>
        <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
