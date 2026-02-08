import React, { useRef, useEffect, useState, useCallback } from 'react';
import { SteveState } from '@/lib/swmm-types';
import { drawSteve, INITIAL_STEVE } from '@/lib/steve';

interface DemoOverlayProps {
  onDismiss: () => void;
}

const COLORS = {
  junction: '#FF6B6B',
  outfall: '#4ECDC4',
  conduit: '#50E3C2',
  water: '#4A90E2',
  grid: '#CCCCCC',
};

interface DemoNode {
  id: string;
  x: number;
  y: number;
  type: 'junction' | 'outfall';
  depth: number;
  maxDepth: number;
  opacity: number;
}

interface DemoLink {
  fromId: string;
  toId: string;
  flow: number;
  drawProgress: number;
}

type Phase =
  | 'intro'
  | 'steve_walks_to_spot'
  | 'place_junction_prompt'
  | 'click_junction_1'
  | 'steve_walks_to_spot_2'
  | 'place_junction_prompt_2'
  | 'click_junction_2'
  | 'steve_walks_to_spot_3'
  | 'place_outfall_prompt'
  | 'click_outfall'
  | 'conduit_prompt'
  | 'draw_conduit_1'
  | 'draw_conduit_2'
  | 'rain_start'
  | 'simulation'
  | 'celebrate'
  | 'tagline';

