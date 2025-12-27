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
  
  // Pending operations state
  const [pendingLinkStart, setPendingLinkStart] = useState<string | null>(null);
  const [pendingPolyPoints, setPendingPolyPoints] = useState<Point[]>([]);

  // Colors
  const COLORS = {
    junction: '#FF6B6B',
    outfall: '#4ECDC4',
    storage: '#FFE66D',
    raingauge: '#9B59B6',
    conduit: '#50E3C2',
    subcatchment: 'rgba(46, 204, 113, 0.4)',
    water: '#4A90E2',
    selected: '#FFFFFF',
    grid: '#CCCCCC'
  };

  // Helper to convert screen to world coordinates
  const screenToWorld = (sx: number, sy: number) => {
    return {
      x: (sx - transform.x) / transform.k,
      y: (sy - transform.y) / transform.k
    };
  };

  const worldToScreen = (wx: number, wy: number) => {
    return {
      x: wx * transform.k + transform.x,
      y: wy * transform.k + transform.y
    };
  };

  // Helper: distance from point to line segment
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

    // Resize canvas
    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    window.addEventListener('resize', resize);
    resize();

    // Draw Loop
    let animationFrameId: number;

    const render = () => {
      // Clear
      ctx.fillStyle = is3D ? '#87CEEB' : '#F5F5F5'; // Sky blue in 3D, Light Grey in 2D
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Save context for transform
      ctx.save();
      
      // Apply 3D tilt if enabled
      if (is3D) {
         // Simple 2.5D projection simulation by scaling Y
         ctx.translate(canvas.width/2, canvas.height/2);
         ctx.scale(1, 0.6); // Squash Y axis
         ctx.translate(-canvas.width/2, -canvas.height/2);
      }

      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      // Grid
      if (!is3D) {
        ctx.strokeStyle = COLORS.grid;
        ctx.lineWidth = 1 / transform.k;
        ctx.beginPath();
        const gridSize = 50;
        const startX = Math.floor(-transform.x / transform.k / gridSize) * gridSize;
        const startY = Math.floor(-transform.y / transform.k / gridSize) * gridSize;
        const endX = startX + canvas.width / transform.k + gridSize;
        const endY = startY + canvas.height / transform.k + gridSize;

        for (let x = startX; x < endX; x += gridSize) {
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
        }
        for (let y = startY; y < endY; y += gridSize) {
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
        }
        ctx.stroke();
      }

      // Draw Subcatchments
      subcatchments.forEach(sub => {
        ctx.beginPath();
        if (sub.points.length > 0) {
          ctx.moveTo(sub.points[0].x, sub.points[0].y);
          sub.points.forEach(p => ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.fillStyle = COLORS.subcatchment;
          ctx.fill();
          ctx.strokeStyle = '#2ECC71';
          ctx.lineWidth = 2;
          if (selectedId === sub.id) {
            ctx.strokeStyle = COLORS.selected;
            ctx.lineWidth = 4;
          }
          ctx.stroke();
        }
      });

      // Pending Polygon
      if (pendingPolyPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(pendingPolyPoints[0].x, pendingPolyPoints[0].y);
        pendingPolyPoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = '#2ECC71';
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Links
      links.forEach(link => {
        const start = nodes.find(n => n.id === link.fromNode);
        const end = nodes.find(n => n.id === link.toNode);
        if (start && end) {
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.lineWidth = is3D ? 8 : 4;
          ctx.strokeStyle = '#7f8c8d'; // Pipe color
          if (selectedId === link.id) {
            ctx.strokeStyle = COLORS.selected;
          }
          ctx.stroke();
          
          // Flow visualization (Water inside pipe)
          const flowWidth = is3D ? 6 : 2;
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.lineWidth = flowWidth;
          ctx.strokeStyle = COLORS.water;
          ctx.stroke();
          
          // Flow particles
          if (link.flow > 0) {
            const timeOffset = (Date.now() / 1000) * link.flow; // Speed based on flow
            const particleCount = 3;
            for(let i=0; i<particleCount; i++) {
               const t = ((timeOffset + i/particleCount) % 1);
               const px = start.x + (end.x - start.x) * t;
               const py = start.y + (end.y - start.y) * t;
               
               ctx.fillStyle = '#FFFFFF';
               ctx.beginPath();
               ctx.arc(px, py, is3D ? 2 : 1.5, 0, Math.PI * 2);
               ctx.fill();
            }
          }
        }
      });

      // Pending Link Line
      if (pendingLinkStart) {
        const startNode = nodes.find(n => n.id === pendingLinkStart);
        if (startNode) {
          const mouseWorld = screenToWorld(lastMouse.x, lastMouse.y);
          ctx.beginPath();
          ctx.moveTo(startNode.x, startNode.y);
          ctx.lineTo(mouseWorld.x, mouseWorld.y);
          ctx.strokeStyle = COLORS.conduit;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Draw Nodes
      nodes.forEach(node => {
        // Shadow
        if (is3D) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(node.x - 8, node.y - 8 + 5, 20, 20); // Offset shadow
        }

        ctx.fillStyle = COLORS[node.type] || '#999';
        
        // Blocky Node representation
        const size = is3D ? 24 : 16;
        const offset = size / 2;
        
        ctx.fillRect(node.x - offset, node.y - offset, size, size);
        
        // 3D sides
        if (is3D) {
            ctx.fillStyle = 'rgba(0,0,0,0.2)'; // Side shade
            ctx.fillRect(node.x - offset + size, node.y - offset, 5, size); // Right side
            ctx.fillStyle = 'rgba(0,0,0,0.4)'; // Bottom shade
            ctx.fillRect(node.x - offset, node.y - offset + size, size, 5); // Bottom side
            ctx.fillStyle = 'rgba(0,0,0,0.5)'; // Corner
            ctx.fillRect(node.x - offset + size, node.y - offset + size, 5, 5);
        }

        // Selection highlight
        if (selectedId === node.id) {
          ctx.strokeStyle = COLORS.selected;
          ctx.lineWidth = 2;
          ctx.strokeRect(node.x - offset - 2, node.y - offset - 2, size + 4, size + 4);
        }

        // Water Level Indicator (Bar above node)
        if (node.depth > 0) {
           const barHeight = node.depth * 5; // Scale factor
           const barWidth = 4;
           ctx.fillStyle = COLORS.water;
           ctx.fillRect(node.x + offset + 2, node.y - offset - barHeight, barWidth, barHeight);
           // Surcharge warning
           if (node.depth >= node.maxDepth) {
               ctx.fillStyle = '#E74C3C';
               ctx.beginPath();
               ctx.arc(node.x, node.y - offset - 10, 3, 0, Math.PI * 2);
               ctx.fill();
           }
        }
      });

      // Draw Steve
      drawSteve(ctx, steve, transform, is3D);

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [nodes, links, subcatchments, transform, selectedId, pendingLinkStart, pendingPolyPoints, is3D, lastMouse, steve]);


  // Interaction Handlers
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

    // Hit testing
    const hitNode = nodes.find(n => 
      Math.abs(n.x - worldPos.x) < 15 && Math.abs(n.y - worldPos.y) < 15
    );

    if (tool === 'select') {
      if (hitNode) {
        playClick();
        onSelect(hitNode.id);
      } else {
        // Check subcatchments (point-in-polygon test)
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
          // Check links
          const hitLink = links.find(link => {
            const fromNode = nodes.find(n => n.id === link.fromNode);
            const toNode = nodes.find(n => n.id === link.toNode);
            if (!fromNode || !toNode) return false;
            const dist = pointToLineDistance(worldPos, fromNode, toNode);
            return dist < 10;
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
      playPlop(); // Sound effect
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
            // Create link
            const newLink: Link = {
              id: `C${links.length + 1}`,
              type: 'conduit',
              fromNode: pendingLinkStart,
              toNode: hitNode.id,
              length: Math.hypot(hitNode.x - nodes.find(n=>n.id===pendingLinkStart)!.x, hitNode.y - nodes.find(n=>n.id===pendingLinkStart)!.y),
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
       // Polygon drawing logic
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
    
    // Zoom towards pointer logic omitted for brevity, simplified zoom center
    setTransform(t => ({ ...t, k: newK }));
  };

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair block touch-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    />
  );
}
