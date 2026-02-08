import { Node, Link, Point, SteveState, SteveEmotion } from './swmm-types';

export type { SteveEmotion, SteveState };

export const INITIAL_STEVE: SteveState = {
  x: 300,
  y: 300,
  targetNodeId: null,
  action: 'idle',
  facingRight: true,
  animFrame: 0,
  speech: null,
  inspectionTimer: 0,
  tutorialSpeech: null,
};

const C = {
  SKIN: '#F9C9A9',
  SKIN_SHADOW: '#D4A07A',
  HAIR: '#4A2B0F',
  HARDHAT: '#FFD700',
  HARDHAT_BRIM: '#E6B800',
  HARDHAT_STRIPE: '#FF8C00',
  VEST: '#FF6600',
  VEST_STRIPE: '#FFFF00',
  VEST_DARK: '#CC5500',
  SHIRT_UNDER: '#555555',
  PANTS: '#283593',
  PANTS_DARK: '#1A237E',
  SHOES: '#333333',
  SHOES_SOLE: '#111111',
  CLIPBOARD: '#8B6914',
  CLIPBOARD_CLIP: '#C0C0C0',
  PAPER: '#FFFFF0',
  PAPER_LINE: '#CCCCCC',
  EYE_WHITE: '#FFFFFF',
  EYE_PUPIL: '#2C1810',
  MOUTH: '#8F6352',
  WORRIED_VEST: '#FF4444',
  SWIM_VEST: '#2196F3',
  CELEBRATE_VEST: '#FFD700',
};

const SMART_HINTS: string[] = [
  "Tip: Bigger pipes cost more but prevent flooding!",
  "Tip: Storage units absorb peak flows. Very useful!",
  "Tip: Water flows downhill. Check your elevations!",
  "Tip: Connect all nodes or water has nowhere to go!",
  "Tip: Outfalls are where water exits. Don't forget one!",
  "Tip: Press V for select mode to inspect elements.",
  "Fun fact: Real SWMM models can have 10,000+ nodes!",
];

function generateInspectionSpeech(node: Node, links: Link[], allNodes: Node[]): string {
  const pct = node.maxDepth > 0 ? Math.round((node.depth / node.maxDepth) * 100) : 0;

  if (node.type === 'outfall') {
    return `${node.id}: Outfall at ${node.invertElev.toFixed(0)}ft. Water exits here!`;
  }

  if (node.type === 'storage') {
    return `${node.id}: Storage at ${pct}% capacity. Absorbing peak flow!`;
  }

  const upstreamLinks = links.filter(l => l.toNode === node.id);
  const downstreamLinks = links.filter(l => l.fromNode === node.id);

  if (upstreamLinks.length > 2 && pct > 70) {
    return `${node.id}: ${pct}% Full! ${upstreamLinks.length} pipes feeding in - consider bigger pipes!`;
  }

  if (downstreamLinks.length === 0 && node.type === 'junction') {
    return `${node.id}: Dead end! This junction needs a downstream connection.`;
  }

  if (pct > 90) {
    return `${node.id}: ${pct}% FULL! SURCHARGE IMMINENT! Need bigger pipes downstream!`;
  }

  if (pct > 50) {
    return `${node.id}: ${pct}% full. Handling it, but watch during peak storm.`;
  }

  if (Math.random() < 0.3) {
    return SMART_HINTS[Math.floor(Math.random() * SMART_HINTS.length)];
  }

  return `${node.id}: ${pct}% full. Elev: ${node.invertElev.toFixed(0)}ft. Looking good!`;
}

export function getEmotionEmoji(action: SteveEmotion): string {
  switch (action) {
    case 'idle': return '👷';
    case 'walking': return '🏃';
    case 'inspecting': return '🔍';
    case 'pointing': return '👉';
    case 'worried': return '😰';
    case 'swimming': return '🏊';
    case 'celebrating': return '🎉';
    case 'sleeping': return '😴';
    default: return '👷';
  }
}

