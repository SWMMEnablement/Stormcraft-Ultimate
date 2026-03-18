import React, { useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Node, Link, Subcatchment, SteveState } from '@/lib/swmm-types';

interface ThreeCanvasProps {
  nodes: Node[];
  links: Link[];
  subcatchments: Subcatchment[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  simulationTime: number;
  steve: SteveState;
}

const SCALE = 0.12;
const ELEV_SCALE = 1.0;
const BLOCK = 1;

const COLORS = {
  grass: [0x7EC850, 0x5DAE2B, 0x8BD45E, 0x67C23A],
  grassSide: [0x6AB043, 0x4F9425, 0x78C24E, 0x58A832],
  dirt: [0xB5854A, 0x9E7340, 0xC49555],
  stone: 0xAAAAAA,
  stoneDark: 0x888888,
  pavement: 0x999999,
  pavementDark: 0x777777,
  pavementLine: 0xBBBBBB,
  junction: 0x808080,
  junctionBrick: 0x994433,
  junctionTop: 0x70706F,
  junctionGrate: 0x555555,
  outfall: 0xE8721C,
  outfallAccent: 0xFF9933,
  storage: 0x4488CC,
  storageAccent: 0x55AAEE,
  pipe: 0x707070,
  pipeRivet: 0x999999,
  water: 0x44AAFF,
  waterDeep: 0x2288DD,
  waterSurface: 0x66CCFF,
  waterFlood: 0xFF5555,
  skin: 0xF9C9A9,
  hardhat: 0xFFD700,
  hardhatStripe: 0xFF8C00,
  vest: 0xFF6600,
  vestStripe: 0xFFFF00,
  pants: 0x3344AA,
  shoes: 0x444444,
  selected: 0xFFFF44,
  selectedGlow: 0xFFFF88,
  rain: 0xAADDFF,
  flower_red: 0xFF4444,
  flower_yellow: 0xFFDD33,
  flower_purple: 0xAA55CC,
  tree_trunk: 0x8B5A2B,
  tree_leaves: 0x33AA33,
  tree_leaves_alt: 0x228B22,
};

function createTerrainChunk(nodes: Node[], links: Link[]): THREE.Group {
  const group = new THREE.Group();

  const occupiedSet = new Set<string>();
  nodes.forEach(n => {
    const gx = Math.round(n.x * SCALE);
    const gz = Math.round(n.y * SCALE);
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        occupiedSet.add(`${gx + dx},${gz + dz}`);
      }
    }
  });

  links.forEach(link => {
    const from = nodes.find(n => n.id === link.fromNode);
    const to = nodes.find(n => n.id === link.toNode);
    if (!from || !to) return;
    const steps = Math.ceil(Math.hypot((to.x - from.x) * SCALE, (to.y - from.y) * SCALE) * 1.5);
    for (let i = 0; i <= steps; i++) {
      const t = steps > 0 ? i / steps : 0;
      const gx = Math.round(from.x * SCALE + (to.x - from.x) * SCALE * t);
      const gz = Math.round(from.y * SCALE + (to.y - from.y) * SCALE * t);
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          occupiedSet.add(`${gx + dx},${gz + dz}`);
        }
      }
    }
  });

  if (nodes.length === 0) return group;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  nodes.forEach(n => {
    const gx = n.x * SCALE;
    const gz = n.y * SCALE;
    minX = Math.min(minX, gx);
    maxX = Math.max(maxX, gx);
    minZ = Math.min(minZ, gz);
    maxZ = Math.max(maxZ, gz);
  });

  const pad = 10;
  const startX = Math.floor(minX) - pad;
  const endX = Math.ceil(maxX) + pad;
  const startZ = Math.floor(minZ) - pad;
  const endZ = Math.ceil(maxZ) + pad;

  const totalCells = (endX - startX) * (endZ - startZ);
  const blockGeo = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);

  const grassMat = new THREE.MeshStandardMaterial({ color: 0x7EC850, roughness: 0.9, metalness: 0 });
  const paveMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8, metalness: 0.1 });
  const dirtMat = new THREE.MeshStandardMaterial({ color: 0xB5854A, roughness: 1.0, metalness: 0 });

  const grassMerged = new THREE.InstancedMesh(blockGeo, grassMat, totalCells);
  const paveMerged = new THREE.InstancedMesh(blockGeo, paveMat, occupiedSet.size + 100);
  const dirtMerged = new THREE.InstancedMesh(blockGeo, dirtMat, totalCells);

  let grassIdx = 0, paveIdx = 0, dirtIdx = 0;
  const mat4 = new THREE.Matrix4();

  for (let x = startX; x < endX; x++) {
    for (let z = startZ; z < endZ; z++) {
      const key = `${x},${z}`;
      const r = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

      if (occupiedSet.has(key)) {
        mat4.setPosition(x, -0.5, z);
        if (paveIdx < paveMerged.count) {
          const ci = Math.floor(r * 3);
          const shade = ci === 0 ? 0x999999 : ci === 1 ? 0x888888 : 0xAAAAAA;
          paveMerged.setColorAt(paveIdx, new THREE.Color(shade));
          paveMerged.setMatrixAt(paveIdx++, mat4);
        }
      } else {
        const heightVariation = r > 0.9 ? 0.4 : r > 0.75 ? 0.15 : 0;
        mat4.setPosition(x, -0.5 + heightVariation, z);
        if (grassIdx < grassMerged.count) {
          const ci = Math.floor(r * 4) % 4;
          grassMerged.setColorAt(grassIdx, new THREE.Color(COLORS.grass[ci]));
          grassMerged.setMatrixAt(grassIdx++, mat4);
        }
      }

      mat4.setPosition(x, -1.5, z);
      if (dirtIdx < dirtMerged.count) {
        const ci = Math.floor((r * 7) % 3);
        dirtMerged.setColorAt(dirtIdx, new THREE.Color(COLORS.dirt[ci]));
        dirtMerged.setMatrixAt(dirtIdx++, mat4);
      }
    }
  }

  grassMerged.count = grassIdx;
  paveMerged.count = paveIdx;
  dirtMerged.count = dirtIdx;
  grassMerged.instanceMatrix.needsUpdate = true;
  if (grassMerged.instanceColor) grassMerged.instanceColor.needsUpdate = true;
  paveMerged.instanceMatrix.needsUpdate = true;
  if (paveMerged.instanceColor) paveMerged.instanceColor.needsUpdate = true;
  dirtMerged.instanceMatrix.needsUpdate = true;
  if (dirtMerged.instanceColor) dirtMerged.instanceColor.needsUpdate = true;

  group.add(grassMerged, paveMerged, dirtMerged);

  const decoGeo = new THREE.BoxGeometry(0.3, 0.5, 0.3);
  const treeGeo = new THREE.BoxGeometry(0.4, 0.8, 0.4);
  const leafGeo = new THREE.BoxGeometry(1.6, 1.2, 1.6);

  for (let x = startX; x < endX; x += 1) {
    for (let z = startZ; z < endZ; z += 1) {
      const key = `${x},${z}`;
      if (occupiedSet.has(key)) continue;
      const r = Math.abs(Math.sin(x * 45.233 + z * 93.112) * 12345.6789) % 1;

      if (r > 0.985) {
        const flowerColors = [COLORS.flower_red, COLORS.flower_yellow, COLORS.flower_purple];
        const fc = flowerColors[Math.floor(r * 30) % 3];
        const flowerMat = new THREE.MeshStandardMaterial({ color: fc, roughness: 0.6 });
        const flower = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), flowerMat);
        flower.position.set(x, 0.2, z);
        group.add(flower);
      }

      if (r > 0.993) {
        const trunkMat = new THREE.MeshStandardMaterial({ color: COLORS.tree_trunk, roughness: 1.0 });
        const trunk = new THREE.Mesh(treeGeo, trunkMat);
        trunk.position.set(x, 0.4, z);
        group.add(trunk);

        const leafColor = r > 0.997 ? COLORS.tree_leaves_alt : COLORS.tree_leaves;
        const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.7 });
        const leaves = new THREE.Mesh(leafGeo, leafMat);
        leaves.position.set(x, 1.4, z);
        group.add(leaves);
      }
    }
  }

  return group;
}

