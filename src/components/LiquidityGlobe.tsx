import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CandlestickChart,
  ChevronDown,
  ChevronUp,
  Compass,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useTrading } from '../contexts/TradingContext.tsx';
import {
  GLOBAL_FINANCIAL_HUBS,
  computeAnalyticalLiquidityZones,
  mapSymbolToHubs,
} from '../lib/marketHubs.ts';
import type { FinancialHub, GlobeMode, SymbolSpec } from '../types/trading.ts';

// Pre-allocated math scratch objects for zero-GC render loop
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();

function latLonToVec3(lat: number, lon: number, radius: number, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  out.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
  return out;
}

function buildEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Deep ocean gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#040812');
  grad.addColorStop(0.5, '#071124');
  grad.addColorStop(1, '#040812');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle bathymetric grid
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Stylized macro-continental landmasses (approximate polygons for institutional clarity)
  const continents: Array<Array<[number, number]>> = [
    // North America
    [
      [-168, 65], [-140, 70], [-95, 70], [-55, 52], [-65, 44], [-80, 26], [-95, 18],
      [-84, 9], [-105, 20], [-118, 32], [-125, 48], [-150, 60],
    ],
    // South America
    [
      [-80, 10], [-62, 10], [-35, -6], [-40, -22], [-54, -34], [-68, -54], [-74, -46],
      [-72, -18], [-81, -4],
    ],
    // Europe
    [
      [-10, 36], [-9, 43], [-2, 48], [6, 54], [10, 58], [26, 70], [42, 68], [55, 55],
      [42, 42], [28, 41], [15, 38], [2, 41],
    ],
    // Africa
    [
      [-17, 15], [-6, 35], [10, 37], [32, 31], [43, 12], [51, 11], [40, -10], [33, -26],
      [20, -35], [14, -22], [9, 4], [-10, 6],
    ],
    // Asia
    [
      [42, 42], [55, 55], [75, 72], [130, 72], [170, 66], [142, 52], [132, 42], [122, 32],
      [110, 20], [104, 2], [96, 16], [88, 22], [78, 8], [68, 24], [56, 26], [36, 30],
    ],
    // Australia
    [
      [114, -22], [130, -12], [142, -11], [153, -26], [148, -38], [136, -35], [116, -34],
    ],
    // Japan / UK / Greenland accents
    [[130, 31], [141, 38], [145, 44], [139, 41]],
    [[-6, 50], [1, 52], [-2, 58], [-6, 56]],
    [[-52, 60], [-20, 70], [-22, 82], [-58, 78]],
  ];

  ctx.fillStyle = '#0F1D36';
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.42)';
  ctx.lineWidth = 2;

  for (const poly of continents) {
    ctx.beginPath();
    poly.forEach(([lon, lat], idx) => {
      const x = ((lon + 180) / 360) * width;
      const y = ((90 - lat) / 180) * height;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Subtle financial hub ground glow
  for (const hub of GLOBAL_FINANCIAL_HUBS) {
    const x = ((hub.lon + 180) / 360) * width;
    const y = ((90 - hub.lat) / 180) * height;
    const rg = ctx.createRadialGradient(x, y, 2, x, y, 28);
    rg.addColorStop(0, 'rgba(34, 211, 238, 0.55)');
    rg.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface LiquidityGlobeProps {
  fullViewport?: boolean;
  onToggleExpand?: () => void;
}

export const LiquidityGlobe: React.FC<LiquidityGlobeProps> = ({ fullViewport, onToggleExpand }) => {
  const {
    globeMode,
    setGlobeMode,
    allSymbols,
    selectedSymbol,
    setSelectedSymbol,
    openChartTab,
    positions,
    marketDepth,
    candles,
    bridgeStatus,
  } = useTrading();

  const mountRef = useRef<HTMLDivElement | null>(null);
  const [selectedHub, setSelectedHub] = useState<FinancialHub>(GLOBAL_FINANCIAL_HUBS[0]);
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [contextLost, setContextLost] = useState(false);

  const selectedSymSpec: SymbolSpec | undefined = useMemo(
    () => allSymbols.find((s) => s.symbol === selectedSymbol),
    [allSymbols, selectedSymbol]
  );

  const symPositions = useMemo(
    () => positions.filter((p) => p.symbol === selectedSymbol),
    [positions, selectedSymbol]
  );

  const analyticalZones = useMemo(() => computeAnalyticalLiquidityZones(candles), [candles]);

  // Refs for live sync into Three.js loop without tearing down canvas
  const stateRef = useRef({
    globeMode,
    allSymbols,
    positions,
    selectedSymbol,
    autoRotate,
    flyTarget: null as THREE.Vector3 | null,
  });

  useEffect(() => {
    stateRef.current.globeMode = globeMode;
    stateRef.current.allSymbols = allSymbols;
    stateRef.current.positions = positions;
    stateRef.current.selectedSymbol = selectedSymbol;
    stateRef.current.autoRotate = autoRotate;
  }, [globeMode, allSymbols, positions, selectedSymbol, autoRotate]);

  // Trigger smooth camera fly-to when selectedSymbol changes
  useEffect(() => {
    const sym = allSymbols.find((s) => s.symbol === selectedSymbol);
    const [primaryHub] = mapSymbolToHubs(selectedSymbol, sym?.category || 'Forex');
    setSelectedHub(primaryHub);
    stateRef.current.flyTarget = latLonToVec3(primaryHub.lat, primaryHub.lon, 5.2, new THREE.Vector3());
  }, [selectedSymbol, allSymbols]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 560;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050811');
    scene.fog = new THREE.FogExp2('#050811', 0.045);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 1.8, 5.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => setContextLost(false);
    renderer.domElement.addEventListener('webglcontextlost', handleLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleRestored);

    // Studio Environment + 3-Point Lighting
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x050811, 0.85);
    scene.add(hemiLight);
    const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.6);
    keyLight.position.set(6, 5, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x06b6d4, 1.1);
    rimLight.position.set(-6, -2, -5);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3.1;
    controls.maxDistance = 10.5;
    controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate;
    controls.autoRotateSpeed = 0.45;
    controls.addEventListener('start', () => {
      stateRef.current.flyTarget = null;
    });

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const GLOBE_RADIUS = 2.0;

    // 1. Primary Earth Sphere
    const earthTexture = buildEarthTexture();
    earthTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 48);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.58,
      metalness: 0.25,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // 2. Atmospheric Fresnel Rim Shader
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.045, 48, 36);
    const atmosMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.2);
          gl_FragColor = vec4(0.06, 0.72, 0.88, 1.0) * intensity * 0.85;
        }
      `,
    });
    globeGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

    // 3. Outer Orbital Telemetry Ring
    const ringGeo = new THREE.RingGeometry(GLOBE_RADIUS * 1.18, GLOBE_RADIUS * 1.19, 128);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const eqRing = new THREE.Mesh(ringGeo, ringMat);
    eqRing.rotation.x = Math.PI / 2;
    globeGroup.add(eqRing);

    // 4. Instanced Starfield & Instrument Coverage Lattice (2000 nodes)
    const STAR_COUNT = 600;
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 14 + (i % 9) * 1.8;
      const theta = i * 2.39996;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / STAR_COUNT);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x475569, size: 0.06, transparent: true, opacity: 0.7 });
    scene.add(new THREE.Points(starGeo, starMat));

    // 1800 Data-Driven Surface Lattice Nodes via InstancedMesh
    const NODE_COUNT = 1800;
    const nodeGeo = new THREE.SphereGeometry(0.013, 6, 6);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const latticeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, NODE_COUNT);
    for (let i = 0; i < NODE_COUNT; i++) {
      const y = 1 - (i / (NODE_COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = i * 2.399963229728653;
      _vecA.set(Math.cos(theta) * radiusAtY, y, Math.sin(theta) * radiusAtY).multiplyScalar(GLOBE_RADIUS + 0.012);
      _scale.setScalar(i % 7 === 0 ? 1.45 : 0.85);
      _mat4.compose(_vecA, _quat, _scale);
      latticeMesh.setMatrixAt(i, _mat4);
      _color.setHex(i % 11 === 0 ? 0x22d3ee : i % 5 === 0 ? 0x3b82f6 : 0x1e3a5f);
      latticeMesh.setColorAt(i, _color);
    }
    latticeMesh.instanceMatrix.needsUpdate = true;
    if (latticeMesh.instanceColor) latticeMesh.instanceColor.needsUpdate = true;
    latticeMesh.computeBoundingSphere();
    globeGroup.add(latticeMesh);

    // 5. Financial Hub Beacons (Interactive Raycast Targets)
    const hubGroup = new THREE.Group();
    globeGroup.add(hubGroup);
    const hubClickables: THREE.Object3D[] = [];

    GLOBAL_FINANCIAL_HUBS.forEach((hub) => {
      const pos = latLonToVec3(hub.lat, hub.lon, GLOBE_RADIUS + 0.025);
      const beaconGroup = new THREE.Group();
      beaconGroup.position.copy(pos);
      beaconGroup.lookAt(0, 0, 0);

      // Core node
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.042, 12, 12),
        new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          emissive: 0x06b6d4,
          emissiveIntensity: 0.9,
          roughness: 0.2,
          metalness: 0.8,
        })
      );
      core.userData.hub = hub;
      beaconGroup.add(core);
      hubClickables.push(core);

      // Halo Ring
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.055, 0.075, 24),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        })
      );
      beaconGroup.add(halo);
      hubGroup.add(beaconGroup);
    });

    // 6. Great-Circle Network Arcs & Animated Liquidity Pulses
    const arcGroup = new THREE.Group();
    globeGroup.add(arcGroup);
    const arcCurves: THREE.QuadraticBezierCurve3[] = [];

    const hubPairs: [number, number][] = [
      [0, 1], [1, 2], [0, 3], [0, 4], [0, 5], [5, 6], [6, 7], [6, 8], [6, 9], [1, 6], [3, 7],
    ];
    hubPairs.forEach(([aIdx, bIdx]) => {
      const a = latLonToVec3(GLOBAL_FINANCIAL_HUBS[aIdx].lat, GLOBAL_FINANCIAL_HUBS[aIdx].lon, GLOBE_RADIUS + 0.02);
      const b = latLonToVec3(GLOBAL_FINANCIAL_HUBS[bIdx].lat, GLOBAL_FINANCIAL_HUBS[bIdx].lon, GLOBE_RADIUS + 0.02);
      _mid.addVectors(a, b).multiplyScalar(0.5);
      const dist = a.distanceTo(b);
      _mid.normalize().multiplyScalar(GLOBE_RADIUS + 0.28 + dist * 0.22);
      const curve = new THREE.QuadraticBezierCurve3(a.clone(), _mid.clone(), b.clone());
      arcCurves.push(curve);

      const pts = curve.getPoints(44);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.35,
      });
      arcGroup.add(new THREE.Line(lineGeo, lineMat));
    });

    // Animated pulse particles moving along arcs
    const PULSE_COUNT = arcCurves.length * 2;
    const pulseMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.025, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9 }),
      PULSE_COUNT
    );
    pulseMesh.frustumCulled = false;
    globeGroup.add(pulseMesh);

    // 7. Dynamic Position Arcs Layer (Rebuilt smoothly when positions or mode change)
    const positionArcGroup = new THREE.Group();
    globeGroup.add(positionArcGroup);
    let lastPositionsSig = '';

    const rebuildPositionArcs = () => {
      const { positions: curPos, allSymbols: curSyms, globeMode: mode } = stateRef.current;
      const sig = `${mode}:${curPos.map((p) => `${p.ticket}:${p.floatingPnl.toFixed(1)}`).join(',')}`;
      if (sig === lastPositionsSig) return;
      lastPositionsSig = sig;

      while (positionArcGroup.children.length > 0) {
        const child = positionArcGroup.children.pop()!;
        positionArcGroup.remove(child);
      }

      if (mode !== 'ACCOUNT' && mode !== 'COMBINED') return;
      for (const pos of curPos) {
        const sym = curSyms.find((s) => s.symbol === pos.symbol);
        const [h1, h2] = mapSymbolToHubs(pos.symbol, sym?.category || 'Forex');
        const p1 = latLonToVec3(h1.lat, h1.lon, GLOBE_RADIUS + 0.04);
        const p2 = latLonToVec3(h2.lat, h2.lon, GLOBE_RADIUS + 0.04);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        mid.normalize().multiplyScalar(GLOBE_RADIUS + 0.72);
        const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
        const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.012, 8, false);
        const tubeMat = new THREE.MeshBasicMaterial({
          color: pos.floatingPnl >= 0 ? 0x10b981 : 0xef4444,
          transparent: true,
          opacity: 0.9,
        });
        positionArcGroup.add(new THREE.Mesh(tubeGeo, tubeMat));
      }
    };

    // Raycaster for Hub selection
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let lastHoverCheck = 0;

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 60) return;
      lastHoverCheck = now;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hubClickables, false);
      renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
    };

    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hubClickables, false);
      if (hits.length > 0) {
        const hub = hits[0].object.userData.hub as FinancialHub | undefined;
        if (hub) {
          setSelectedHub(hub);
          stateRef.current.flyTarget = latLonToVec3(hub.lat, hub.lon, 5.0, new THREE.Vector3());
          const matchSym = stateRef.current.allSymbols.find((s) =>
            hub.primaryCategories.includes(s.category)
          );
          if (matchSym) setSelectedSymbol(matchSym.symbol);
        }
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('click', onClick);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate && !stateRef.current.flyTarget;
      controls.update();

      // Smooth exponential camera damping toward selected hub
      if (stateRef.current.flyTarget) {
        const target = stateRef.current.flyTarget;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, target.x, 4.5, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, target.y, 4.5, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, target.z, 4.5, dt);
        camera.lookAt(0, 0, 0);
        if (camera.position.distanceTo(target) < 0.05) {
          stateRef.current.flyTarget = null;
        }
      }

      // Visibility by Globe Mode
      const mode = stateRef.current.globeMode;
      arcGroup.visible = mode === 'COMBINED' || mode === 'NETWORK' || mode === 'ACTIVITY';
      pulseMesh.visible = mode === 'COMBINED' || mode === 'NETWORK' || mode === 'ACTIVITY';
      rebuildPositionArcs();

      // Animate network pulses
      if (pulseMesh.visible) {
        for (let i = 0; i < PULSE_COUNT; i++) {
          const curve = arcCurves[i % arcCurves.length];
          const offset = i >= arcCurves.length ? 0.5 : 0;
          const speed = mode === 'ACTIVITY' ? 0.32 : 0.18;
          const t = (elapsed * speed + offset + (i % 5) * 0.11) % 1;
          curve.getPointAt(t, _vecB);
          _scale.setScalar(1);
          _mat4.compose(_vecB, _quat, _scale);
          pulseMesh.setMatrixAt(i, _mat4);
        }
        pulseMesh.instanceMatrix.needsUpdate = true;
      }

      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      controls.dispose();
      earthTexture.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, [setSelectedSymbol]);

  const modes: { id: GlobeMode; label: string }[] = [
    { id: 'COMBINED', label: 'Combined View' },
    { id: 'NETWORK', label: 'Market Network' },
    { id: 'ACTIVITY', label: 'Live Activity' },
    { id: 'ACCOUNT', label: 'My Account Network' },
  ];

  return (
    <div className="relative w-full h-full min-h-[460px] bg-[#050811] overflow-hidden select-none">
      {/* Isolated WebGL Canvas Container */}
      <div ref={mountRef} className="w-full h-full" />

      {contextLost && (
        <div className="absolute inset-0 bg-[#050811]/95 flex items-center justify-center p-6 text-center">
          <div className="space-y-2 max-w-sm">
            <div className="text-sm font-semibold text-white">WebGL Context Suspended</div>
            <p className="text-xs text-slate-400">
              Hardware graphics resources were paused. Restore or reload to resume the 3D Global Liquidity Globe.
            </p>
          </div>
        </div>
      )}

      {/* Top-Left Minimal Selected Instrument & Hub HUD */}
      <div className="absolute top-4 left-4 z-10 max-w-xs w-full bg-[#090F1D]/90 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] text-cyan-400 font-medium truncate">
              {selectedHub.name} · {selectedHub.exchange}
            </div>
            <div className="font-display text-base font-bold text-white truncate">
              {selectedSymbol}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {selectedSymSpec?.description || 'Select a symbol from Market Watch'}
            </div>
          </div>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              title={fullViewport ? 'Return to Terminal' : 'Expand Globe'}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer shrink-0"
            >
              {fullViewport ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>

        {/* Live Authoritative Quote */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono-tabular">
          <div>
            <div className="text-[10px] text-slate-500">BID</div>
            <div className="text-slate-100 font-semibold">
              {selectedSymSpec ? selectedSymSpec.bid.toFixed(selectedSymSpec.digits) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">ASK</div>
            <div className="text-slate-100 font-semibold">
              {selectedSymSpec ? selectedSymSpec.ask.toFixed(selectedSymSpec.digits) : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500">SPREAD</div>
            <div className="text-cyan-300 font-semibold">
              {selectedSymSpec ? `${selectedSymSpec.spread} pts` : '—'}
            </div>
          </div>
        </div>

        {/* Source & Liquidity Distinction */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1 text-[11px]">
          <div className="flex items-center justify-between text-slate-400">
            <span>Feed Source</span>
            <span className="text-slate-200 font-medium">
              {selectedSymSpec?.provider || (bridgeStatus.connected ? 'Exness MT5' : 'Unavailable')}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span>Actual Order Book</span>
            <span className={marketDepth?.available ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
              {marketDepth?.available ? `${marketDepth.bids.length}L Active` : 'MARKET DEPTH NOT AVAILABLE'}
            </span>
          </div>
          {analyticalZones.length > 0 && (
            <div className="flex items-center justify-between text-slate-400">
              <span>Analytical Estimate</span>
              <span className="font-mono-tabular text-violet-300">
                R1 {analyticalZones[1]?.price.toFixed(selectedSymSpec?.digits ?? 2)} · S1{' '}
                {analyticalZones[2]?.price.toFixed(selectedSymSpec?.digits ?? 2)}
              </span>
            </div>
          )}
        </div>

        {/* Connected User Open Positions for Selected Symbol */}
        {symPositions.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 space-y-1">
            <div className="text-[10px] font-semibold text-slate-400">
              OPEN ACCOUNT POSITIONS ({symPositions.length})
            </div>
            {symPositions.map((pos) => (
              <div key={pos.ticket} className="flex items-center justify-between text-xs font-mono-tabular">
                <span className={pos.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'}>
                  {pos.side} {pos.volume} @ {pos.entryPrice}
                </span>
                <span className={pos.floatingPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                  {pos.floatingPnl >= 0 ? '+' : ''}
                  {pos.floatingPnl.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => openChartTab(selectedSymbol)}
          className="w-full py-1.5 px-3 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/35 text-cyan-300 text-xs font-medium rounded inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <CandlestickChart className="w-3.5 h-3.5" />
          Open {selectedSymbol} Chart
        </button>
      </div>

      {/* Collapsible Unified Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-[94vw] flex flex-col items-center">
        <button
          type="button"
          onClick={() => setControlsCollapsed((v) => !v)}
          className="px-3 py-1 bg-[#090F1D]/95 border border-slate-800 border-b-0 rounded-t text-[11px] text-slate-300 hover:text-white inline-flex items-center gap-1 cursor-pointer"
        >
          {controlsCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {controlsCollapsed ? 'Show Globe Controls' : 'Hide Controls'}
        </button>

        {!controlsCollapsed && (
          <div className="bg-[#090F1D]/95 border border-slate-800 rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">
            {/* 4 Globe Modes */}
            <div className="flex items-center gap-1 bg-[#050811] p-0.5 rounded border border-slate-800/80">
              {modes.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setGlobeMode(m.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                    globeMode === m.id
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Hub Quick Focus */}
            <select
              value={selectedHub.id}
              onChange={(e) => {
                const hub = GLOBAL_FINANCIAL_HUBS.find((h) => h.id === e.target.value);
                if (hub) {
                  setSelectedHub(hub);
                  stateRef.current.flyTarget = latLonToVec3(hub.lat, hub.lon, 5.0, new THREE.Vector3());
                }
              }}
              aria-label="Focus financial hub"
              className="bg-[#050811] border border-slate-800 text-xs text-slate-200 rounded px-2.5 py-1 outline-none focus:border-cyan-500"
            >
              {GLOBAL_FINANCIAL_HUBS.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.city} · {h.exchange}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setAutoRotate((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors cursor-pointer whitespace-nowrap ${
                autoRotate
                  ? 'bg-blue-500/15 border-blue-500/35 text-blue-300'
                  : 'bg-[#050811] border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              {autoRotate ? 'Rotation On' : 'Rotation Off'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
