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

const SCALE = 0.05;
const ELEV_SCALE = 0.3;
const BLOCK = 1;

const COLORS = {
  grass: [0x5B8C32, 0x4A7A28, 0x6B9C3E],
  dirt: 0x8B6914,
  stone: 0x888888,
  pavement: 0x777777,
  junction: 0x555555,
  junctionTop: 0x666666,
  outfall: 0xCC5500,
  storage: 0x3366AA,
  pipe: 0x555555,
  pipeInner: 0x444444,
  water: 0x3B7DD8,
  waterDeep: 0x2B5DAA,
  skin: 0xF9C9A9,
  hardhat: 0xFFD700,
  vest: 0xFF6600,
  pants: 0x283593,
  shoes: 0x333333,
  selected: 0xFFFF00,
  rain: 0x8AC4FF,
};

function createBlockMaterial(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

function createTerrainChunk(nodes: Node[], links: Link[]): THREE.Group {
  const group = new THREE.Group();

  const occupiedSet = new Set<string>();
  nodes.forEach(n => {
    const gx = Math.round(n.x * SCALE);
    const gz = Math.round(n.y * SCALE);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        occupiedSet.add(`${gx + dx},${gz + dz}`);
      }
    }
  });

  links.forEach(link => {
    const from = nodes.find(n => n.id === link.fromNode);
    const to = nodes.find(n => n.id === link.toNode);
    if (!from || !to) return;
    const steps = Math.ceil(Math.hypot((to.x - from.x) * SCALE, (to.y - from.y) * SCALE));
    for (let i = 0; i <= steps; i++) {
      const t = steps > 0 ? i / steps : 0;
      const gx = Math.round(from.x * SCALE + (to.x - from.x) * SCALE * t);
      const gz = Math.round(from.y * SCALE + (to.y - from.y) * SCALE * t);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
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

  const pad = 8;
  const startX = Math.floor(minX) - pad;
  const endX = Math.ceil(maxX) + pad;
  const startZ = Math.floor(minZ) - pad;
  const endZ = Math.ceil(maxZ) + pad;

  const grassGeo = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);
  const grassMats = COLORS.grass.map(c => createBlockMaterial(c));
  const paveMat = createBlockMaterial(COLORS.pavement);
  const dirtMat = createBlockMaterial(COLORS.dirt);

  const grassMerged = new THREE.InstancedMesh(grassGeo, grassMats[0], (endX - startX) * (endZ - startZ));
  const paveMerged = new THREE.InstancedMesh(grassGeo, paveMat, occupiedSet.size);
  const dirtMerged = new THREE.InstancedMesh(grassGeo, dirtMat, (endX - startX) * (endZ - startZ));

  let grassIdx = 0, paveIdx = 0, dirtIdx = 0;
  const mat4 = new THREE.Matrix4();

  for (let x = startX; x < endX; x++) {
    for (let z = startZ; z < endZ; z++) {
      const key = `${x},${z}`;
      if (occupiedSet.has(key)) {
        mat4.setPosition(x, -0.5, z);
        if (paveIdx < paveMerged.count) {
          paveMerged.setMatrixAt(paveIdx++, mat4);
        }
      } else {
        const r = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
        const heightVariation = r > 0.85 ? 0.3 : 0;
        mat4.setPosition(x, -0.5 + heightVariation, z);
        if (grassIdx < grassMerged.count) {
          const colorIndex = Math.floor(r * 3) % 3;
          grassMerged.setColorAt(grassIdx, new THREE.Color(COLORS.grass[colorIndex]));
          grassMerged.setMatrixAt(grassIdx++, mat4);
        }
      }
      mat4.setPosition(x, -1.5, z);
      if (dirtIdx < dirtMerged.count) {
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
  dirtMerged.instanceMatrix.needsUpdate = true;

  group.add(grassMerged, paveMerged, dirtMerged);
  return group;
}

function createJunctionMesh(node: Node, isSelected: boolean): THREE.Group {
  const group = new THREE.Group();
  const gx = node.x * SCALE;
  const gz = node.y * SCALE;
  const baseY = node.invertElev * ELEV_SCALE;

  let wallColor = COLORS.junction;
  let topColor = COLORS.junctionTop;
  if (node.type === 'outfall') {
    wallColor = COLORS.outfall;
    topColor = 0xDD6611;
  } else if (node.type === 'storage') {
    wallColor = COLORS.storage;
    topColor = 0x4477BB;
  }

  if (isSelected) {
    wallColor = COLORS.selected;
    topColor = COLORS.selected;
  }

  const height = Math.max(node.maxDepth * ELEV_SCALE, 1);

  for (let dy = 0; dy < height; dy += BLOCK) {
    const bh = Math.min(BLOCK, height - dy);
    const geo = new THREE.BoxGeometry(BLOCK * 1.4, bh, BLOCK * 1.4);
    const mat = createBlockMaterial(dy >= height - BLOCK ? topColor : wallColor);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(gx, baseY + dy + bh / 2, gz);
    mesh.userData = { nodeId: node.id };
    group.add(mesh);
  }

  if (node.type === 'raingauge') {
    const funnelGeo = new THREE.BoxGeometry(BLOCK * 0.6, BLOCK * 0.8, BLOCK * 0.6);
    const funnelMat = createBlockMaterial(0x4488CC);
    const funnel = new THREE.Mesh(funnelGeo, funnelMat);
    funnel.position.set(gx, baseY + height + 0.4, gz);
    group.add(funnel);
  }

  return group;
}

function createPipeMesh(link: Link, nodes: Node[], isSelected: boolean): THREE.Group {
  const group = new THREE.Group();
  const fromNode = nodes.find(n => n.id === link.fromNode);
  const toNode = nodes.find(n => n.id === link.toNode);
  if (!fromNode || !toNode) return group;

  const from = new THREE.Vector3(
    fromNode.x * SCALE,
    fromNode.invertElev * ELEV_SCALE + 0.5,
    fromNode.y * SCALE
  );
  const to = new THREE.Vector3(
    toNode.x * SCALE,
    toNode.invertElev * ELEV_SCALE + 0.5,
    toNode.y * SCALE
  );

  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len === 0) return group;

  const pipeSize = Math.max(link.diameter * ELEV_SCALE * 0.5, 0.3);

  const segments = Math.max(1, Math.ceil(len / BLOCK));
  const segDir = dir.clone().normalize();

  const color = isSelected ? COLORS.selected : COLORS.pipe;

  for (let i = 0; i < segments; i++) {
    const t = (i + 0.5) / segments;
    const pos = from.clone().lerp(to, t);
    const segLen = len / segments;

    const geo = new THREE.BoxGeometry(pipeSize, pipeSize, segLen * 1.02);
    const mat = createBlockMaterial(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.lookAt(to);
    mesh.userData = { linkId: link.id };
    group.add(mesh);
  }

  return group;
}

function createWaterMesh(link: Link, nodes: Node[]): THREE.Mesh | null {
  const fromNode = nodes.find(n => n.id === link.fromNode);
  const toNode = nodes.find(n => n.id === link.toNode);
  if (!fromNode || !toNode || link.flow <= 0) return null;

  const from = new THREE.Vector3(
    fromNode.x * SCALE,
    fromNode.invertElev * ELEV_SCALE,
    fromNode.y * SCALE
  );
  const to = new THREE.Vector3(
    toNode.x * SCALE,
    toNode.invertElev * ELEV_SCALE,
    toNode.y * SCALE
  );

  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len === 0) return null;

  const pipeSize = Math.max(link.diameter * ELEV_SCALE * 0.5, 0.3);
  const fillRatio = Math.min(link.flow / Math.max(link.capacity, 0.01), 1.0);
  const waterHeight = pipeSize * fillRatio;

  const geo = new THREE.BoxGeometry(pipeSize * 0.85, waterHeight, len);
  const mat = new THREE.MeshLambertMaterial({
    color: COLORS.water,
    transparent: true,
    opacity: 0.6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  const mid = from.clone().lerp(to, 0.5);
  mid.y += waterHeight / 2 + 0.1;
  mesh.position.copy(mid);
  mesh.lookAt(to.clone().add(new THREE.Vector3(0, mid.y - to.y, 0)));
  mesh.lookAt(to);

  return mesh;
}

function createNodeWater(node: Node): THREE.Mesh | null {
  if (node.depth <= 0) return null;
  const gx = node.x * SCALE;
  const gz = node.y * SCALE;
  const baseY = node.invertElev * ELEV_SCALE;
  const waterH = Math.min(node.depth * ELEV_SCALE, node.maxDepth * ELEV_SCALE);

  const geo = new THREE.BoxGeometry(BLOCK * 1.2, waterH, BLOCK * 1.2);
  const mat = new THREE.MeshLambertMaterial({
    color: node.isSurcharged ? 0xFF4444 : COLORS.water,
    transparent: true,
    opacity: 0.55,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(gx, baseY + waterH / 2, gz);
  return mesh;
}

function createSteveBlockModel(): THREE.Group {
  const steve = new THREE.Group();

  const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const headMat = createBlockMaterial(COLORS.skin);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.75;
  steve.add(head);

  const hatGeo = new THREE.BoxGeometry(0.6, 0.2, 0.6);
  const hatMat = createBlockMaterial(COLORS.hardhat);
  const hat = new THREE.Mesh(hatGeo, hatMat);
  hat.position.y = 2.1;
  steve.add(hat);

  const bodyGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
  const bodyMat = createBlockMaterial(COLORS.vest);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.15;
  steve.add(body);

  const legGeo = new THREE.BoxGeometry(0.2, 0.6, 0.25);
  const legMat = createBlockMaterial(COLORS.pants);
  const leftLeg = new THREE.Mesh(legGeo, legMat);
  leftLeg.position.set(-0.12, 0.5, 0);
  leftLeg.name = 'leftLeg';
  steve.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, legMat.clone());
  rightLeg.position.set(0.12, 0.5, 0);
  rightLeg.name = 'rightLeg';
  steve.add(rightLeg);

  const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.2);
  const armMat = createBlockMaterial(COLORS.vest);
  const leftArm = new THREE.Mesh(armGeo, armMat);
  leftArm.position.set(-0.35, 1.15, 0);
  leftArm.name = 'leftArm';
  steve.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, armMat.clone());
  rightArm.position.set(0.35, 1.15, 0);
  rightArm.name = 'rightArm';
  steve.add(rightArm);

  const shoeGeo = new THREE.BoxGeometry(0.22, 0.15, 0.3);
  const shoeMat = createBlockMaterial(COLORS.shoes);
  const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
  leftShoe.position.set(-0.12, 0.15, 0.03);
  steve.add(leftShoe);

  const rightShoe = new THREE.Mesh(shoeGeo, shoeMat.clone());
  rightShoe.position.set(0.12, 0.15, 0.03);
  steve.add(rightShoe);

  return steve;
}

function createRainSystem(): {
  points: THREE.Points;
  positions: Float32Array;
  velocities: Float32Array;
  count: number;
} {
  const count = 3000;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = Math.random() * 30 + 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    velocities[i] = 0.15 + Math.random() * 0.15;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: COLORS.rain,
    size: 0.08,
    transparent: true,
    opacity: 0.6,
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
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    scene.fog = new THREE.Fog(0x87CEEB, 40, 80);
    sceneRef.current = scene;

    const W = container.clientWidth;
    const H = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200);
    camera.position.set(15, 20, 15);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 5;
    controls.maxDistance = 80;
    controlsRef.current = controls;

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(20, 30, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    scene.add(sun);
    sunRef.current = sun;

    const ambient = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambient);
    ambientRef.current = ambient;

    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x5B8C32, 0.3);
    scene.add(hemi);

    const steveModel = createSteveBlockModel();
    steveModel.scale.setScalar(0.6);
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

    const modelGroup = new THREE.Group();
    modelGroupRef.current = modelGroup;

    const terrain = createTerrainChunk(nodes, links);
    modelGroup.add(terrain);

    nodes.forEach(node => {
      const jMesh = createJunctionMesh(node, node.id === selectedId);
      modelGroup.add(jMesh);

      const waterMesh = createNodeWater(node);
      if (waterMesh) {
        modelGroup.add(waterMesh);
        waterMeshesRef.current.push(waterMesh);
      }
    });

    links.forEach(link => {
      const pipeMesh = createPipeMesh(link, nodes, link.id === selectedId);
      modelGroup.add(pipeMesh);

      const waterMesh = createWaterMesh(link, nodes);
      if (waterMesh) {
        modelGroup.add(waterMesh);
        waterMeshesRef.current.push(waterMesh);
      }
    });

    scene.add(modelGroup);

    if (nodes.length > 0 && controlsRef.current) {
      let cx = 0, cz = 0;
      nodes.forEach(n => { cx += n.x * SCALE; cz += n.y * SCALE; });
      cx /= nodes.length;
      cz /= nodes.length;
      controlsRef.current.target.set(cx, 0, cz);
    }

    if (links.length > 0 && nodes.length > 1) {
      const pathPoints: THREE.Vector3[] = [];
      links.forEach(link => {
        const fromNode = nodes.find(n => n.id === link.fromNode);
        const toNode = nodes.find(n => n.id === link.toNode);
        if (fromNode && toNode) {
          pathPoints.push(new THREE.Vector3(
            fromNode.x * SCALE,
            fromNode.invertElev * ELEV_SCALE + 1.5,
            fromNode.y * SCALE
          ));
          pathPoints.push(new THREE.Vector3(
            toNode.x * SCALE,
            toNode.invertElev * ELEV_SCALE + 1.5,
            toNode.y * SCALE
          ));
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
          n.invertElev * ELEV_SCALE + 1,
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
          Math.cos(sunAngle) * 30,
          Math.max(sunHeight * 30, 2),
          15
        );

        const isNight = sunHeight < 0;
        const nightFactor = isNight ? Math.max(0, 1 + sunHeight * 2) : 1;

        sun.intensity = Math.max(0.1, nightFactor * 1.2);
        ambient.intensity = 0.2 + nightFactor * 0.4;

        const skyR = 0.53 * nightFactor + 0.05 * (1 - nightFactor);
        const skyG = 0.81 * nightFactor + 0.05 * (1 - nightFactor);
        const skyB = 0.92 * nightFactor + 0.15 * (1 - nightFactor);
        scene.background = new THREE.Color(skyR, skyG, skyB);
        scene.fog = new THREE.Fog(new THREE.Color(skyR, skyG, skyB), 40, 80);

        if (dayProgress > 0.3 && dayProgress < 0.7) {
          sun.color.setHex(0xffffff);
        } else if (dayProgress < 0.3) {
          sun.color.setHex(0xFFCC88);
        } else {
          sun.color.setHex(0xFF9955);
        }
      }

      const steveModel = steveModelRef.current;
      const stevePath = stevePathRef.current;
      if (steveModel && stevePath) {
        steveTRef.current = (steveTRef.current + 0.002) % 1;
        const pos = stevePath.getPointAt(steveTRef.current);
        const nextPos = stevePath.getPointAt((steveTRef.current + 0.01) % 1);
        steveModel.position.copy(pos);
        steveModel.lookAt(nextPos);

        const walkPhase = Date.now() * 0.008;
        const leftLeg = steveModel.getObjectByName('leftLeg');
        const rightLeg = steveModel.getObjectByName('rightLeg');
        const leftArm = steveModel.getObjectByName('leftArm');
        const rightArm = steveModel.getObjectByName('rightArm');
        if (leftLeg) leftLeg.rotation.x = Math.sin(walkPhase) * 0.5;
        if (rightLeg) rightLeg.rotation.x = Math.sin(walkPhase + Math.PI) * 0.5;
        if (leftArm) leftArm.rotation.x = Math.sin(walkPhase + Math.PI) * 0.4;
        if (rightArm) rightArm.rotation.x = Math.sin(walkPhase) * 0.4;
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
              arr[i * 3] = cx + (Math.random() - 0.5) * 60;
              arr[i * 3 + 1] = 20 + Math.random() * 15;
              arr[i * 3 + 2] = cz + (Math.random() - 0.5) * 60;
            }
          }
          posAttr.needsUpdate = true;
        }
      }

      waterMeshesRef.current.forEach(mesh => {
        const wobble = Math.sin(Date.now() * 0.003) * 0.02;
        mesh.position.y += wobble * 0.1;
        (mesh.material as THREE.MeshLambertMaterial).opacity = 0.45 + Math.sin(Date.now() * 0.002) * 0.1;
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
