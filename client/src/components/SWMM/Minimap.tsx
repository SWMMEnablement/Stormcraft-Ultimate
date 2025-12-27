import React, { useRef, useEffect } from 'react';
import { Node, Link, SteveState } from '@/lib/swmm-types';

interface MinimapProps {
  nodes: Node[];
  links: Link[];
  steve: SteveState;
}

export function Minimap({ nodes, links, steve }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize
    canvas.width = 150;
    canvas.height = 150;

    // Calculate bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    });
    
    // Add padding
    const padding = 50;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;
    
    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    
    // Scale to fit
    const scale = Math.min(canvas.width / width, canvas.height / height);
    
    // Center
    const offsetX = (canvas.width - width * scale) / 2;
    const offsetY = (canvas.height - height * scale) / 2;

    const toScreen = (x: number, y: number) => ({
      x: (x - minX) * scale + offsetX,
      y: (y - minY) * scale + offsetY
    });

    // Clear
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Links
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    links.forEach(link => {
       const start = nodes.find(n => n.id === link.fromNode);
       const end = nodes.find(n => n.id === link.toNode);
       if (start && end) {
           const p1 = toScreen(start.x, start.y);
           const p2 = toScreen(end.x, end.y);
           ctx.moveTo(p1.x, p1.y);
           ctx.lineTo(p2.x, p2.y);
       }
    });
    ctx.stroke();

    // Draw Nodes
    ctx.fillStyle = '#4A90E2';
    nodes.forEach(node => {
        const p = toScreen(node.x, node.y);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });

    // Draw Steve (Cyan Dot)
    const stevePos = toScreen(steve.x, steve.y);
    ctx.fillStyle = '#00AAAA'; // Steve Shirt Cyan
    ctx.beginPath();
    ctx.arc(stevePos.x, stevePos.y, 4, 0, Math.PI * 2);
    ctx.fill();

  }, [nodes, links, steve]);

  return (
    <div className="absolute top-4 right-4 border-2 border-white bg-black shadow-lg z-10">
      <canvas ref={canvasRef} className="block w-[150px] h-[150px]" />
    </div>
  );
}
