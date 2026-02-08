import React, { useRef, useEffect, useState } from 'react';
import { Node, Link, Subcatchment, Tool, Point, SteveState } from '@/lib/swmm-types';
import { playClick, playPlop } from '@/lib/sound';
import { drawSteve } from '@/lib/steve';

interface MapCanvasProps {
  nodes: Node[];
  links: Link[];
  subcatchments: Subcatchment[];
  tool: Tool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAddNode: (node: Node) => void;
  onAddLink: (link: Link) => void;
  onAddSubcatchment: (subcatchment: Subcatchment) => void;
  is3D: boolean;
  simulationTime: number;
  steve: SteveState;
}

const TILE = 32;

const TERRAIN_COLORS = {
  grass_light: '#5B8C32',
  grass_dark: '#4A7A28',
  grass_accent: '#6B9C3E',
  dirt: '#8B6914',
  dirt_dark: '#6B4F10',
  stone: '#888888',
  stone_dark: '#666666',
  stone_light: '#AAAAAA',
  pavement: '#777777',
  pavement_line: '#999999',
};

const WATER = {
  surface: '#3B7DD8',
  deep: '#2B5DAA',
  highlight: '#6BA8E8',
  flood: '#4A90E2',
  flood_highlight: '#7BB8F0',
};

const PIPE = {
  outer: '#555555',
  inner: '#444444',
  rivet: '#888888',
  flow: '#4A90E2',
  flow_highlight: '#8AC4FF',
};

function seededRandom(x: number, y: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function drawGrassTile(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  const r = seededRandom(tx, ty);
  ctx.fillStyle = r > 0.5 ? TERRAIN_COLORS.grass_light : TERRAIN_COLORS.grass_dark;
  ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);

  ctx.fillStyle = TERRAIN_COLORS.grass_accent;
  for (let i = 0; i < 3; i++) {
    const gx = tx * TILE + seededRandom(tx + i, ty + 7) * (TILE - 2);
    const gy = ty * TILE + seededRandom(tx + 3, ty + i) * (TILE - 2);
    ctx.fillRect(gx, gy, 2, 2);
  }

  if (seededRandom(tx + 5, ty + 5) > 0.85) {
    const fx = tx * TILE + seededRandom(tx + 10, ty) * (TILE - 4);
    const fy = ty * TILE + seededRandom(tx, ty + 10) * (TILE - 6);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(fx + 1, fy + 2, 2, 4);
    ctx.fillStyle = '#228B22';
    ctx.fillRect(fx, fy, 4, 3);
  }
}

function drawPavementTile(ctx: CanvasRenderingContext2D, tx: number, ty: number) {
  ctx.fillStyle = TERRAIN_COLORS.pavement;
  ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);

  ctx.fillStyle = TERRAIN_COLORS.stone_dark;
  ctx.fillRect(tx * TILE, ty * TILE, TILE, 1);
  ctx.fillRect(tx * TILE, ty * TILE, 1, TILE);

  if ((tx + ty) % 3 === 0) {
    ctx.fillStyle = TERRAIN_COLORS.pavement_line;
    ctx.fillRect(tx * TILE + 4, ty * TILE + 4, TILE - 8, 1);
  }
}

interface RainDrop {
  x: number;
  y: number;
  speed: number;
  length: number;
}