export function getEmotionLabel(action: SteveEmotion): string {
  switch (action) {
    case 'idle': return 'Idling';
    case 'walking': return 'Walking';
    case 'inspecting': return 'Inspecting';
    case 'pointing': return 'Pointing';
    case 'worried': return 'Worried!';
    case 'swimming': return 'SWIMMING!';
    case 'celebrating': return 'Celebrating!';
    case 'sleeping': return 'Sleeping...';
    default: return 'Unknown';
  }
}

export function updateSteve(steve: SteveState, nodes: Node[], links: Link[], dt: number, simActive: boolean, simTime: number): SteveState {
  let s = { ...steve };
  s.animFrame = (s.animFrame + 1) % 60;

  if (s.tutorialSpeech) {
    s.speech = s.tutorialSpeech;
  }

  const nearbyNode = nodes.find(n => Math.hypot(n.x - s.x, n.y - s.y) < 30);
  const anySurcharge = nodes.some(n => n.depth >= n.maxDepth && n.maxDepth > 0);
  const steveFlooding = nearbyNode && nearbyNode.depth >= nearbyNode.maxDepth && nearbyNode.maxDepth > 0;

  if (steveFlooding && simActive) {
    s.action = 'swimming';
    s.speech = "HELP! I'm flooding! Need bigger pipes!";
    return s;
  }

  if (anySurcharge && simActive) {
    if (s.action !== 'worried' && s.action !== 'inspecting') {
      s.action = 'worried';
      if (!s.tutorialSpeech) {
        const surcharged = nodes.find(n => n.depth >= n.maxDepth && n.maxDepth > 0);
        s.speech = surcharged ? `${surcharged.id} is flooding! Quick, inspect it!` : "Surcharge detected!";
      }
    }
  }

  if (!simActive && simTime >= 24) {
    const hadFlooding = nodes.some(n => n.depth > n.maxDepth * 0.9 && n.maxDepth > 0);
    if (s.action === 'celebrating' && s.inspectionTimer > 0) {
      s.inspectionTimer--;
      return s;
    }
    if (s.action === 'celebrating' && s.inspectionTimer <= 0) {
      s.action = 'sleeping';
      if (!s.tutorialSpeech) s.speech = "Zzz... simulation complete. Wake me for the next storm!";
      s.inspectionTimer = 300;
      return s;
    }
    if (s.action !== 'sleeping' && s.action !== 'celebrating') {
      if (!hadFlooding) {
        s.action = 'celebrating';
        if (!s.tutorialSpeech) s.speech = "Storm passed! No flooding! Great design!";
        s.inspectionTimer = 120;
      } else {
        s.action = 'celebrating';
        if (!s.tutorialSpeech) s.speech = "Storm's over. Some flooding occurred, but we survived!";
        s.inspectionTimer = 120;
      }
      return s;
    }
    if (s.action === 'sleeping') {
      s.inspectionTimer--;
      if (s.inspectionTimer <= 0) {
        s.action = 'idle';
        if (!s.tutorialSpeech) s.speech = null;
      }
      return s;
    }
    return s;
  }

  if (!simActive && simTime === 0 && (s.action === 'sleeping' || s.action === 'celebrating')) {
    s.action = 'idle';
    if (!s.tutorialSpeech) s.speech = null;
  }

  if (s.action === 'idle') {
    if (Math.random() < 0.05 && nodes.length > 0) {
      const target = nodes[Math.floor(Math.random() * nodes.length)];
      s.targetNodeId = target.id;
      s.action = 'walking';
    }
  } else if (s.action === 'walking') {
    const target = nodes.find(n => n.id === s.targetNodeId);
    if (target) {
      const dx = target.x - s.x;
      const dy = target.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > 0.1) s.facingRight = dx > 0;
      if (dist < 20) {
        s.action = 'inspecting';
        s.inspectionTimer = 120;
        if (!s.tutorialSpeech) {
          s.speech = generateInspectionSpeech(target, links, nodes);
        }
      } else {
        const speed = anySurcharge ? 4 : 2;
        s.x += (dx / dist) * speed;
        s.y += (dy / dist) * speed;
      }
    } else {
      s.action = 'idle';
    }
  } else if (s.action === 'inspecting') {
    s.inspectionTimer--;
    if (s.inspectionTimer <= 0) {
      s.action = 'idle';
      if (!s.tutorialSpeech) {
        s.speech = null;
      }
      s.targetNodeId = null;
    }
  } else if (s.action === 'worried') {
    if (!anySurcharge) {
      s.action = 'idle';
      if (!s.tutorialSpeech) s.speech = "Phew! Crisis averted.";
    } else if (Math.random() < 0.03 && nodes.length > 0) {
      const surcharged = nodes.find(n => n.depth >= n.maxDepth && n.maxDepth > 0);
      if (surcharged) {
        s.targetNodeId = surcharged.id;
        s.action = 'walking';
      }
    }
  }

  return s;
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawHardHat(ctx: CanvasRenderingContext2D, headX: number, headY: number) {
  px(ctx, headX - 2, headY - 4, 12, 2, C.HARDHAT);
  px(ctx, headX, headY - 6, 8, 2, C.HARDHAT);
  px(ctx, headX + 2, headY - 8, 4, 2, C.HARDHAT);

  px(ctx, headX - 2, headY - 4, 12, 1, C.HARDHAT_BRIM);
  px(ctx, headX + 1, headY - 6, 6, 1, C.HARDHAT_STRIPE);
}

