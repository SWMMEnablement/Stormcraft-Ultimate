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
  HAIR: '#4A2B0F',
  SHIRT: '#00AAAA',
  PANTS: '#283593',
  SHOES: '#333333',
  CLIPBOARD: '#D4A017',
  PAPER: '#FFFFFF',
  WORRIED_SHIRT: '#FF6B6B',
  SWIM_SHIRT: '#2196F3',
  CELEBRATE_SHIRT: '#FFD700',
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

export function drawSteve(
  ctx: CanvasRenderingContext2D,
  steve: SteveState,
  transform: { x: number; y: number; k: number },
  is3D: boolean
) {
  const x = steve.x;
  const y = steve.y;

  ctx.save();
  ctx.translate(x, y);
  if (!steve.facingRight) ctx.scale(-1, 1);

  const bob = Math.sin(steve.animFrame * 0.2) * 2;
  const legSwing = Math.sin(steve.animFrame * 0.5) * 6;
  const armSwing = Math.sin(steve.animFrame * 0.5) * 8;
  const scale = is3D ? 1.5 : 1;
  ctx.scale(scale, scale);

  const isMoving = steve.action === 'walking' || steve.action === 'worried';
  const bodyY = -24 + (isMoving ? Math.abs(bob) : 0);

  let shirtColor = C.SHIRT;
  if (steve.action === 'worried') shirtColor = C.WORRIED_SHIRT;
  if (steve.action === 'swimming') shirtColor = C.SWIM_SHIRT;
  if (steve.action === 'celebrating') shirtColor = C.CELEBRATE_SHIRT;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (steve.action === 'swimming') {
    const waterBob = Math.sin(steve.animFrame * 0.3) * 3;
    ctx.fillStyle = 'rgba(74, 144, 226, 0.6)';
    ctx.fillRect(-12, -8 + waterBob, 24, 16);

    ctx.fillStyle = C.SKIN;
    ctx.fillRect(-4, -20 + waterBob, 8, 8);
    ctx.fillStyle = C.HAIR;
    ctx.fillRect(-4, -20 + waterBob, 8, 2);

    ctx.fillStyle = C.SKIN;
    const armAngle = Math.sin(steve.animFrame * 0.4) * 0.8;
    ctx.save();
    ctx.translate(4, -14 + waterBob);
    ctx.rotate(armAngle);
    ctx.fillRect(0, 0, 10, 3);
    ctx.restore();
    ctx.save();
    ctx.translate(-4, -14 + waterBob);
    ctx.rotate(-armAngle);
    ctx.fillRect(-10, 0, 10, 3);
    ctx.restore();
  } else if (steve.action === 'sleeping') {
    ctx.fillStyle = C.PANTS;
    ctx.fillRect(-6, -6, 12, 6);
    ctx.fillStyle = shirtColor;
    ctx.fillRect(-6, -12, 12, 6);
    ctx.fillStyle = C.SKIN;
    ctx.fillRect(-4, -18, 8, 6);
    ctx.fillStyle = C.HAIR;
    ctx.fillRect(-4, -18, 8, 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    const zzz = 'Z'.repeat(1 + Math.floor((steve.animFrame % 40) / 13));
    ctx.fillText(zzz, 8, -22);
  } else if (steve.action === 'celebrating') {
    ctx.fillStyle = C.PANTS;
    ctx.fillRect(-4, bodyY + 12, 4, 12);
    ctx.fillRect(0, bodyY + 12, 4, 12);
    ctx.fillStyle = shirtColor;
    ctx.fillRect(-4, bodyY, 8, 12);

    ctx.fillStyle = C.SKIN;
    ctx.save();
    ctx.translate(4, bodyY);
    ctx.rotate(-1.2 + Math.sin(steve.animFrame * 0.3) * 0.3);
    ctx.fillRect(0, -10, 3, 10);
    ctx.restore();
    ctx.save();
    ctx.translate(-4, bodyY);
    ctx.rotate(1.2 - Math.sin(steve.animFrame * 0.3) * 0.3);
    ctx.fillRect(-3, -10, 3, 10);
    ctx.restore();

    ctx.fillStyle = C.SKIN;
    ctx.fillRect(-4, bodyY - 8, 8, 8);
    ctx.fillStyle = C.HAIR;
    ctx.fillRect(-4, bodyY - 8, 8, 2);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, bodyY - 5, 2, 2);
    ctx.fillRect(3, bodyY - 5, 2, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(0.5, bodyY - 4.5, 1, 1);
    ctx.fillRect(3.5, bodyY - 4.5, 1, 1);
    ctx.fillStyle = '#FF6B6B';
    ctx.fillRect(1, bodyY - 1, 3, 1);
  } else {
    ctx.fillStyle = C.PANTS;
    if (isMoving) {
      ctx.save();
      ctx.translate(2, bodyY + 12);
      ctx.rotate(-legSwing * 0.1);
      ctx.fillRect(-2, 0, 4, 12);
      ctx.restore();
      ctx.save();
      ctx.translate(-2, bodyY + 12);
      ctx.rotate(legSwing * 0.1);
      ctx.fillRect(-2, 0, 4, 12);
      ctx.restore();
    } else {
      ctx.fillRect(-4, bodyY + 12, 4, 12);
      ctx.fillRect(0, bodyY + 12, 4, 12);
    }

    ctx.fillStyle = shirtColor;
    ctx.fillRect(-4, bodyY, 8, 12);

    if (isMoving) {
      ctx.fillStyle = C.SKIN;
      ctx.save();
      ctx.translate(-4, bodyY + 2);
      ctx.rotate(armSwing * 0.1);
      ctx.fillRect(-2, 0, 4, 10);
      ctx.restore();
      ctx.save();
      ctx.translate(4, bodyY + 2);
      ctx.rotate(-armSwing * 0.1);
      ctx.fillRect(-2, 0, 4, 10);
      ctx.restore();
    } else if (steve.action === 'inspecting') {
      ctx.fillStyle = C.SKIN;
      ctx.fillRect(4, bodyY, 4, 10);
      ctx.fillStyle = C.CLIPBOARD;
      ctx.fillRect(6, bodyY + 4, 8, 10);
      ctx.fillStyle = C.PAPER;
      ctx.fillRect(7, bodyY + 5, 6, 8);
    } else {
      ctx.fillStyle = C.SKIN;
      ctx.fillRect(-6, bodyY, 2, 12);
      ctx.fillRect(4, bodyY, 2, 12);
    }

    ctx.fillStyle = C.SKIN;
    ctx.fillRect(-4, bodyY - 8, 8, 8);
    ctx.fillStyle = C.HAIR;
    ctx.fillRect(-4, bodyY - 8, 8, 2);
    ctx.fillRect(-4, bodyY - 6, 2, 2);
    ctx.fillRect(2, bodyY - 6, 2, 2);

    if (steve.action === 'worried') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, bodyY - 6, 2, 3);
      ctx.fillRect(3, bodyY - 6, 2, 3);
      ctx.fillStyle = '#000';
      ctx.fillRect(0.5, bodyY - 5, 1, 1);
      ctx.fillRect(3.5, bodyY - 5, 1, 1);
      ctx.fillStyle = '#8F6352';
      ctx.beginPath();
      ctx.arc(2.5, bodyY - 1, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, bodyY - 5, 1, 1);
      ctx.fillRect(3, bodyY - 5, 1, 1);
      ctx.fillStyle = '#3F2832';
      ctx.fillRect(1, bodyY - 5, 1, 1);
      ctx.fillRect(4, bodyY - 5, 1, 1);
      ctx.fillStyle = '#A97D64';
      ctx.fillRect(1.5, bodyY - 3, 2, 1);
      ctx.fillStyle = '#8F6352';
      ctx.fillRect(1.5, bodyY - 1, 2, 1);
    }
  }

  ctx.restore();

  if (steve.speech) {
    ctx.save();
    ctx.translate(x, y - (steve.action === 'swimming' ? 30 : 50));

    ctx.font = '11px sans-serif';
    const lines = wrapText(steve.speech, 180, ctx);
    const lineHeight = 14;
    const padding = 8;
    const boxW = Math.min(200, Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2);
    const boxH = lines.length * lineHeight + padding * 2;

    const bubbleColor = steve.action === 'worried' ? '#FFF3CD' :
                        steve.action === 'swimming' ? '#D4EDDA' :
                        steve.action === 'celebrating' ? '#FFF9C4' : '#FFFFFF';

    const borderColor = steve.action === 'worried' ? '#FF6B6B' :
                        steve.action === 'swimming' ? '#28A745' :
                        steve.action === 'celebrating' ? '#FFD700' : '#000000';

    ctx.fillStyle = bubbleColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;

    const radius = 6;
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

    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(4, 0);
    ctx.fillStyle = bubbleColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    ctx.fillStyle = '#000000';
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
