import { Node, Point } from './swmm-types';

export type SteveAction = 'idle' | 'walking' | 'inspecting';

export interface SteveState {
  x: number;
  y: number;
  targetNodeId: string | null;
  action: SteveAction;
  facingRight: boolean;
  animFrame: number; // 0-60 loop for animation
  speech: string | null;
  inspectionTimer: number;
}

export const INITIAL_STEVE: SteveState = {
  x: 300,
  y: 300,
  targetNodeId: null,
  action: 'idle',
  facingRight: true,
  animFrame: 0,
  speech: null,
  inspectionTimer: 0
};

// Colors
const C = {
  SKIN: '#F9C9A9', // Rosy-ish skin
  HAIR: '#4A2B0F', // Dark Brown
  SHIRT: '#00AAAA', // Cyan/Teal
  PANTS: '#283593', // Dark Blue
  SHOES: '#333333', // Dark Grey
  CLIPBOARD: '#D4A017', // Gold/Brown
  PAPER: '#FFFFFF',
};

export function updateSteve(steve: SteveState, nodes: Node[], dt: number): SteveState {
  let newState = { ...steve };
  newState.animFrame = (newState.animFrame + 1) % 60;

  // AI Logic
  if (newState.action === 'idle') {
    // Pick a random target if idle
    if (Math.random() < 0.05 && nodes.length > 0) {
      const target = nodes[Math.floor(Math.random() * nodes.length)];
      newState.targetNodeId = target.id;
      newState.action = 'walking';
    }
  } else if (newState.action === 'walking') {
    const target = nodes.find(n => n.id === newState.targetNodeId);
    if (target) {
      const dx = target.x - newState.x;
      const dy = target.y - newState.y;
      const dist = Math.hypot(dx, dy);
      
      // Face direction
      if (Math.abs(dx) > 0.1) newState.facingRight = dx > 0;

      if (dist < 20) {
        // Arrived
        newState.action = 'inspecting';
        newState.inspectionTimer = 100; // Frames to inspect
        // Generate speech
        const pct = Math.round((target.depth / target.maxDepth) * 100);
        newState.speech = `${target.id}: ${pct}% Full`;
      } else {
        // Move
        const speed = 2; // Pixels per frame
        newState.x += (dx / dist) * speed;
        newState.y += (dy / dist) * speed;
      }
    } else {
      newState.action = 'idle'; // Target lost
    }
  } else if (newState.action === 'inspecting') {
    newState.inspectionTimer--;
    if (newState.inspectionTimer <= 0) {
      newState.action = 'idle';
      newState.speech = null;
      newState.targetNodeId = null;
    }
  }

  return newState;
}