function drawVest(ctx: CanvasRenderingContext2D, bx: number, by: number, w: number, h: number, vestColor: string) {
  px(ctx, bx, by, w, h, vestColor);
  px(ctx, bx + 1, by + 2, w - 2, 1, C.VEST_STRIPE);
  px(ctx, bx + 1, by + h - 3, w - 2, 1, C.VEST_STRIPE);
  px(ctx, bx + Math.floor(w / 2), by, 1, h, C.VEST_DARK);
}

function drawFace(ctx: CanvasRenderingContext2D, headX: number, headY: number, emotion: SteveEmotion, animFrame: number) {
  px(ctx, headX, headY - 2, 8, 8, C.SKIN);
  px(ctx, headX - 1, headY, 1, 4, C.SKIN);
  px(ctx, headX + 8, headY, 1, 4, C.SKIN);

  if (emotion === 'worried') {
    px(ctx, headX + 1, headY + 1, 2, 2, C.EYE_WHITE);
    px(ctx, headX + 5, headY + 1, 2, 2, C.EYE_WHITE);
    px(ctx, headX + 1, headY + 1, 1, 1, C.EYE_PUPIL);
    px(ctx, headX + 5, headY + 1, 1, 1, C.EYE_PUPIL);
    px(ctx, headX + 2, headY, 1, 1, '#FF0000');
    px(ctx, headX + 5, headY, 1, 1, '#FF0000');
    ctx.fillStyle = C.MOUTH;
    ctx.beginPath();
    ctx.arc(headX + 4, headY + 5, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (emotion === 'celebrating') {
    px(ctx, headX + 1, headY + 1, 2, 2, C.EYE_WHITE);
    px(ctx, headX + 5, headY + 1, 2, 2, C.EYE_WHITE);
    px(ctx, headX + 1.5, headY + 1.5, 1, 1, C.EYE_PUPIL);
    px(ctx, headX + 5.5, headY + 1.5, 1, 1, C.EYE_PUPIL);
    px(ctx, headX + 2, headY + 4, 4, 1, '#FF6B6B');
    px(ctx, headX + 3, headY + 5, 2, 1, '#FF6B6B');
  } else if (emotion === 'sleeping') {
    px(ctx, headX + 1, headY + 2, 3, 1, C.EYE_PUPIL);
    px(ctx, headX + 5, headY + 2, 3, 1, C.EYE_PUPIL);
    px(ctx, headX + 3, headY + 4, 2, 1, C.MOUTH);
  } else if (emotion === 'swimming') {
    px(ctx, headX + 1, headY + 1, 2, 2, C.EYE_WHITE);
    px(ctx, headX + 5, headY + 1, 2, 2, C.EYE_WHITE);
    const blink = Math.sin(animFrame * 0.3) > 0.8;
    if (!blink) {
      px(ctx, headX + 1.5, headY + 1.5, 1, 1, C.EYE_PUPIL);
      px(ctx, headX + 5.5, headY + 1.5, 1, 1, C.EYE_PUPIL);
    }
    px(ctx, headX + 2, headY + 4, 4, 1, '#6699FF');
  } else {
    px(ctx, headX + 1, headY + 1, 2, 2, C.EYE_WHITE);
    px(ctx, headX + 5, headY + 1, 2, 2, C.EYE_WHITE);
    px(ctx, headX + 1.5, headY + 1.5, 1, 1, C.EYE_PUPIL);
    px(ctx, headX + 5.5, headY + 1.5, 1, 1, C.EYE_PUPIL);
    px(ctx, headX + 3, headY + 4, 2, 1, C.MOUTH);
  }
}

export function drawSteve(
  ctx: CanvasRenderingContext2D,
  steve: SteveState,
  transform: { x: number; y: number; k: number },
  is3D: boolean
) {
  const x = steve.x;
  const y = steve.y;
  const S = is3D ? 2 : 1.4;

  ctx.save();
  ctx.translate(x, y);
  if (!steve.facingRight) ctx.scale(-1, 1);
  ctx.scale(S, S);

  const f = steve.animFrame;
  const bob = Math.sin(f * 0.2) * 1.5;
  const isMoving = steve.action === 'walking' || steve.action === 'worried';
  const walkCycle = Math.floor(f / 4) % 4;
  const legAngles = [0.4, 0.1, -0.4, -0.1];
  const armAngles = [-0.3, -0.1, 0.3, 0.1];
  const legAngle = isMoving ? legAngles[walkCycle] : 0;
  const armAngle = isMoving ? armAngles[walkCycle] : 0;

  const baseY = isMoving ? -32 + Math.abs(bob) : -32;

  let vestColor = C.VEST;
  if (steve.action === 'worried') vestColor = C.WORRIED_VEST;
  if (steve.action === 'swimming') vestColor = C.SWIM_VEST;
  if (steve.action === 'celebrating') vestColor = C.CELEBRATE_VEST;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (steve.action === 'swimming') {
    const waterBob = Math.sin(f * 0.25) * 2;
    px(ctx, -10, -4 + waterBob, 20, 12, 'rgba(74, 144, 226, 0.6)');

    drawFace(ctx, -4, baseY + 2 + waterBob, 'swimming', f);
    drawHardHat(ctx, -4, baseY + 2 + waterBob);

    ctx.fillStyle = C.SKIN;
    const aAngle = Math.sin(f * 0.4) * 0.8;
    ctx.save();
    ctx.translate(4, baseY + 10 + waterBob);
    ctx.rotate(aAngle);
    ctx.fillRect(0, 0, 10, 3);
    ctx.restore();
    ctx.save();
    ctx.translate(-4, baseY + 10 + waterBob);
    ctx.rotate(-aAngle);
    ctx.fillRect(-10, 0, 10, 3);
    ctx.restore();
  } else if (steve.action === 'sleeping') {
    px(ctx, -6, -4, 12, 4, C.SHOES);
    px(ctx, -6, -8, 12, 4, C.PANTS);
    drawVest(ctx, -6, -14, 12, 6, vestColor);
    drawFace(ctx, -4, -22, 'sleeping', f);
    drawHardHat(ctx, -4, -22);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    const zCount = 1 + Math.floor((f % 60) / 20);
    const zOffset = (f % 20) * 0.3;
    for (let i = 0; i < zCount; i++) {
      ctx.globalAlpha = 1 - (i * 0.3);
      ctx.fillText('Z', 10 + i * 5, -26 - i * 6 - zOffset);
    }
    ctx.globalAlpha = 1;
  } else if (steve.action === 'celebrating') {
    const jumpY = Math.abs(Math.sin(f * 0.15)) * 6;

    px(ctx, -3, baseY + 24 - jumpY, 3, 8, C.PANTS);
    px(ctx, 0, baseY + 24 - jumpY, 3, 8, C.PANTS);
    px(ctx, -3, baseY + 30 - jumpY, 3, 2, C.SHOES);
    px(ctx, 0, baseY + 30 - jumpY, 3, 2, C.SHOES);

    drawVest(ctx, -5, baseY + 12 - jumpY, 10, 12, vestColor);

    ctx.fillStyle = C.SKIN;
    ctx.save();
    ctx.translate(5, baseY + 12 - jumpY);
    ctx.rotate(-1.3 + Math.sin(f * 0.25) * 0.4);
    ctx.fillRect(0, -12, 3, 12);
    ctx.restore();
    ctx.save();
    ctx.translate(-5, baseY + 12 - jumpY);
    ctx.rotate(1.3 - Math.sin(f * 0.25) * 0.4);
    ctx.fillRect(-3, -12, 3, 12);
    ctx.restore();

    drawFace(ctx, -4, baseY + 2 - jumpY, 'celebrating', f);
    drawHardHat(ctx, -4, baseY + 2 - jumpY);

    ctx.fillStyle = '#FFD700';
    const sparklePhase = (f % 30) / 30;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + sparklePhase * Math.PI * 2;
      const sr = 14 + Math.sin(f * 0.1 + i) * 3;
      const sx = Math.cos(angle) * sr;
      const sy = -20 - jumpY + Math.sin(angle) * sr * 0.5;
      ctx.globalAlpha = 0.6 + Math.sin(f * 0.2 + i) * 0.4;
      px(ctx, sx - 1, sy - 1, 2, 2, '#FFD700');
    }
    ctx.globalAlpha = 1;
  } else if (steve.action === 'pointing') {
    px(ctx, -3, baseY + 24, 3, 8, C.PANTS);
    px(ctx, 0, baseY + 24, 3, 8, C.PANTS);
    px(ctx, -3, baseY + 30, 3, 2, C.SHOES);
    px(ctx, 0, baseY + 30, 3, 2, C.SHOES);

    drawVest(ctx, -5, baseY + 12, 10, 12, vestColor);

    ctx.fillStyle = C.SKIN;
    ctx.save();
    ctx.translate(5, baseY + 14);
    ctx.rotate(-0.8 + Math.sin(f * 0.15) * 0.1);
    ctx.fillRect(0, -2, 14, 3);
    px(ctx, 12, -3, 3, 2, C.SKIN);
    ctx.restore();

    ctx.fillStyle = C.SKIN;
    ctx.fillRect(-7, baseY + 14, 3, 10);

    drawFace(ctx, -4, baseY + 2, steve.action, f);
    drawHardHat(ctx, -4, baseY + 2);

    const pulseR = 4 + Math.sin(f * 0.15) * 2;
    ctx.strokeStyle = C.HARDHAT;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.6 + Math.sin(f * 0.15) * 0.3;
    ctx.beginPath();
    ctx.arc(22, baseY + 10, pulseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  } else {
    ctx.save();
    ctx.translate(-2, baseY + 24);
    ctx.rotate(legAngle);
    px(ctx, -1, 0, 3, 8, C.PANTS);
    px(ctx, -1, 6, 3, 2, C.SHOES);
    ctx.restore();
    ctx.save();
    ctx.translate(2, baseY + 24);
    ctx.rotate(-legAngle);
    px(ctx, -2, 0, 3, 8, C.PANTS);
    px(ctx, -2, 6, 3, 2, C.SHOES);
    ctx.restore();

    drawVest(ctx, -5, baseY + 12, 10, 12, vestColor);

    if (steve.action === 'inspecting') {
      ctx.fillStyle = C.SKIN;
      ctx.save();
      ctx.translate(5, baseY + 14);
      ctx.rotate(-0.3);
      ctx.fillRect(0, 0, 3, 10);
      px(ctx, 2, 4, 8, 12, C.CLIPBOARD);
      px(ctx, 2, 4, 8, 1, C.CLIPBOARD_CLIP);
      px(ctx, 5, 3, 2, 2, C.CLIPBOARD_CLIP);
      px(ctx, 3, 6, 6, 9, C.PAPER);
      px(ctx, 4, 7, 4, 1, C.PAPER_LINE);
      px(ctx, 4, 9, 4, 1, C.PAPER_LINE);
      px(ctx, 4, 11, 3, 1, C.PAPER_LINE);
      ctx.restore();

      ctx.fillStyle = C.SKIN;
      ctx.fillRect(-7, baseY + 14, 3, 10);
    } else if (isMoving) {
      ctx.save();
      ctx.translate(-5, baseY + 14);
      ctx.rotate(armAngle);
      px(ctx, -1, 0, 3, 10, C.SKIN);
      ctx.restore();
      ctx.save();
      ctx.translate(5, baseY + 14);
      ctx.rotate(-armAngle);
      px(ctx, -2, 0, 3, 10, C.SKIN);
      ctx.restore();
    } else {
      px(ctx, -7, baseY + 14, 3, 10, C.SKIN);
      px(ctx, 4, baseY + 14, 3, 10, C.SKIN);
    }

    drawFace(ctx, -4, baseY + 2, steve.action, f);
    drawHardHat(ctx, -4, baseY + 2);
  }

  ctx.restore();

  if (steve.speech) {
    const bubbleY = y - (steve.action === 'swimming' ? 40 : 70) * S;
    ctx.save();
    ctx.translate(x, bubbleY);

    ctx.font = '11px "Press Start 2P", monospace';
    const lines = wrapText(steve.speech, 200, ctx);
    const lineHeight = 16;
    const padding = 10;
    const boxW = Math.min(240, Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2);
    const boxH = lines.length * lineHeight + padding * 2;

    const bubbleColor = steve.action === 'worried' ? '#FFF3CD' :
                        steve.action === 'swimming' ? '#D4EDDA' :
                        steve.action === 'celebrating' ? '#FFF9C4' :
                        steve.action === 'pointing' ? '#E8F5E9' : '#FFFFFF';

    const borderColor = steve.action === 'worried' ? '#FF6B6B' :
                        steve.action === 'swimming' ? '#28A745' :
                        steve.action === 'celebrating' ? '#FFD700' :
                        steve.action === 'pointing' ? '#4CAF50' : '#333333';

    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;

    ctx.fillStyle = bubbleColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;

    const radius = 8;
    const bx = -boxW / 2;
    const by = -boxH;
    ctx.beginPath();
    ctx.moveTo(bx + radius, by);
    ctx.lineTo(bx + boxW - radius, by);
    ctx.quadraticCurveTo(bx + boxW, by, bx + boxW, by + radius);
    ctx.lineTo(bx + boxW, by + boxH - radius);
    ctx.quadraticCurveTo(bx + boxW, by + boxH, bx + boxW - radius, by + boxH);
    ctx.lineTo(bx + radius, by + boxH);
    ctx.quadraticCurveTo(bx, by + boxH, bx, by + boxH - radius);
    ctx.lineTo(bx, by + radius);
    ctx.quadraticCurveTo(bx, by, bx + radius, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(6, 0);
    ctx.fillStyle = bubbleColor;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(0, 10);
    ctx.strokeStyle = borderColor;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(6, 0);
    ctx.stroke();

    ctx.fillStyle = '#222222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, by + padding + i * lineHeight);
    });

    ctx.restore();
  }
}

function wrapText(text: string, maxWidth: number, ctx: CanvasRenderingContext2D): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}