export function DemoOverlay({ onDismiss }: DemoOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const phaseRef = useRef<Phase>('intro');
  const tickRef = useRef(0);
  const nodesRef = useRef<DemoNode[]>([]);
  const linksRef = useRef<DemoLink[]>([]);
  const steveRef = useRef<SteveState>({
    ...INITIAL_STEVE,
    x: 80, y: 300,
  });
  const rainDropsRef = useRef<{ x: number; y: number; speed: number }[]>([]);
  const cursorRef = useRef<{ x: number; y: number; visible: boolean; clicking: boolean }>({
    x: 0, y: 0, visible: false, clicking: false
  });
  const taglineOpacityRef = useRef(0);
  const phaseTickRef = useRef(0);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (dismissed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 900;
    const H = 500;

    const junctionSpot1 = { x: 250, y: 250 };
    const junctionSpot2 = { x: 450, y: 280 };
    const outfallSpot = { x: 650, y: 310 };

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };
    resize();
    window.addEventListener('resize', resize);

    const scaleX = () => canvas.width / W;
    const scaleY = () => canvas.height / H;

    function setPhase(p: Phase) {
      phaseRef.current = p;
      phaseTickRef.current = 0;
    }

    function moveSteveTo(tx: number, ty: number, speed: number): boolean {
      const s = steveRef.current;
      const dx = tx - s.x;
      const dy = ty - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist < speed) {
        s.x = tx;
        s.y = ty;
        return true;
      }
      s.x += (dx / dist) * speed;
      s.y += (dy / dist) * speed;
      s.facingRight = dx > 0;
      s.action = 'walking' as const;
      return false;
    }

    function moveCursorTo(tx: number, ty: number, speed: number): boolean {
      const c = cursorRef.current;
      const dx = tx - c.x;
      const dy = ty - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist < speed) {
        c.x = tx;
        c.y = ty;
        return true;
      }
      c.x += (dx / dist) * speed;
      c.y += (dy / dist) * speed;
      return false;
    }

    function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 0.5;
      ctx.globalAlpha = 0.4;
      for (let x = 0; x < w; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function drawDemoSteve(ctx: CanvasRenderingContext2D, s: SteveState) {
      drawSteve(ctx, s, { x: 0, y: 0, k: 1 }, false);
    }

    function drawDemoNode(ctx: CanvasRenderingContext2D, n: DemoNode) {
      ctx.save();
      ctx.globalAlpha = n.opacity;
      const size = 16;
      const offset = size / 2;

      if (n.opacity > 0.5) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(n.x, n.y, 14 + Math.sin(tickRef.current * 0.1) * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = COLORS[n.type];
      ctx.fillRect(n.x - offset, n.y - offset, size, size);

      if (n.depth > 0) {
        const barHeight = n.depth * 5;
        ctx.fillStyle = COLORS.water;
        ctx.fillRect(n.x + offset + 2, n.y - offset - barHeight, 4, barHeight);
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawDemoLink(ctx: CanvasRenderingContext2D, link: DemoLink) {
      const from = nodesRef.current.find(n => n.id === link.fromId);
      const to = nodesRef.current.find(n => n.id === link.toId);
      if (!from || !to) return;

      const endX = from.x + (to.x - from.x) * link.drawProgress;
      const endY = from.y + (to.y - from.y) * link.drawProgress;

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(endX, endY);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#7f8c8d';
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(endX, endY);
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.water;
      ctx.globalAlpha = link.flow > 0 ? 1 : 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;

      if (link.flow > 0 && link.drawProgress >= 1) {
        const timeOffset = (tickRef.current * 0.05) * link.flow;
        for (let i = 0; i < 3; i++) {
          const t = ((timeOffset + i / 3) % 1);
          const px = from.x + (to.x - from.x) * t;
          const py = from.y + (to.y - from.y) * t;
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function drawCursor(ctx: CanvasRenderingContext2D) {
      const c = cursorRef.current;
      if (!c.visible) return;

      ctx.save();
      ctx.translate(c.x, c.y);

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 18);
      ctx.lineTo(5, 14);
      ctx.lineTo(9, 20);
      ctx.lineTo(12, 18);
      ctx.lineTo(8, 12);
      ctx.lineTo(14, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (c.clicking) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(0, 0, 10 + Math.sin(tickRef.current * 0.3) * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    function drawRain(ctx: CanvasRenderingContext2D, w: number, h: number) {
      const drops = rainDropsRef.current;
      ctx.strokeStyle = 'rgba(74, 144, 226, 0.5)';
      ctx.lineWidth = 1;
      drops.forEach(d => {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1, d.y + 8);
        ctx.stroke();
        d.y += d.speed;
        if (d.y > h) {
          d.y = -10;
          d.x = Math.random() * w;
        }
      });
    }

    let animId: number;

    const tick = () => {
      tickRef.current++;
      phaseTickRef.current++;
      const s = steveRef.current;
      s.animFrame++;
      const phase = phaseRef.current;
      const pt = phaseTickRef.current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      const sx = scaleX();
      const sy = scaleY();
      const scale = Math.min(sx, sy);
      const offsetX = (canvas.width - W * scale) / 2;
      const offsetY = (canvas.height - H * scale) / 2;
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      ctx.fillStyle = '#F5F5F5';
      ctx.fillRect(0, 0, W, H);
      drawGrid(ctx, W, H);

      if (phase === 'intro') {
        s.speech = null;
        s.action = 'idle';
        if (pt > 20) setPhase('steve_walks_to_spot');
      }

      if (phase === 'steve_walks_to_spot') {
        const arrived = moveSteveTo(junctionSpot1.x - 40, junctionSpot1.y, 3);
        if (arrived) {
          s.action = 'idle';
          setPhase('place_junction_prompt');
        }
      }

      if (phase === 'place_junction_prompt') {
        s.speech = 'Place a junction here!';
        s.action = 'pointing';
        s.facingRight = true;
        if (pt > 50) {
          cursorRef.current.visible = true;
          cursorRef.current.x = 500;
          cursorRef.current.y = 100;
          setPhase('click_junction_1');
        }
      }

      if (phase === 'click_junction_1') {
        s.speech = 'Place a junction here!';
        const arrived = moveCursorTo(junctionSpot1.x, junctionSpot1.y, 5);
        if (arrived) {
          cursorRef.current.clicking = true;
          if (pt > 15) {
            cursorRef.current.clicking = false;
            nodesRef.current.push({
              id: 'J1', x: junctionSpot1.x, y: junctionSpot1.y,
              type: 'junction', depth: 0, maxDepth: 10, opacity: 0
            });
            setPhase('steve_walks_to_spot_2');
          }
        }
      }

      if (phase === 'steve_walks_to_spot_2') {
        s.speech = 'Great! One more...';
        const arrived = moveSteveTo(junctionSpot2.x - 40, junctionSpot2.y, 3);
        if (arrived) {
          s.action = 'idle';
          setPhase('place_junction_prompt_2');
        }
      }

      if (phase === 'place_junction_prompt_2') {
        s.speech = 'Add another junction!';
        s.action = 'inspecting';
        s.facingRight = true;
        if (pt > 30) setPhase('click_junction_2');
      }

      if (phase === 'click_junction_2') {
        s.speech = 'Add another junction!';
        const arrived = moveCursorTo(junctionSpot2.x, junctionSpot2.y, 5);
        if (arrived) {
          cursorRef.current.clicking = true;
          if (pt > 15) {
            cursorRef.current.clicking = false;
            nodesRef.current.push({
              id: 'J2', x: junctionSpot2.x, y: junctionSpot2.y,
              type: 'junction', depth: 0, maxDepth: 10, opacity: 0
            });
            setPhase('steve_walks_to_spot_3');
          }
        }
      }

      if (phase === 'steve_walks_to_spot_3') {
        s.speech = null;
        const arrived = moveSteveTo(outfallSpot.x - 40, outfallSpot.y, 3);
        if (arrived) {
          s.action = 'idle';
          setPhase('place_outfall_prompt');
        }
      }

      if (phase === 'place_outfall_prompt') {
        s.speech = 'Now place an outfall!';
        s.action = 'inspecting';
        s.facingRight = true;
        if (pt > 30) setPhase('click_outfall');
      }

      if (phase === 'click_outfall') {
        s.speech = 'Now place an outfall!';
        const arrived = moveCursorTo(outfallSpot.x, outfallSpot.y, 5);
        if (arrived) {
          cursorRef.current.clicking = true;
          if (pt > 15) {
            cursorRef.current.clicking = false;
            nodesRef.current.push({
              id: 'OUT1', x: outfallSpot.x, y: outfallSpot.y,
              type: 'outfall', depth: 0, maxDepth: 10, opacity: 0
            });
            setPhase('conduit_prompt');
          }
        }
      }

      if (phase === 'conduit_prompt') {
        moveSteveTo(350, 320, 3);
        s.speech = 'Now add conduits!';
        s.action = 'idle';
        if (pt > 40) setPhase('draw_conduit_1');
      }

      if (phase === 'draw_conduit_1') {
        s.speech = 'Connect the pipes!';
        if (pt === 1) {
          cursorRef.current.x = junctionSpot1.x;
          cursorRef.current.y = junctionSpot1.y;
          cursorRef.current.clicking = true;
        }
        const arrived = moveCursorTo(junctionSpot2.x, junctionSpot2.y, 4);
        if (arrived) {
          cursorRef.current.clicking = false;
          if (linksRef.current.length === 0) {
            linksRef.current.push({ fromId: 'J1', toId: 'J2', flow: 0, drawProgress: 0 });
          }
          if (pt > 30) setPhase('draw_conduit_2');
        }
      }

      if (phase === 'draw_conduit_2') {
        s.speech = 'Connect the pipes!';
        if (pt === 1) {
          cursorRef.current.x = junctionSpot2.x;
          cursorRef.current.y = junctionSpot2.y;
          cursorRef.current.clicking = true;
        }
        const arrived = moveCursorTo(outfallSpot.x, outfallSpot.y, 4);
        if (arrived) {
          cursorRef.current.clicking = false;
          if (linksRef.current.length === 1) {
            linksRef.current.push({ fromId: 'J2', toId: 'OUT1', flow: 0, drawProgress: 0 });
          }
          if (pt > 20) setPhase('rain_start');
        }
      }

      if (phase === 'rain_start') {
        s.speech = "Let's simulate!";
        s.action = 'idle';
        cursorRef.current.visible = false;
        if (rainDropsRef.current.length === 0) {
          for (let i = 0; i < 80; i++) {
            rainDropsRef.current.push({
              x: Math.random() * W,
              y: Math.random() * H,
              speed: 3 + Math.random() * 4
            });
          }
        }
        if (pt > 30) setPhase('simulation');
      }

      if (phase === 'simulation') {
        s.speech = 'Water is flowing!';
        s.action = 'inspecting';
        s.facingRight = true;
        const progress = Math.min(1, pt / 200);
        nodesRef.current.forEach(n => {
          if (n.type !== 'outfall') {
            n.depth = Math.sin(progress * Math.PI) * 6;
          }
        });
        linksRef.current.forEach(l => {
          l.flow = Math.sin(progress * Math.PI) * 2;
        });
        if (progress >= 1) setPhase('celebrate');
      }

      if (phase === 'celebrate') {
        s.speech = 'No flooding!';
        s.action = 'celebrating';
        nodesRef.current.forEach(n => { n.depth = Math.max(0, n.depth - 0.1); });
        linksRef.current.forEach(l => { l.flow = Math.max(0, l.flow - 0.05); });
        if (pt > 80) setPhase('tagline');
      }

      if (phase === 'tagline') {
        s.speech = null;
        s.action = 'celebrating';
        taglineOpacityRef.current = Math.min(1, taglineOpacityRef.current + 0.02);
        nodesRef.current.forEach(n => { n.depth = Math.max(0, n.depth - 0.05); });
        linksRef.current.forEach(l => { l.flow = Math.max(0, l.flow - 0.03); });
        if (rainDropsRef.current.length > 0 && pt > 20) {
          rainDropsRef.current = rainDropsRef.current.slice(0, Math.max(0, rainDropsRef.current.length - 2));
        }
      }

      nodesRef.current.forEach(n => {
        n.opacity = Math.min(1, n.opacity + 0.05);
      });
      linksRef.current.forEach(l => {
        l.drawProgress = Math.min(1, l.drawProgress + 0.04);
      });

      if (phase === 'rain_start' || phase === 'simulation' || phase === 'celebrate' || phase === 'tagline') {
        drawRain(ctx, W, H);
      }

      linksRef.current.forEach(l => drawDemoLink(ctx, l));
      nodesRef.current.forEach(n => drawDemoNode(ctx, n));
      drawDemoSteve(ctx, s);
      drawCursor(ctx);

      if (phase === 'tagline') {
        ctx.save();
        ctx.globalAlpha = taglineOpacityRef.current;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);

        ctx.font = 'bold 36px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#FFD700';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 8;
        ctx.fillText('SWMMCRAFT', W / 2, H / 2 - 30);

        ctx.font = '14px "Press Start 2P", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowBlur = 4;
        ctx.fillText('Build. Simulate. Learn.', W / 2, H / 2 + 20);

        ctx.font = '11px "VT323", monospace';
        ctx.fillStyle = '#AAAAAA';
        ctx.shadowBlur = 0;
        ctx.fillText('Click anywhere to start', W / 2, H / 2 + 60);

        ctx.restore();
      }

      ctx.restore();

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [dismissed]);

  if (dismissed) return null;

  return (
    <div
      data-testid="demo-overlay"
      onClick={handleDismiss}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9999,
        cursor: 'pointer',
        background: '#1a1a2e',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
      <button
        data-testid="button-skip-demo"
        onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          background: 'rgba(0,0,0,0.6)',
          color: '#fff',
          border: '2px solid rgba(255,255,255,0.3)',
          padding: '8px 16px',
          fontFamily: '"Press Start 2P", monospace',
          fontSize: '10px',
          cursor: 'pointer',
          zIndex: 10000,
          borderRadius: 4,
        }}
      >
        SKIP
      </button>
    </div>
  );
}