function elevToColor(elev: number, minElev: number, maxElev: number): THREE.Color {
  const range = maxElev - minElev;
  const t = range > 0 ? (elev - minElev) / range : 0.5;
  if (t < 0.25) {
    return new THREE.Color().lerpColors(new THREE.Color(0x2244CC), new THREE.Color(0x22AADD), t / 0.25);
  } else if (t < 0.5) {
    return new THREE.Color().lerpColors(new THREE.Color(0x22AADD), new THREE.Color(0x44CC44), (t - 0.25) / 0.25);
  } else if (t < 0.75) {
    return new THREE.Color().lerpColors(new THREE.Color(0x44CC44), new THREE.Color(0xEEBB33), (t - 0.5) / 0.25);
  } else {
    return new THREE.Color().lerpColors(new THREE.Color(0xEEBB33), new THREE.Color(0xDD3333), (t - 0.75) / 0.25);
  }
}

function createJunctionMesh(node: Node, isSelected: boolean, minElev: number, maxElev: number): THREE.Group {
  const group = new THREE.Group();
  const gx = node.x * SCALE;
  const gz = node.y * SCALE;
  const baseY = node.invertElev * ELEV_SCALE;

  const elevColor = elevToColor(node.invertElev, minElev, maxElev);
  const elevColorHex = elevColor.getHex();
  const elevDarker = elevColor.clone().multiplyScalar(0.7);
  const elevLighter = elevColor.clone().lerp(new THREE.Color(0xFFFFFF), 0.3);

  let wallColor = elevColorHex;
  let topColor = elevLighter.getHex();
  let accentColor = elevDarker.getHex();

  if (node.type === 'outfall') {
    topColor = COLORS.outfallAccent;
  } else if (node.type === 'storage') {
    topColor = COLORS.storageAccent;
  } else if (node.type === 'raingauge') {
    topColor = 0x66AAEE;
  }

  if (isSelected) {
    wallColor = COLORS.selected;
    topColor = COLORS.selectedGlow;
    accentColor = COLORS.selected;
  }

  const height = Math.max(node.maxDepth * ELEV_SCALE, 1.5);

  for (let dy = 0; dy < height; dy += BLOCK) {
    const bh = Math.min(BLOCK, height - dy);
    const isTop = dy >= height - BLOCK;
    const geo = new THREE.BoxGeometry(BLOCK * 1.8, bh, BLOCK * 1.8);
    const color = isTop ? topColor : (dy % 2 === 0 ? wallColor : accentColor);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(gx, baseY + dy + bh / 2, gz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { nodeId: node.id };
    group.add(mesh);
  }

  if (node.type === 'junction') {
    const rimGeo = new THREE.BoxGeometry(BLOCK * 2.0, 0.15, BLOCK * 2.0);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.5, metalness: 0.3 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(gx, baseY + height + 0.075, gz);
    rim.castShadow = true;
    group.add(rim);
  }

  if (node.type === 'outfall') {
    const arrowGeo = new THREE.BoxGeometry(BLOCK * 0.4, BLOCK * 0.4, BLOCK * 1.0);
    const arrowMat = new THREE.MeshStandardMaterial({ color: 0xFF4444, roughness: 0.5, emissive: 0x441111 });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(gx, baseY + height + 0.5, gz + 0.8);
    group.add(arrow);
  }

  if (node.type === 'raingauge') {
    const funnelGeo = new THREE.BoxGeometry(BLOCK * 0.8, BLOCK * 1.2, BLOCK * 0.8);
    const funnelMat = new THREE.MeshStandardMaterial({ color: 0x55BBEE, roughness: 0.4, metalness: 0.3 });
    const funnel = new THREE.Mesh(funnelGeo, funnelMat);
    funnel.position.set(gx, baseY + height + 0.6, gz);
    funnel.castShadow = true;
    group.add(funnel);
  }

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 128;
  labelCanvas.height = 32;
  const lctx = labelCanvas.getContext('2d');
  if (lctx) {
    lctx.fillStyle = 'rgba(0,0,0,0.7)';
    lctx.fillRect(0, 0, 128, 32);
    lctx.font = '14px monospace';
    lctx.fillStyle = '#FFFFFF';
    lctx.textAlign = 'center';
    lctx.fillText(`EL ${node.invertElev.toFixed(1)}`, 64, 22);
    const tex = new THREE.CanvasTexture(labelCanvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(gx, baseY + height + 1.2, gz);
    sprite.scale.set(2.5, 0.6, 1);
    group.add(sprite);
  }

  return group;
}

function createPipeMesh(link: Link, nodes: Node[], isSelected: boolean, minElev: number, maxElev: number): THREE.Group {
  const group = new THREE.Group();
  const fromNode = nodes.find(n => n.id === link.fromNode);
  const toNode = nodes.find(n => n.id === link.toNode);
  if (!fromNode || !toNode) return group;

  const from = new THREE.Vector3(
    fromNode.x * SCALE,
    fromNode.invertElev * ELEV_SCALE + 0.8,
    fromNode.y * SCALE
  );
  const to = new THREE.Vector3(
    toNode.x * SCALE,
    toNode.invertElev * ELEV_SCALE + 0.8,
    toNode.y * SCALE
  );

  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len === 0) return group;

  const diam = link.diameter ?? 1.0;
  const pipeSize = Math.max(diam * ELEV_SCALE * 1.2, 0.8);
  const segments = Math.max(1, Math.ceil(len / BLOCK));

  const avgElev = (fromNode.invertElev + toNode.invertElev) / 2;
  const pipeElevColor = isSelected ? new THREE.Color(COLORS.selected) : elevToColor(avgElev, minElev, maxElev).multiplyScalar(0.6);
  const color = pipeElevColor.getHex();
  const rivetColor = isSelected ? COLORS.selectedGlow : pipeElevColor.clone().lerp(new THREE.Color(0xFFFFFF), 0.4).getHex();

  for (let i = 0; i < segments; i++) {
    const t = (i + 0.5) / segments;
    const pos = from.clone().lerp(to, t);
    const segLen = len / segments;

    const geo = new THREE.BoxGeometry(pipeSize, pipeSize, segLen * 1.02);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.25 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.lookAt(to);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { linkId: link.id };
    group.add(mesh);

    const rivetGeo = new THREE.BoxGeometry(pipeSize + 0.2, pipeSize + 0.2, 0.12);
    const rivetMat = new THREE.MeshStandardMaterial({ color: rivetColor, roughness: 0.3, metalness: 0.5 });
    const rivet = new THREE.Mesh(rivetGeo, rivetMat);
    rivet.position.copy(pos);
    rivet.lookAt(to);
    group.add(rivet);
  }

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 128;
  labelCanvas.height = 32;
  const lctx = labelCanvas.getContext('2d');
  if (lctx) {
    lctx.fillStyle = 'rgba(0,0,0,0.6)';
    lctx.fillRect(0, 0, 128, 32);
    lctx.font = '12px monospace';
    lctx.fillStyle = '#AADDFF';
    lctx.textAlign = 'center';
    lctx.fillText(`\u00D8${diam.toFixed(1)}ft`, 64, 22);
    const tex = new THREE.CanvasTexture(labelCanvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    const mid = from.clone().lerp(to, 0.5);
    sprite.position.copy(mid);
    sprite.position.y += pipeSize + 0.8;
    sprite.scale.set(2, 0.5, 1);
    group.add(sprite);
  }

  return group;
}

function createWaterMesh(link: Link, nodes: Node[]): THREE.Mesh | null {
  const fromNode = nodes.find(n => n.id === link.fromNode);
  const toNode = nodes.find(n => n.id === link.toNode);
  if (!fromNode || !toNode || link.flow <= 0) return null;

  const from = new THREE.Vector3(
    fromNode.x * SCALE,
    fromNode.invertElev * ELEV_SCALE + 0.3,
    fromNode.y * SCALE
  );
  const to = new THREE.Vector3(
    toNode.x * SCALE,
    toNode.invertElev * ELEV_SCALE + 0.3,
    toNode.y * SCALE
  );

  const len = from.distanceTo(to);
  if (len === 0) return null;

  const pipeSize = Math.max((link.diameter ?? 1.0) * ELEV_SCALE * 0.8, 0.6);
  const fillRatio = Math.min(link.flow / Math.max(link.capacity, 0.01), 1.0);
  const waterHeight = pipeSize * fillRatio * 0.8;

  const geo = new THREE.BoxGeometry(pipeSize * 0.7, waterHeight, len);
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.water,
    transparent: true,
    opacity: 0.65,
    roughness: 0.2,
    metalness: 0.1,
    emissive: 0x113355,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const mid = from.clone().lerp(to, 0.5);
  mid.y += waterHeight / 2;
  mesh.position.copy(mid);
  mesh.lookAt(to);

  return mesh;
}

function createNodeWater(node: Node): THREE.Mesh | null {
  if (node.depth <= 0) return null;
  const gx = node.x * SCALE;
  const gz = node.y * SCALE;
  const baseY = node.invertElev * ELEV_SCALE;
  const waterH = Math.min(node.depth * ELEV_SCALE, node.maxDepth * ELEV_SCALE);

  const geo = new THREE.BoxGeometry(BLOCK * 1.5, waterH, BLOCK * 1.5);
  const color = node.isSurcharged ? COLORS.waterFlood : COLORS.water;
  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.6,
    roughness: 0.1,
    metalness: 0.1,
    emissive: node.isSurcharged ? 0x331111 : 0x112233,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(gx, baseY + waterH / 2, gz);
  return mesh;
}

function areaToBlue(area: number, minArea: number, maxArea: number): THREE.Color {
  const range = maxArea - minArea;
  const t = range > 0 ? (area - minArea) / range : 0.5;
  return new THREE.Color().lerpColors(new THREE.Color(0x88CCFF), new THREE.Color(0x0033AA), t);
}

function createSubcatchmentMesh(sub: Subcatchment, minArea: number, maxArea: number): THREE.Group {
  const group = new THREE.Group();
  if (!sub.points || sub.points.length < 3) return group;

  const pts2d = sub.points.map(p => new THREE.Vector2(p.x * SCALE, p.y * SCALE));
  const shape = new THREE.Shape(pts2d);
  const geo = new THREE.ShapeGeometry(shape);

  const blueColor = areaToBlue(sub.area, minArea, maxArea);

  const mat = new THREE.MeshStandardMaterial({
    color: blueColor,
    transparent: true,
    opacity: 0.45,
    roughness: 0.4,
    metalness: 0.05,
    side: THREE.DoubleSide,
    emissive: blueColor.clone().multiplyScalar(0.15),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.receiveShadow = true;
  mesh.userData = { subcatchmentId: sub.id };
  group.add(mesh);

  const edgeGeo = new THREE.BufferGeometry().setFromPoints(
    [...pts2d.map(p => new THREE.Vector3(p.x, 0.1, p.y)), new THREE.Vector3(pts2d[0].x, 0.1, pts2d[0].y)]
  );
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x0055CC, linewidth: 2 });
  const edgeLine = new THREE.Line(edgeGeo, edgeMat);
  group.add(edgeLine);

  let cx = 0, cy = 0;
  pts2d.forEach(p => { cx += p.x; cy += p.y; });
  cx /= pts2d.length;
  cy /= pts2d.length;

  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 160;
  labelCanvas.height = 40;
  const lctx = labelCanvas.getContext('2d');
  if (lctx) {
    lctx.fillStyle = 'rgba(0,30,80,0.75)';
    lctx.fillRect(0, 0, 160, 40);
    lctx.font = '13px monospace';
    lctx.fillStyle = '#AADDFF';
    lctx.textAlign = 'center';
    lctx.fillText(`${sub.area.toFixed(1)} ac`, 80, 16);
    lctx.fillText(`${sub.percentImperv.toFixed(0)}% imp`, 80, 34);
    const tex = new THREE.CanvasTexture(labelCanvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(cx, 1.5, cy);
    sprite.scale.set(3, 0.8, 1);
    group.add(sprite);
  }

  return group;
}

function createSteveBlockModel(): THREE.Group {
  const steve = new THREE.Group();

  const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  const headMat = new THREE.MeshStandardMaterial({ color: COLORS.skin, roughness: 0.8 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 2.0;
  head.castShadow = true;
  steve.add(head);

  const eyeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.05);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.15, 2.05, 0.31);
  steve.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
  rightEye.position.set(0.15, 2.05, 0.31);
  steve.add(rightEye);

  const hatGeo = new THREE.BoxGeometry(0.75, 0.25, 0.75);
  const hatMat = new THREE.MeshStandardMaterial({ color: COLORS.hardhat, roughness: 0.3, metalness: 0.2, emissive: 0x332200 });
  const hat = new THREE.Mesh(hatGeo, hatMat);
  hat.position.y = 2.45;
  hat.castShadow = true;
  steve.add(hat);

  const stripeGeo = new THREE.BoxGeometry(0.78, 0.06, 0.78);
  const stripeMat = new THREE.MeshStandardMaterial({ color: COLORS.hardhatStripe, roughness: 0.4 });
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.y = 2.38;
  steve.add(stripe);

  const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.35);
  const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.vest, roughness: 0.7, emissive: 0x221100 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.3;
  body.castShadow = true;
  steve.add(body);

  const vestStripeGeo = new THREE.BoxGeometry(0.62, 0.08, 0.36);
  const vestStripeMat = new THREE.MeshStandardMaterial({ color: COLORS.vestStripe, roughness: 0.5, emissive: 0x222200 });
  const vs1 = new THREE.Mesh(vestStripeGeo, vestStripeMat);
  vs1.position.y = 1.45;
  steve.add(vs1);
  const vs2 = new THREE.Mesh(vestStripeGeo, vestStripeMat.clone());
  vs2.position.y = 1.15;
  steve.add(vs2);

  const legGeo = new THREE.BoxGeometry(0.25, 0.7, 0.3);
  const legMat = new THREE.MeshStandardMaterial({ color: COLORS.pants, roughness: 0.8 });
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.15, 0.55, 0);
  leftLeg.name = 'leftLeg';
  leftLeg.castShadow = true;
  steve.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat.clone());
  rightLeg.position.set(0.15, 0.55, 0);
  rightLeg.name = 'rightLeg';
  rightLeg.castShadow = true;
  steve.add(rightLeg);

  const armGeo = new THREE.BoxGeometry(0.2, 0.7, 0.25);
  const armMat = new THREE.MeshStandardMaterial({ color: COLORS.vest, roughness: 0.7 });
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.42, 1.3, 0);
  leftArm.name = 'leftArm';
  leftArm.castShadow = true;
  steve.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat.clone());
  rightArm.position.set(0.42, 1.3, 0);
  rightArm.name = 'rightArm';
  rightArm.castShadow = true;
  steve.add(rightArm);

  const shoeGeo = new THREE.BoxGeometry(0.28, 0.18, 0.35);
  const shoeMat = new THREE.MeshStandardMaterial({ color: COLORS.shoes, roughness: 0.9 });
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.15, 0.15, 0.04);
  steve.add(leftShoe);
  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat.clone());
  rightShoe.position.set(0.15, 0.15, 0.04);
  steve.add(rightShoe);

  return steve;
}

