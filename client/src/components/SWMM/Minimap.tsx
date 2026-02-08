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

    canvas.width = 120;
    canvas.height = 120;
    ctx.imageSmoothingEnabled = false;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    });

    const padding = 50;
    minX -= padding; minY -= padding;
    maxX += padding; maxY += padding;

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const scale = Math.min(canvas.width / width, canvas.height / height);
    const offsetX = (canvas.width - width * scale) / 2;
    const offsetY = (canvas.height - height * scale) / 2;

    const toScreen = (x: number, y: number) => ({
      x: (x - minX) * scale + offsetX,
      y: (y - minY) * scale + offsetY
    });

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    links.forEach(link => {
      const start = nodes.find(n => n.id === link.fromNode);
      const end = nodes.find(n => n.id === link.toNode);
      if (start && end) {
        const p1 = toScreen(start.x, start.y);
        const p2 = toScreen(end.x, end.y);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });

    nodes.forEach(node => {
      const p = toScreen(node.x, node.y);
      if (node.type === 'junction') ctx.fillStyle = '#888';
      else if (node.type === 'outfall') ctx.fillStyle = '#3CB371';
      else if (node.type === 'storage') ctx.fillStyle = '#DAA520';
      else ctx.fillStyle = '#9C27B0';
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });

    const stevePos = toScreen(steve.x, steve.y);
    ctx.fillStyle = '#00DDAA';
    ctx.fillRect(stevePos.x - 2, stevePos.y - 2, 4, 4);

  }, [nodes, links, steve]);

  return (
    <div className="absolute top-4 right-4 border-2 border-gray-600 bg-black/80 shadow-lg z-20" data-testid="minimap">
      <canvas ref={canvasRef} className="block" style={{ width: 120, height: 120, imageRendering: 'pixelated' }} />
    </div>
  );
}