interface CloudBlock {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function MapCanvas({
  nodes,
  links,
  subcatchments,
  tool,
  selectedId,
  onSelect,
  onAddNode,
  onAddLink,
  onAddSubcatchment,
  is3D,
  simulationTime,
  steve
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [pendingLinkStart, setPendingLinkStart] = useState<string | null>(null);
  const [pendingPolyPoints, setPendingPolyPoints] = useState<Point[]>([]);
  const rainRef = useRef<RainDrop[]>([]);
  const cloudsRef = useRef<CloudBlock[]>([]);
  const floodAnimRef = useRef(0);

  const screenToWorld = (sx: number, sy: number) => ({
    x: (sx - transform.x) / transform.k,
    y: (sy - transform.y) / transform.k
  });

  const pointToLineDistance = (p: Point, a: { x: number; y: number }, b: { x: number; y: number }) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    return Math.hypot(p.x - px, p.y - py);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    window.addEventListener('resize', resize);
    resize();

    if (cloudsRef.current.length === 0) {
      for (let i = 0; i < 6; i++) {
        cloudsRef.current.push({
          x: Math.random() * 2000 - 500,
          y: -80 + Math.random() * 40,
          w: 80 + Math.random() * 120,
          h: 24 + Math.random() * 16
        });
      }
    }

    let animationFrameId: number;

    const render = () => {
      floodAnimRef.current++;
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = '#87CEEB';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.save();

      if (is3D) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(1, 0.6);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
      }

      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      const viewLeft = -transform.x / transform.k;
      const viewTop = -transform.y / transform.k;
      const viewRight = viewLeft + canvas.width / transform.k;
      const viewBottom = viewTop + canvas.height / transform.k;

      const startTileX = Math.floor(viewLeft / TILE) - 1;
      const startTileY = Math.floor(viewTop / TILE) - 1;
      const endTileX = Math.ceil(viewRight / TILE) + 1;
      const endTileY = Math.ceil(viewBottom / TILE) + 1;

      for (let ty = startTileY; ty <= endTileY; ty++) {
        for (let tx = startTileX; tx <= endTileX; tx++) {
          const nearNode = nodes.some(n =>
            Math.abs(n.x - (tx * TILE + TILE / 2)) < TILE * 2 &&
            Math.abs(n.y - (ty * TILE + TILE / 2)) < TILE * 2
          );
          const nearLink = links.some(l => {
            const from = nodes.find(n => n.id === l.fromNode);
            const to = nodes.find(n => n.id === l.toNode);
            if (!from || !to) return false;
            const cx = tx * TILE + TILE / 2;
            const cy = ty * TILE + TILE / 2;
            return pointToLineDistance({ x: cx, y: cy }, from, to) < TILE * 1.5;
          });

          if (nearNode || nearLink) {
            drawPavementTile(ctx, tx, ty);
          } else {
            drawGrassTile(ctx, tx, ty);
          }
        }
      }

      subcatchments.forEach(sub => {
        if (sub.points.length > 0) {
          ctx.beginPath();
          ctx.moveTo(sub.points[0].x, sub.points[0].y);
          sub.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.closePath();

          ctx.fillStyle = 'rgba(46, 139, 87, 0.35)';
          ctx.fill();

          ctx.strokeStyle = selectedId === sub.id ? '#FFFFFF' : '#2E8B57';
          ctx.lineWidth = selectedId === sub.id ? 4 : 2;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      if (pendingPolyPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(pendingPolyPoints[0].x, pendingPolyPoints[0].y);
        pendingPolyPoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = '#2E8B57';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      links.forEach(link => {
        const start = nodes.find(n => n.id === link.fromNode);
        const end = nodes.find(n => n.id === link.toNode);
        if (!start || !end) return;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const len = Math.hypot(dx, dy);
        if (len === 0) return;
        const nx = -dy / len;
        const ny = dx / len;

        const pipeW = is3D ? 12 : 8;
        const halfW = pipeW / 2;

        ctx.fillStyle = PIPE.outer;
        ctx.beginPath();
        ctx.moveTo(start.x + nx * halfW, start.y + ny * halfW);
        ctx.lineTo(end.x + nx * halfW, end.y + ny * halfW);
        ctx.lineTo(end.x - nx * halfW, end.y - ny * halfW);
        ctx.lineTo(start.x - nx * halfW, start.y - ny * halfW);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = PIPE.inner;
        const innerW = halfW - 1.5;
        ctx.beginPath();
        ctx.moveTo(start.x + nx * innerW, start.y + ny * innerW);
        ctx.lineTo(end.x + nx * innerW, end.y + ny * innerW);
        ctx.lineTo(end.x - nx * innerW, end.y - ny * innerW);
        ctx.lineTo(start.x - nx * innerW, start.y - ny * innerW);
        ctx.closePath();
        ctx.fill();

        const rivetCount = Math.floor(len / 24);
        ctx.fillStyle = PIPE.rivet;
        for (let i = 0; i <= rivetCount; i++) {
          const t = i / Math.max(1, rivetCount);
          const rx = start.x + dx * t;
          const ry = start.y + dy * t;
          ctx.fillRect(rx + nx * (halfW - 1) - 1, ry + ny * (halfW - 1) - 1, 2, 2);
          ctx.fillRect(rx - nx * (halfW - 1) - 1, ry - ny * (halfW - 1) - 1, 2, 2);
        }

        if (link.flow > 0) {
          const flowH = Math.min(innerW * 2, link.flow * 2);
          ctx.fillStyle = PIPE.flow;
          ctx.globalAlpha = 0.7;
          const fHalf = flowH / 2;
          ctx.beginPath();
          ctx.moveTo(start.x + nx * fHalf, start.y + ny * fHalf);
          ctx.lineTo(end.x + nx * fHalf, end.y + ny * fHalf);
          ctx.lineTo(end.x - nx * fHalf, end.y - ny * fHalf);
          ctx.lineTo(start.x - nx * fHalf, start.y - ny * fHalf);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;

          const timeOffset = (floodAnimRef.current * 0.03) * Math.max(0.5, link.flow);
          for (let i = 0; i < 5; i++) {
            const t = ((timeOffset + i / 5) % 1);
            const px = start.x + dx * t;
            const py = start.y + dy * t;
            ctx.fillStyle = PIPE.flow_highlight;
            ctx.fillRect(px - 1, py - 1, 3, 3);
          }
        }

        if (selectedId === link.id) {
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(start.x + nx * (halfW + 2), start.y + ny * (halfW + 2));
          ctx.lineTo(end.x + nx * (halfW + 2), end.y + ny * (halfW + 2));
          ctx.lineTo(end.x - nx * (halfW + 2), end.y - ny * (halfW + 2));
          ctx.lineTo(start.x - nx * (halfW + 2), start.y - ny * (halfW + 2));
          ctx.closePath();
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });

      if (pendingLinkStart) {
        const startNode = nodes.find(n => n.id === pendingLinkStart);
        if (startNode) {
          const mouseWorld = screenToWorld(lastMouse.x, lastMouse.y);
          ctx.beginPath();
          ctx.moveTo(startNode.x, startNode.y);
          ctx.lineTo(mouseWorld.x, mouseWorld.y);
          ctx.strokeStyle = '#50E3C2';
          ctx.lineWidth = 3;
          ctx.setLineDash([6, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      nodes.forEach(node => {
        const x = node.x;
        const y = node.y;
        const S = is3D ? 20 : 14;
        const half = S / 2;

        if (node.type === 'junction') {
          if (is3D) {
            ctx.fillStyle = '#444';
            ctx.fillRect(x - half + 3, y - half + 3, S, S);
          }
          ctx.fillStyle = TERRAIN_COLORS.stone_dark;
          ctx.fillRect(x - half, y - half, S, S);
          ctx.fillStyle = TERRAIN_COLORS.stone;
          ctx.fillRect(x - half + 1, y - half + 1, S - 2, S - 2);
          ctx.fillStyle = TERRAIN_COLORS.stone_light;
          ctx.fillRect(x - half + 2, y - half + 2, S - 4, 1);
          ctx.fillRect(x - half + 2, y - half + 2, 1, S - 4);

          ctx.fillStyle = '#333';
          ctx.beginPath();
          ctx.arc(x, y, half * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#555';
          ctx.fillRect(x - 2, y - half * 0.4, 4, 1);
          ctx.fillRect(x - half * 0.4, y - 2, 1, 4);
        } else if (node.type === 'outfall') {
          if (is3D) {
            ctx.fillStyle = '#2a6b5a';
            ctx.fillRect(x - half + 3, y - half + 3, S, S);
          }
          ctx.fillStyle = '#2E8B57';
          ctx.fillRect(x - half, y - half, S, S);
          ctx.fillStyle = '#3CB371';
          ctx.fillRect(x - half + 1, y - half + 1, S - 2, S - 2);

          ctx.fillStyle = WATER.surface;
          ctx.fillRect(x - half + 3, y - 2, S - 6, 4);
          const waveY = Math.sin(floodAnimRef.current * 0.1) * 1;
          ctx.fillStyle = WATER.highlight;
          ctx.fillRect(x - 2, y - 1 + waveY, 4, 1);

          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(x + half - 4, y - 3);
          ctx.lineTo(x + half - 1, y);
          ctx.lineTo(x + half - 4, y + 3);
          ctx.fill();
        } else if (node.type === 'storage') {
          if (is3D) {
            ctx.fillStyle = '#8B7500';
            ctx.fillRect(x - half + 3, y - half + 3, S, S + 4);
          }
          ctx.fillStyle = '#B8860B';
          ctx.fillRect(x - half, y - half, S, S + 4);
          ctx.fillStyle = '#DAA520';
          ctx.fillRect(x - half + 1, y - half + 1, S - 2, S + 2);

          const fillPct = node.maxDepth > 0 ? Math.min(1, node.depth / node.maxDepth) : 0;
          const fillH = Math.floor((S + 2) * fillPct);
          if (fillH > 0) {
            ctx.fillStyle = WATER.surface;
            ctx.fillRect(x - half + 2, y - half + 1 + (S + 2 - fillH), S - 4, fillH);
          }
        } else if (node.type === 'raingauge') {
          ctx.fillStyle = '#6A1B9A';
          ctx.fillRect(x - half, y - half, S, S);
          ctx.fillStyle = '#9C27B0';
          ctx.fillRect(x - half + 1, y - half + 1, S - 2, S - 2);

          ctx.fillStyle = WATER.surface;
          const drops = Math.floor(floodAnimRef.current / 8) % 4;
          for (let d = 0; d < drops; d++) {
            ctx.fillRect(x - 2 + d * 3, y - half + 3 + d * 2, 2, 3);
          }
        }

        if (node.depth > 0 && node.type !== 'storage') {
          const depthScale = Math.min(1, node.depth / Math.max(1, node.maxDepth));
          const floodR = half + depthScale * half;
          const waveOffset = Math.sin(floodAnimRef.current * 0.08 + node.x * 0.01) * 2;

          ctx.globalAlpha = 0.3 + depthScale * 0.3;
          ctx.fillStyle = WATER.flood;
          const blockCount = Math.ceil(depthScale * 4);
          for (let b = 0; b < blockCount; b++) {
            const angle = (b / blockCount) * Math.PI * 2 + floodAnimRef.current * 0.02;
            const bx = x + Math.cos(angle) * floodR;
            const by = y + Math.sin(angle) * floodR + waveOffset;
            ctx.fillRect(bx - 3, by - 3, 6, 6);
          }

          if (depthScale > 0.5) {
            ctx.fillStyle = WATER.flood;
            ctx.globalAlpha = 0.25;
            const spreadR = half + 4;
            ctx.fillRect(x - spreadR, y - spreadR + waveOffset, spreadR * 2, spreadR * 2);
            ctx.fillStyle = WATER.flood_highlight;
            ctx.globalAlpha = 0.15;
            ctx.fillRect(x - spreadR + 2, y - spreadR + 2 + waveOffset, spreadR, 2);
          }
          ctx.globalAlpha = 1;

          if (node.isSurcharged) {
            const pulse = Math.sin(floodAnimRef.current * 0.15) * 0.5 + 0.5;
            ctx.strokeStyle = `rgba(231, 76, 60, ${0.5 + pulse * 0.5})`;
            ctx.lineWidth = 2;
            const r = half + 6 + pulse * 4;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#E74C3C';
            ctx.font = 'bold 10px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('!', x, y - half - 8);
          }
        }

        if (selectedId === node.id) {
          const pulseSize = Math.sin(floodAnimRef.current * 0.08) * 2;
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 2]);
          ctx.strokeRect(
            x - half - 3 - pulseSize,
            y - half - 3 - pulseSize,
            S + 6 + pulseSize * 2,
            S + 6 + pulseSize * 2
          );
          ctx.setLineDash([]);
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '8px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 2;
        ctx.fillText(node.id, x, y + half + 10);
        ctx.shadowBlur = 0;
      });

      if (simulationTime > 0) {
        const stormPeak = 6;
        const dist = Math.abs(simulationTime - stormPeak);
        const rainIntensity = Math.max(0, Math.exp(-dist * 0.3));

        if (rainIntensity > 0.05) {
          const targetDrops = Math.floor(rainIntensity * 150);
          while (rainRef.current.length < targetDrops) {
            rainRef.current.push({
              x: viewLeft + Math.random() * (viewRight - viewLeft),
              y: viewTop + Math.random() * (viewBottom - viewTop),
              speed: 4 + Math.random() * 6,
              length: 4 + Math.random() * 8
            });
          }
          while (rainRef.current.length > targetDrops) {
            rainRef.current.pop();
          }

          ctx.strokeStyle = `rgba(100, 160, 230, ${0.4 + rainIntensity * 0.3})`;
          ctx.lineWidth = 1.5;
          rainRef.current.forEach(drop => {
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x - 1, drop.y + drop.length);
            ctx.stroke();
            drop.y += drop.speed;
            if (drop.y > viewBottom + 20) {
              drop.y = viewTop - 10;
              drop.x = viewLeft + Math.random() * (viewRight - viewLeft);
            }
          });

          cloudsRef.current.forEach(cloud => {
            const cx = cloud.x;
            const cy = viewTop + cloud.y;
            ctx.fillStyle = `rgba(180, 190, 200, ${0.6 + rainIntensity * 0.3})`;

            const blockSize = 16;
            const cols = Math.ceil(cloud.w / blockSize);
            const rows = Math.ceil(cloud.h / blockSize);
            for (let r = 0; r < rows; r++) {
              const rowShrink = r === 0 ? 1 : (r === rows - 1 ? 1 : 0);
              for (let c = rowShrink; c < cols - rowShrink; c++) {
                ctx.fillRect(cx + c * blockSize, cy + r * blockSize, blockSize - 1, blockSize - 1);
              }
            }
            ctx.fillStyle = `rgba(200, 210, 220, ${0.3 + rainIntensity * 0.2})`;
            for (let c = 1; c < cols - 1; c++) {
              ctx.fillRect(cx + c * blockSize + 2, cy + 2, blockSize - 4, 4);
            }

            cloud.x += 0.15;
            if (cloud.x > viewRight + 50) {
              cloud.x = viewLeft - cloud.w - 50;
            }
          });
        } else {
          rainRef.current = [];
        }
      }

      drawSteve(ctx, steve, transform, is3D);

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [nodes, links, subcatchments, transform, selectedId, pendingLinkStart, pendingPolyPoints, is3D, lastMouse, steve, simulationTime]);


  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld(x, y);

    if (tool === 'pan') {
      setIsDragging(true);
      setLastMouse({ x, y });
      return;
    }

    const hitNode = nodes.find(n =>
      Math.abs(n.x - worldPos.x) < 15 && Math.abs(n.y - worldPos.y) < 15
    );

    if (tool === 'select') {
      if (hitNode) {
        playClick();
        onSelect(hitNode.id);
      } else {
        const hitSub = subcatchments.find(sub => {
          if (sub.points.length < 3) return false;
          let inside = false;
          for (let i = 0, j = sub.points.length - 1; i < sub.points.length; j = i++) {
            const xi = sub.points[i].x, yi = sub.points[i].y;
            const xj = sub.points[j].x, yj = sub.points[j].y;
            if (((yi > worldPos.y) !== (yj > worldPos.y)) &&
                (worldPos.x < (xj - xi) * (worldPos.y - yi) / (yj - yi) + xi)) {
              inside = !inside;
            }
          }
          return inside;
        });

        if (hitSub) {
          playClick();
          onSelect(hitSub.id);
        } else {
          const hitLink = links.find(link => {
            const fromNode = nodes.find(n => n.id === link.fromNode);
            const toNode = nodes.find(n => n.id === link.toNode);
            if (!fromNode || !toNode) return false;
            return pointToLineDistance(worldPos, fromNode, toNode) < 10;
          });

          if (hitLink) {
            playClick();
            onSelect(hitLink.id);
          } else {
            onSelect(null);
          }
        }
      }
    } else if (['junction', 'outfall', 'storage', 'raingauge'].includes(tool)) {
      playPlop();
      const newNode: Node = {
        id: `${tool.charAt(0).toUpperCase()}${nodes.length + 1}`,
        type: tool as any,
        x: worldPos.x,
        y: worldPos.y,
        invertElev: 100,
        maxDepth: 10,
        depth: 0,
        isSurcharged: false
      };
      onAddNode(newNode);
      onSelect(newNode.id);
    } else if (tool === 'conduit') {
      if (hitNode) {
        playClick();
        if (!pendingLinkStart) {
          setPendingLinkStart(hitNode.id);
        } else if (pendingLinkStart !== hitNode.id) {
          playPlop();
          const newLink: Link = {
            id: `C${links.length + 1}`,
            type: 'conduit',
            fromNode: pendingLinkStart,
            toNode: hitNode.id,
            length: Math.hypot(hitNode.x - nodes.find(n => n.id === pendingLinkStart)!.x, hitNode.y - nodes.find(n => n.id === pendingLinkStart)!.y),
            roughness: 0.013,
            flow: 0,
            capacity: 10
          };
          onAddLink(newLink);
          setPendingLinkStart(null);
        }
      } else {
        setPendingLinkStart(null);
      }
    } else if (tool === 'subcatchment') {
      playClick();
      setPendingPolyPoints([...pendingPolyPoints, worldPos]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const dx = x - lastMouse.x;
      const dy = y - lastMouse.y;
      setTransform(t => ({ ...t, x: t.x + dx, y: t.y + dy }));
    }

    setLastMouse({ x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (tool === 'subcatchment' && pendingPolyPoints.length > 2) {
      playPlop();
      const newSub: Subcatchment = {
        id: `S${subcatchments.length + 1}`,
        type: 'subcatchment',
        points: [...pendingPolyPoints],
        area: 5,
        percentImperv: 50,
        outletNode: null
      };
      onAddSubcatchment(newSub);
      setPendingPolyPoints([]);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomSensitivity = 0.001;
    const newK = Math.max(0.1, Math.min(5, transform.k - e.deltaY * zoomSensitivity));
    setTransform(t => ({ ...t, k: newK }));
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid="map-canvas"
      className="w-full h-full cursor-crosshair block touch-none"
      style={{ imageRendering: 'pixelated' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    />
  );
}