function createRainSystem(): {
  points: THREE.Points;
  positions: Float32Array;
  velocities: Float32Array;
  count: number;
} {
  const count = 4000;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = Math.random() * 35 + 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
    velocities[i] = 0.2 + Math.random() * 0.2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: COLORS.rain,
    size: 0.12,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geo, mat);
  points.visible = false;

  return { points, positions, velocities, count };
}

export function ThreeCanvas({
  nodes,
  links,
  subcatchments,
  selectedId,
  onSelect,
  simulationTime,
  steve,
}: ThreeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const ambientRef = useRef<THREE.AmbientLight | null>(null);
  const steveModelRef = useRef<THREE.Group | null>(null);
  const stevePathRef = useRef<THREE.CatmullRomCurve3 | null>(null);
  const steveTRef = useRef(0);
  const rainRef = useRef<ReturnType<typeof createRainSystem> | null>(null);
  const waterMeshesRef = useRef<THREE.Mesh[]>([]);
  const animFrameRef = useRef<number>(0);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const initialCameraSetRef = useRef(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7EC8E3);
    scene.fog = new THREE.FogExp2(0x7EC8E3, 0.008);
    sceneRef.current = scene;

    const W = container.clientWidth;
    const H = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500);
    camera.position.set(20, 25, 20);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 5;
    controls.maxDistance = 120;
    controlsRef.current = controls;

    const sun = new THREE.DirectionalLight(0xFFF5E0, 2.0);
    sun.position.set(30, 40, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 150;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    scene.add(sun);
    sunRef.current = sun;

    const ambient = new THREE.AmbientLight(0x8899CC, 0.8);
    scene.add(ambient);
    ambientRef.current = ambient;

    const hemi = new THREE.HemisphereLight(0x88CCFF, 0x446622, 0.6);
    scene.add(hemi);

    const fill = new THREE.DirectionalLight(0x8899BB, 0.4);
    fill.position.set(-20, 15, -10);
    scene.add(fill);

    const steveModel = createSteveBlockModel();
    steveModel.scale.setScalar(0.8);
    scene.add(steveModel);
    steveModelRef.current = steveModel;

    const rain = createRainSystem();
    scene.add(rain.points);
    rainRef.current = rain;

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    const handleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const group = modelGroupRef.current;
      if (!group) return;
      const intersects = raycaster.intersectObjects(group.children, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj) {
          if (obj.userData?.nodeId) {
            onSelect(obj.userData.nodeId);
            return;
          }
          if (obj.userData?.linkId) {
            onSelect(obj.userData.linkId);
            return;
          }
          if (obj.userData?.subcatchmentId) {
            onSelect(obj.userData.subcatchmentId);
            return;
          }
          obj = obj.parent;
        }
      }
      onSelect(null);
    };
    renderer.domElement.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (modelGroupRef.current) {
      scene.remove(modelGroupRef.current);
      modelGroupRef.current.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    }

    waterMeshesRef.current = [];
    const modelGroup = new THREE.Group();
    modelGroupRef.current = modelGroup;

    const terrain = createTerrainChunk(nodes, links);
    modelGroup.add(terrain);

    const elevs = nodes.map(n => n.invertElev);
    const minElev = elevs.length > 0 ? Math.min(...elevs) : 0;
    const maxElev = elevs.length > 0 ? Math.max(...elevs) : 10;

    const areas = subcatchments.map(s => s.area);
    const minArea = areas.length > 0 ? Math.min(...areas) : 0;
    const maxArea = areas.length > 0 ? Math.max(...areas) : 10;

    subcatchments.forEach(sub => {
      const subMesh = createSubcatchmentMesh(sub, minArea, maxArea);
      modelGroup.add(subMesh);
    });

    nodes.forEach(node => {
      const jMesh = createJunctionMesh(node, node.id === selectedId, minElev, maxElev);
      modelGroup.add(jMesh);

      const waterMesh = createNodeWater(node);
      if (waterMesh) {
        modelGroup.add(waterMesh);
        waterMeshesRef.current.push(waterMesh);
      }
    });

    links.forEach(link => {
      const pipeMesh = createPipeMesh(link, nodes, link.id === selectedId, minElev, maxElev);
      modelGroup.add(pipeMesh);

      const waterMesh = createWaterMesh(link, nodes);
      if (waterMesh) {
        modelGroup.add(waterMesh);
        waterMeshesRef.current.push(waterMesh);
      }
    });

    scene.add(modelGroup);

    if (nodes.length > 0 && controlsRef.current && cameraRef.current) {
      let cx = 0, cz = 0;
      nodes.forEach(n => { cx += n.x * SCALE; cz += n.y * SCALE; });
      cx /= nodes.length;
      cz /= nodes.length;
      controlsRef.current.target.set(cx, 1, cz);

      if (!initialCameraSetRef.current) {
        let spread = 0;
        nodes.forEach(n => {
          const dx = n.x * SCALE - cx;
          const dz = n.y * SCALE - cz;
          spread = Math.max(spread, Math.hypot(dx, dz));
        });
        const dist = Math.max(spread * 2.5, 15);
        cameraRef.current.position.set(cx + dist * 0.7, dist * 0.8, cz + dist * 0.7);
        initialCameraSetRef.current = true;
      }
    }

    if (links.length > 0 && nodes.length > 1) {
      const pathPoints: THREE.Vector3[] = [];
      const visited = new Set<string>();
      links.forEach(link => {
        const fromNode = nodes.find(n => n.id === link.fromNode);
        const toNode = nodes.find(n => n.id === link.toNode);
        if (fromNode && toNode) {
          if (!visited.has(fromNode.id)) {
            pathPoints.push(new THREE.Vector3(
              fromNode.x * SCALE,
              fromNode.invertElev * ELEV_SCALE + 2.0,
              fromNode.y * SCALE
            ));
            visited.add(fromNode.id);
          }
          if (!visited.has(toNode.id)) {
            pathPoints.push(new THREE.Vector3(
              toNode.x * SCALE,
              toNode.invertElev * ELEV_SCALE + 2.0,
              toNode.y * SCALE
            ));
            visited.add(toNode.id);
          }
        }
      });

      if (pathPoints.length >= 2) {
        stevePathRef.current = new THREE.CatmullRomCurve3(pathPoints, true, 'catmullrom', 0.5);
      }
    } else if (nodes.length > 0) {
      stevePathRef.current = null;
      if (steveModelRef.current) {
        const n = nodes[0];
        steveModelRef.current.position.set(
          n.x * SCALE,
          n.invertElev * ELEV_SCALE + 1.5,
          n.y * SCALE
        );
      }
    }
  }, [nodes, links, subcatchments, selectedId]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!renderer || !scene || !camera || !controls) return;

    let running = true;

    const animate = () => {
      if (!running) return;
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();

      const sun = sunRef.current;
      const ambient = ambientRef.current;
      if (sun && ambient) {
        const dayProgress = (simulationTime % 24) / 24;
        const sunAngle = dayProgress * Math.PI * 2 - Math.PI / 2;
        const sunHeight = Math.sin(sunAngle);

        sun.position.set(
          Math.cos(sunAngle) * 40,
          Math.max(sunHeight * 40, 3),
          20
        );

        const dayFactor = Math.max(0.15, (sunHeight + 1) / 2);

        sun.intensity = 0.5 + dayFactor * 1.8;
        ambient.intensity = 0.4 + dayFactor * 0.6;

        if (dayProgress > 0.25 && dayProgress < 0.75) {
          const skyColor = new THREE.Color().lerpColors(
            new THREE.Color(0x7EC8E3),
            new THREE.Color(0x55AADD),
            Math.sin((dayProgress - 0.25) * Math.PI * 2) * 0.3
          );
          scene.background = skyColor;
          scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.008);
          sun.color.setHex(0xFFF5E0);
        } else {
          const nightT = dayProgress < 0.25
            ? 1 - dayProgress / 0.25
            : (dayProgress - 0.75) / 0.25;
          const skyColor = new THREE.Color().lerpColors(
            new THREE.Color(0x7EC8E3),
            new THREE.Color(0x1A1A3E),
            nightT * 0.7
          );
          scene.background = skyColor;
          scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.008);

          if (dayProgress < 0.15 || dayProgress > 0.85) {
            sun.color.setHex(0xFFBB77);
          } else {
            sun.color.setHex(0xFFCC88);
          }
        }
      }

      const steveModel = steveModelRef.current;
      const stevePath = stevePathRef.current;
      if (steveModel && stevePath) {
        steveTRef.current = (steveTRef.current + 0.0015) % 1;
        const pos = stevePath.getPointAt(steveTRef.current);
        const nextPos = stevePath.getPointAt((steveTRef.current + 0.01) % 1);
        steveModel.position.copy(pos);
        steveModel.lookAt(nextPos);

        const walkPhase = Date.now() * 0.008;
        const leftLeg = steveModel.getObjectByName('leftLeg');
        const rightLeg = steveModel.getObjectByName('rightLeg');
        const leftArm = steveModel.getObjectByName('leftArm');
        const rightArm = steveModel.getObjectByName('rightArm');
        if (leftLeg) leftLeg.rotation.x = Math.sin(walkPhase) * 0.6;
        if (rightLeg) rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.6;
        if (leftArm) leftArm.rotation.x = Math.sin(walkPhase + Math.PI) * 0.5;
        if (rightArm) rightArm.rotation.x = Math.sin(walkPhase) * 0.5;
      }

      const rain = rainRef.current;
      if (rain) {
        const hasRain = simulationTime > 0 && simulationTime < 12;
        rain.points.visible = hasRain;

        if (hasRain) {
          const posAttr = rain.points.geometry.getAttribute('position') as THREE.BufferAttribute;
          const arr = posAttr.array as Float32Array;

          let cx = 0, cz = 0;
          if (nodes.length > 0) {
            nodes.forEach(n => { cx += n.x * SCALE; cz += n.y * SCALE; });
            cx /= nodes.length;
            cz /= nodes.length;
          }

          for (let i = 0; i < rain.count; i++) {
            arr[i * 3 + 1] -= rain.velocities[i];
            if (arr[i * 3 + 1] < -1) {
              arr[i * 3] = cx + (Math.random() - 0.5) * 80;
              arr[i * 3 + 1] = 25 + Math.random() * 15;
              arr[i * 3 + 2] = cz + (Math.random() - 0.5) * 80;
            }
          }
          posAttr.needsUpdate = true;
        }
      }

      const time = Date.now() * 0.001;
      waterMeshesRef.current.forEach((mesh, i) => {
        const phase = time * 2 + i * 0.5;
        const baseY = mesh.userData.baseY ?? mesh.position.y;
        if (!mesh.userData.baseY) mesh.userData.baseY = mesh.position.y;
        mesh.position.y = baseY + Math.sin(phase) * 0.03;
        (mesh.material as THREE.MeshStandardMaterial).opacity = 0.5 + Math.sin(phase * 0.7) * 0.12;
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [simulationTime, nodes]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ touchAction: 'none' }}
      data-testid="three-canvas"
    />
  );
}
