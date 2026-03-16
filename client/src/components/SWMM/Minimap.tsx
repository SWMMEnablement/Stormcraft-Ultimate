import React, { useRef, useEffect } from 'react';
import { Node, Link, SteveState } from '@/lib/swmm-types';

interface MinimapProps {
  nodes: Node[];
  links: Link[];
  steve: SteveState;
}

const NODE_COLORS: Record<string, string> = {
  junction: '#9d9d97',
  outfall: '#00bcd4',
  storage: '#FF9800',
  raingauge: '#9C27B0',
};

export function Minimap({ nodes, links, steve }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 160;
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

    ctx.fillStyle = '#0a0a1a';
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
      ctx.fillStyle = NODE_COLORS[node.type] || '#888';
      ctx.fillRect(Math.floor(p.x) - 2, Math.floor(p.y) - 2, 4, 4);
    });

    const stevePos = toScreen(steve.x, steve.y);
    ctx.fillStyle = '#55FF55';
    ctx.fillRect(Math.floor(stevePos.x) - 2, Math.floor(stevePos.y) - 2, 4, 4);

  }, [nodes, links, steve]);

  return (
    <div
      className="absolute top-2 right-2 z-20"
      style={{
        border: '2px solid #aaa',
        background: '#0a0a1a',
        imageRendering: 'pixelated',
      }}
      data-testid="minimap"
    >
      <canvas ref={canvasRef} className="block" style={{ width: 160, height: 120, imageRendering: 'pixelated' }} />
    </div>
  );
}