export function drawSteve(
  ctx: CanvasRenderingContext2D, 
  steve: SteveState, 
  transform: {x: number, y: number, k: number},
  is3D: boolean
) {
  // World to Screen (manual because ctx is usually already transformed, but we might want custom scale for Steve?)
  // Actually, MapCanvas transforms the context, so we draw at (steve.x, steve.y)
  
  const x = steve.x;
  const y = steve.y;
  
  ctx.save();
  ctx.translate(x, y);

  // Flip if facing left (Scale X -1)
  if (!steve.facingRight) {
    ctx.scale(-1, 1);
  }

  // Bobbing animation
  const bob = Math.sin(steve.animFrame * 0.2) * 2;
  const legSwing = Math.sin(steve.animFrame * 0.5) * 6;
  const armSwing = Math.sin(steve.animFrame * 0.5) * 8;

  const scale = is3D ? 1.5 : 1; // Slightly larger in 3D to be visible
  ctx.scale(scale, scale);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw Offset (Feet at y=0)
  const bodyY = -24 + (steve.action === 'walking' ? Math.abs(bob) : 0);

  if (is3D) {
    // Simplified Isometric Steve
    // Legs
    ctx.fillStyle = C.PANTS;
    ctx.fillRect(-3, bodyY + 12, 3, 12); // Left
    ctx.fillRect(0, bodyY + 12, 3, 12); // Right
    
    // Body
    ctx.fillStyle = C.SHIRT;
    ctx.fillRect(-4, bodyY, 8, 12);
    
    // Head
    ctx.fillStyle = C.SKIN;
    ctx.fillRect(-4, bodyY - 8, 8, 8);
    ctx.fillStyle = C.HAIR;
    ctx.fillRect(-4, bodyY - 8, 8, 2); // Hair top

  } else {
    // Detailed 2D Steve

    // Legs (Animated)
    ctx.fillStyle = C.PANTS;
    if (steve.action === 'walking') {
        // Right Leg
        ctx.save();
        ctx.translate(2, bodyY + 12);
        ctx.rotate(-legSwing * 0.1); // Radians
        ctx.fillRect(-2, 0, 4, 12);
        ctx.restore();

        // Left Leg
        ctx.save();
        ctx.translate(-2, bodyY + 12);
        ctx.rotate(legSwing * 0.1);
        ctx.fillRect(-2, 0, 4, 12);
        ctx.restore();
    } else {
        ctx.fillRect(-4, bodyY + 12, 4, 12); // Left
        ctx.fillRect(0, bodyY + 12, 4, 12); // Right
    }

    // Body
    ctx.fillStyle = C.SHIRT;
    ctx.fillRect(-4, bodyY, 8, 12);

    // Arms (Animated)
    if (steve.action === 'walking') {
         // Back Arm
        ctx.fillStyle = C.SKIN;
        ctx.save();
        ctx.translate(-4, bodyY + 2);
        ctx.rotate(armSwing * 0.1);
        ctx.fillRect(-2, 0, 4, 10);
        ctx.restore();
        
        // Front Arm
        ctx.fillStyle = C.SKIN;
        ctx.save();
        ctx.translate(4, bodyY + 2);
        ctx.rotate(-armSwing * 0.1);
        ctx.fillRect(-2, 0, 4, 10);
        ctx.restore();
    } else if (steve.action === 'inspecting') {
        // Hold Clipboard
        ctx.fillStyle = C.SKIN;
        ctx.fillRect(4, bodyY, 4, 10); // Arm up? simplified
        
        // Clipboard
        ctx.fillStyle = C.CLIPBOARD;
        ctx.fillRect(6, bodyY + 4, 8, 10);
        ctx.fillStyle = C.PAPER;
        ctx.fillRect(7, bodyY + 5, 6, 8);
    } else {
        // Idle Arms
        ctx.fillStyle = C.SKIN;
        ctx.fillRect(-6, bodyY, 2, 12);
        ctx.fillRect(4, bodyY, 2, 12);
    }

    // Head
    ctx.fillStyle = C.SKIN;
    ctx.fillRect(-4, bodyY - 8, 8, 8);
    // Hair
    ctx.fillStyle = C.HAIR;
    ctx.fillRect(-4, bodyY - 8, 8, 2);
    ctx.fillRect(-4, bodyY - 6, 2, 2); // Sideburns
    ctx.fillRect(2, bodyY - 6, 2, 2);
    
    // Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, bodyY - 5, 1, 1);
    ctx.fillRect(3, bodyY - 5, 1, 1);
    ctx.fillStyle = '#3F2832'; // Pupil
    ctx.fillRect(1, bodyY - 5, 1, 1);
    ctx.fillRect(4, bodyY - 5, 1, 1);
    
    // Nose
    ctx.fillStyle = '#A97D64';
    ctx.fillRect(1.5, bodyY - 3, 2, 1);
    // Mouth
    ctx.fillStyle = '#8F6352';
    ctx.fillRect(1.5, bodyY - 1, 2, 1);
  }

  ctx.restore();

  // Speech Bubble (Not affected by scale/flip, kept upright)
  if (steve.speech && steve.action === 'inspecting') {
    ctx.save();
    ctx.translate(x, y - 45); // Above head
    
    // Bubble Box
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    const padding = 6;
    const textWidth = ctx.measureText(steve.speech).width || 80;
    const boxW = textWidth + padding * 3; // Approx
    const boxH = 20;
    
    ctx.beginPath();
    ctx.rect(-boxW/2, -boxH, boxW, boxH);
    ctx.fill();
    ctx.stroke();
    
    // Arrow
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(4, 0);
    ctx.fill();
    ctx.stroke();
    
    // Text
    ctx.fillStyle = '#000000';
    ctx.font = '10px "Press Start 2P"'; // Minecraft font
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(steve.speech, 0, -boxH/2);
    
    ctx.restore();
  }
}
