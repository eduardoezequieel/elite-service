import type { InspectionZone } from '@elite/shared';
import type * as Three from 'three';

/**
 * spec 126, ADR-016 — El carro en 3D para marcar golpes al recibir.
 *
 * three.js y `OrbitControls` bajan con `import()` solo en el navegador y solo
 * cuando se abre el paso Golpes. Hay un único `WebGLRenderer` vivo mientras el
 * paso está abierto; `dispose()` lo libera al salir. El carro es genérico,
 * armado con geometrías (sin `.glb`), y cada malla es una zona de
 * `INSPECTION_ZONES`. El borrador manda: la escena solo pinta lo que le pasan
 * en `sync()` y avisa qué zona se tocó.
 *
 * Ejes: x a lo largo (frente en +x), y hacia arriba, z a lo ancho (derecha en
 * +z). Metros, aproximados a un compacto. Los colores salen de los tokens de
 * `globals.css` y se releen con `repaint()` al cambiar el tema.
 */

export type ZoneState = 'new' | 'old';
export type CarView = 'front' | 'left' | 'right' | 'rear' | 'top';

export interface CarSceneOptions {
  labelOf: (zone: InspectionZone) => string;
  /** Un toque corto y quieto sobre una zona que no venía dañada. */
  onToggle: (zone: InspectionZone) => void;
  /** La zona bajo el puntero, o `null`. */
  onHover: (zone: InspectionZone | null) => void;
  /** El usuario giró el carro a mano: ninguna vista queda elegida. */
  onFreeView: () => void;
}

export interface CarScene {
  sync: (states: Partial<Record<InspectionZone, ZoneState>>) => void;
  highlight: (zone: InspectionZone | null) => void;
  focusZone: (zone: InspectionZone) => void;
  view: (view: CarView) => void;
  repaint: () => void;
  dispose: () => void;
}

type Angles = readonly [theta: number, phi: number];

const PI = Math.PI;

/** Por zona, la vista [theta, phi] que la deja de frente a la cámara. */
const ZONE_VIEWS: Record<InspectionZone, Angles> = {
  front_bumper: [PI / 2, 1.15],
  rear_bumper: [-PI / 2, 1.15],
  hood: [PI / 2, 0.7],
  roof: [PI / 4, 0.4],
  trunk: [-PI / 2, 0.75],
  windshield: [PI / 2, 0.85],
  rear_window: [-PI / 2, 0.85],
  left_front_door: [PI - 0.25, 1.15],
  right_front_door: [0.25, 1.15],
  left_rear_door: [PI + 0.25, 1.15],
  right_rear_door: [-0.25, 1.15],
  left_front_fender: [PI - 0.7, 1.1],
  right_front_fender: [0.7, 1.1],
  left_rear_fender: [PI + 0.7, 1.1],
  right_rear_fender: [-0.7, 1.1],
  left_mirror: [PI - 0.5, 1.0],
  right_mirror: [0.5, 1.0],
  wheels: [0.35, 1.3],
};

const VIEWS: Record<CarView, Angles> = {
  front: [PI / 2, 1.2],
  left: [PI, 1.2],
  right: [0, 1.2],
  rear: [-PI / 2, 1.2],
  top: [0, 0.12],
};

const START_VIEW: Angles = [0.7, 1.12];

/** Un toque más largo que esto, o que se movió más de 6 px, es un giro. */
const TAP_MS = 600;
const TAP_SLOP_PX = 6;

interface Palette {
  body: Three.Color;
  glass: Three.Color;
  edge: Three.Color;
  hover: Three.Color;
  hoverEdge: Three.Color;
  hit: Three.Color;
  hitEdge: Three.Color;
  old: Three.Color;
  oldEdge: Three.Color;
  floor: Three.Color;
  grid: Three.Color;
  shadow: Three.Color;
  sky: Three.Color;
  ground: Three.Color;
  light: boolean;
}

interface Part {
  zone: InspectionZone;
  glass: boolean;
  mesh: Three.Mesh<Three.BufferGeometry, Three.MeshStandardMaterial>;
  line: Three.LineSegments<Three.EdgesGeometry, Three.LineBasicMaterial>;
}

/** La escena montada dentro de `host`, o `null` sin WebGL. */
export async function createCarScene(
  host: HTMLElement,
  options: CarSceneOptions,
): Promise<CarScene | null> {
  if (typeof window === 'undefined') return null;

  const T = await import('three');
  const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

  let renderer: Three.WebGLRenderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = 'block size-full cursor-grab touch-none';
  canvas.setAttribute('aria-hidden', 'true');

  const tip = document.createElement('div');
  tip.className =
    'bg-surface border-line text-dense text-text pointer-events-none absolute top-0 left-0 z-10 rounded-control border px-2.5 py-1 font-semibold whitespace-nowrap opacity-0 transition-opacity duration-(--duration-state) ease-standard';
  host.append(canvas, tip);

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(32, 1, 0.1, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.6;
  controls.minPolarAngle = 0.08;
  controls.maxPolarAngle = PI / 2 - 0.05;

  const hemi = new T.HemisphereLight();
  const key = new T.DirectionalLight(0xffffff, 1.4);
  key.position.set(4, 7, 3);
  const back = new T.DirectionalLight(0xffffff, 0.8);
  back.position.set(-5, 3, -4);
  scene.add(hemi, key, back);

  // Piso: rejilla polar, sombra de contacto y el chasis bajo el carro.
  const grid = new T.PolarGridHelper(3.3, 12, 5, 64);
  const gridMaterial = grid.material as Three.LineBasicMaterial;
  gridMaterial.vertexColors = false;
  gridMaterial.transparent = true;
  gridMaterial.depthWrite = false;
  gridMaterial.needsUpdate = true;
  grid.position.y = 0.001;
  const shadowMaterial = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(contactShadow()),
    transparent: true,
    depthWrite: false,
  });
  const shadow = new T.Mesh(new T.PlaneGeometry(5.4, 2.6), shadowMaterial);
  shadow.rotation.x = -PI / 2;
  shadow.position.y = 0.002;
  const floorMaterial = new T.MeshStandardMaterial({ roughness: 0.9 });
  const floor = new T.Mesh(new T.BoxGeometry(3.6, 0.04, 1.24), floorMaterial);
  floor.position.set(-0.05, 0.3, 0);
  scene.add(grid, shadow, floor);

  // ---------- Piezas ----------
  const car = new T.Group();
  scene.add(car);
  const parts: Part[] = [];
  const pickables: Three.Object3D[] = [];

  const shape = (draw: (s: Three.Shape) => void) => {
    const s = new T.Shape();
    draw(s);
    return s;
  };
  const poly = (points: readonly (readonly [number, number])[]) =>
    shape((s) => {
      const [first, ...rest] = points;
      if (first === undefined) return;
      s.moveTo(first[0], first[1]);
      for (const [x, y] of rest) s.lineTo(x, y);
      s.closePath();
    });
  const roundRect = (x0: number, y0: number, x1: number, y1: number, r: number) =>
    shape((s) => {
      s.moveTo(x0 + r, y0);
      s.lineTo(x1 - r, y0);
      s.quadraticCurveTo(x1, y0, x1, y0 + r);
      s.lineTo(x1, y1 - r);
      s.quadraticCurveTo(x1, y1, x1 - r, y1);
      s.lineTo(x0 + r, y1);
      s.quadraticCurveTo(x0, y1, x0, y1 - r);
      s.lineTo(x0, y0 + r);
      s.quadraticCurveTo(x0, y0, x0 + r, y0);
    });
  /** Perfil lateral (x, y) extruido a lo ancho, centrado en `zc`, con bisel fino. */
  const slab = (s: Three.Shape, depth: number, zc = 0, bevel = 0.008) => {
    const geometry = new T.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      curveSegments: 24,
    });
    geometry.translate(0, 0, zc - depth / 2);
    return geometry;
  };
  /** La cabina se angosta hacia arriba. */
  const taper = (geometry: Three.BufferGeometry) => {
    const position = geometry.attributes.position;
    if (position === undefined) return geometry;
    for (let index = 0; index < position.count; index++) {
      const y = position.getY(index);
      position.setZ(index, position.getZ(index) * (1 - 0.3 * Math.max(0, y - 0.9)));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  };
  const addPart = (zone: InspectionZone, geometry: Three.BufferGeometry, glass = false) => {
    // El centro va en la malla y no en la geometría: así three ordena bien lo translúcido.
    geometry.computeBoundingBox();
    const center = new T.Vector3();
    geometry.boundingBox?.getCenter(center);
    geometry.translate(-center.x, -center.y, -center.z);
    const mesh = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({
        roughness: glass ? 0.15 : 0.55,
        metalness: glass ? 0.3 : 0.1,
        transparent: true,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      }),
    );
    mesh.position.copy(center);
    const line = new T.LineSegments(
      new T.EdgesGeometry(geometry, 30),
      new T.LineBasicMaterial({ transparent: true }),
    );
    mesh.add(line);
    mesh.userData = { zone };
    car.add(mesh);
    parts.push({ zone, glass, mesh, line });
    pickables.push(mesh);
  };

  addPart(
    'front_bumper',
    slab(
      shape((s) => {
        s.moveTo(1.955, 0.22);
        s.lineTo(2.1, 0.23);
        s.quadraticCurveTo(2.25, 0.45, 2.15, 0.7);
        s.quadraticCurveTo(2.1, 0.77, 1.97, 0.78);
        s.closePath();
      }),
      1.78,
      0,
      0.012,
    ),
  );
  addPart(
    'rear_bumper',
    slab(
      shape((s) => {
        s.moveTo(-2.035, 0.22);
        s.lineTo(-2.13, 0.23);
        s.quadraticCurveTo(-2.24, 0.42, -2.16, 0.64);
        s.lineTo(-2.04, 0.65);
        s.closePath();
      }),
      1.78,
      0,
      0.012,
    ),
  );
  addPart(
    'hood',
    slab(
      shape((s) => {
        s.moveTo(0.99, 0.895);
        s.quadraticCurveTo(1.5, 0.875, 1.93, 0.805);
        s.lineTo(1.93, 0.77);
        s.quadraticCurveTo(1.5, 0.845, 0.99, 0.865);
        s.closePath();
      }),
      1.51,
    ),
  );
  addPart(
    'trunk',
    slab(
      shape((s) => {
        s.moveTo(-1.545, 0.925);
        s.quadraticCurveTo(-1.8, 0.92, -1.98, 0.895);
        s.quadraticCurveTo(-2.04, 0.885, -2.04, 0.82);
        s.lineTo(-2.045, 0.665);
        s.lineTo(-2.005, 0.665);
        s.lineTo(-2.0, 0.82);
        s.quadraticCurveTo(-2.0, 0.85, -1.97, 0.855);
        s.quadraticCurveTo(-1.8, 0.88, -1.545, 0.885);
        s.closePath();
      }),
      1.51,
    ),
  );
  addPart(
    'windshield',
    taper(
      slab(
        poly([
          [0.97, 0.9],
          [0.265, 1.355],
          [0.251, 1.334],
          [0.956, 0.879],
        ]),
        1.5,
      ),
    ),
    true,
  );
  addPart(
    'roof',
    taper(
      slab(
        shape((s) => {
          s.moveTo(0.285, 1.36);
          s.quadraticCurveTo(-0.32, 1.43, -0.93, 1.36);
          s.lineTo(-0.91, 1.33);
          s.quadraticCurveTo(-0.32, 1.4, 0.265, 1.33);
          s.closePath();
        }),
        1.5,
      ),
    ),
  );
  addPart(
    'rear_window',
    taper(
      slab(
        poly([
          [-0.935, 1.355],
          [-1.52, 0.925],
          [-1.505, 0.905],
          [-0.92, 1.335],
        ]),
        1.5,
      ),
    ),
    true,
  );

  // Costados: el mismo perfil a cada lado; los arcos de las llantas se recortan del panel.
  const fender = shape((s) => {
    s.moveTo(1.0, 0.32);
    s.lineTo(1.03, 0.32);
    s.absarc(1.4, 0.32, 0.37, PI, 0, true);
    s.lineTo(1.94, 0.32);
    s.lineTo(1.94, 0.72);
    s.quadraticCurveTo(1.93, 0.8, 1.8, 0.815);
    s.quadraticCurveTo(1.4, 0.86, 1.0, 0.885);
    s.closePath();
  });
  const quarter = shape((s) => {
    s.moveTo(-0.97, 0.32);
    s.lineTo(-1.03, 0.32);
    s.absarc(-1.4, 0.32, 0.37, 0, PI, false);
    s.lineTo(-2.0, 0.32);
    s.lineTo(-2.03, 0.8);
    s.quadraticCurveTo(-2.01, 0.89, -1.9, 0.89);
    s.lineTo(-0.97, 0.892);
    s.closePath();
  });
  const door = (x0: number, x1: number) =>
    shape((s) => {
      const yb = 0.28;
      const r = 0.05;
      s.moveTo(x0 + r, yb);
      s.lineTo(x1 - r, yb);
      s.quadraticCurveTo(x1, yb, x1, yb + r);
      s.lineTo(x1, 0.89);
      s.lineTo(x0, 0.89);
      s.lineTo(x0, yb + r);
      s.quadraticCurveTo(x0, yb, x0 + r, yb);
    });
  const frontGlass = poly([
    [0.92, 0.905],
    [0.34, 1.31],
    [0.03, 1.31],
    [0.03, 0.905],
  ]);
  const rearGlass = poly([
    [-0.03, 0.905],
    [-0.03, 1.31],
    [-0.9, 1.31],
    [-0.94, 0.905],
  ]);
  const quarterGlass = poly([
    [-0.985, 0.905],
    [-0.985, 1.28],
    [-1.45, 0.905],
  ]);
  const glassAt = (s: Three.Shape, side: number) => taper(slab(s, 0.02, side * 0.755, 0.004));
  const handle = (x0: number, side: number) =>
    slab(roundRect(x0, 0.76, x0 + 0.14, 0.79, 0.012), 0.012, side * 0.918, 0.004);

  for (const side of [1, -1] as const) {
    const right = side > 0;
    const zone = (left: InspectionZone, rightZone: InspectionZone) => (right ? rightZone : left);
    addPart(zone('left_front_fender', 'right_front_fender'), slab(fender, 0.14, side * 0.83));
    const frontDoor = zone('left_front_door', 'right_front_door');
    addPart(frontDoor, slab(door(0.015, 0.985), 0.16, side * 0.82));
    addPart(frontDoor, glassAt(frontGlass, side), true);
    addPart(frontDoor, handle(0.1, side));
    const rearDoor = zone('left_rear_door', 'right_rear_door');
    addPart(rearDoor, slab(door(-0.955, -0.015), 0.16, side * 0.82));
    addPart(rearDoor, glassAt(rearGlass, side), true);
    addPart(rearDoor, handle(-0.86, side));
    const rearFender = zone('left_rear_fender', 'right_rear_fender');
    addPart(rearFender, slab(quarter, 0.14, side * 0.83));
    addPart(rearFender, glassAt(quarterGlass, side), true);
    const mirror = zone('left_mirror', 'right_mirror');
    addPart(mirror, slab(roundRect(0.7, 0.93, 0.88, 1.05, 0.03), 0.13, side * 0.97));
    addPart(mirror, slab(roundRect(0.76, 0.885, 0.84, 0.95, 0.01), 0.05, side * 0.915, 0.004));
    for (const x of [1.4, -1.4]) {
      for (const [radius, width] of [
        [0.31, 0.2],
        [0.19, 0.22],
      ] as const) {
        const wheel = new T.CylinderGeometry(radius, radius, width, 40);
        wheel.rotateX(PI / 2);
        wheel.translate(x, 0.32, side * 0.79);
        addPart('wheels', wheel);
      }
    }
  }

  // ---------- Pintura por estado ----------
  let palette = readPalette(T);
  let states: Partial<Record<InspectionZone, ZoneState>> = {};
  let hoverZone: InspectionZone | null = null;
  let listZone: InspectionZone | null = null;

  const paint = (part: Part) => {
    const state = states[part.zone];
    const hot = part.zone === hoverZone || part.zone === listZone;
    const material = part.mesh.material;
    const edge = part.line.material;
    let opacity: number;

    if (state === 'new') {
      material.color.copy(palette.hit);
      material.emissive.copy(palette.hit);
      material.emissiveIntensity = hot ? 0.6 : 0.32;
      edge.color.copy(palette.hitEdge);
      opacity = part.glass ? 0.55 : 0.72;
    } else if (state === 'old') {
      material.color.copy(palette.old);
      material.emissive.copy(palette.oldEdge);
      material.emissiveIntensity = hot ? 0.12 : 0;
      edge.color.copy(palette.oldEdge);
      opacity = part.glass ? 0.5 : 0.85;
    } else {
      material.color.copy(hot ? palette.hover : part.glass ? palette.glass : palette.body);
      material.emissive.copy(palette.edge);
      material.emissiveIntensity = hot ? 0.22 : 0;
      edge.color.copy(hot ? palette.hoverEdge : palette.edge);
      opacity = part.glass ? 0.45 : 0.9;
    }
    material.opacity = hot && state !== 'old' ? Math.min(1, opacity + 0.08) : opacity;
    edge.opacity = state === 'old' || (part.glass && state === undefined) ? 0.7 : 1;
  };
  const paintAll = () => {
    for (const part of parts) paint(part);
  };
  const paintDecor = () => {
    floorMaterial.color.copy(palette.floor);
    gridMaterial.color.copy(palette.grid);
    gridMaterial.opacity = palette.light ? 0.5 : 0.35;
    shadowMaterial.color.copy(palette.shadow);
    shadowMaterial.opacity = palette.light ? 0.2 : 0.55;
    hemi.color.copy(palette.sky);
    hemi.groundColor.copy(palette.ground);
    hemi.intensity = palette.light ? 2.6 : 2.4;
    key.intensity = palette.light ? 1.6 : 2.2;
  };

  // ---------- Cámara ----------
  let fit = 0;
  let flight: {
    from: { theta: number; phi: number; radius: number };
    to: { theta: number; phi: number; radius: number };
    startedAt: number;
    duration: number;
  } | null = null;

  const fitDistance = (aspect: number) => {
    const tan = Math.tan(T.MathUtils.degToRad(camera.fov / 2));
    return Math.max(1.45 / tan, 2.4 / (tan * aspect)) + 0.6;
  };
  const place = ([theta, phi]: Angles, radius: number) => {
    camera.position.setFromSphericalCoords(radius, phi, theta).add(controls.target);
    controls.update();
  };
  const flyTo = ([theta, phi]: Angles) => {
    const current = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    const turn = Math.atan2(Math.sin(theta - current.theta), Math.cos(theta - current.theta));
    flight = {
      from: { theta: current.theta, phi: current.phi, radius: current.radius },
      to: { theta: current.theta + turn, phi, radius: fit },
      startedAt: performance.now(),
      duration: reduced ? 0 : 650,
    };
  };
  const stepFlight = (now: number) => {
    if (flight === null) return;
    const progress =
      flight.duration === 0 ? 1 : Math.min(1, (now - flight.startedAt) / flight.duration);
    const eased = 1 - (1 - progress) ** 3;
    const { from, to } = flight;
    camera.position
      .setFromSphericalCoords(
        from.radius + (to.radius - from.radius) * eased,
        from.phi + (to.phi - from.phi) * eased,
        from.theta + (to.theta - from.theta) * eased,
      )
      .add(controls.target);
    if (progress === 1) flight = null;
  };
  controls.addEventListener('start', () => {
    flight = null;
    options.onFreeView();
  });

  // ---------- Tamaño ----------
  const resize = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const distance = fitDistance(camera.aspect);
    controls.minDistance = distance * 0.55;
    controls.maxDistance = distance * 1.4;
    if (fit === 0) place(START_VIEW, distance);
    else if (distance !== fit) {
      camera.position
        .sub(controls.target)
        .multiplyScalar(distance / fit)
        .add(controls.target);
      if (flight !== null) flight.to.radius = distance;
    }
    fit = distance;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  // ---------- Puntero: hover, nombre de la pieza y toque ----------
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  let pointer: { x: number; y: number } | null = null;
  let pressed: { x: number; y: number; at: number; moved: boolean } | null = null;
  let needPick = false;
  let flashTimer: number | null = null;

  const local = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  const pick = (x: number, y: number): InspectionZone | null => {
    ndc.set((x / canvas.clientWidth) * 2 - 1, -(y / canvas.clientHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    const zone: unknown = hit?.object.userData.zone;
    return typeof zone === 'string' ? (zone as InspectionZone) : null;
  };
  const setHover = (zone: InspectionZone | null) => {
    if (zone === hoverZone) return;
    hoverZone = zone;
    paintAll();
    canvas.style.cursor = zone === null ? '' : states[zone] === 'old' ? 'not-allowed' : 'pointer';
    options.onHover(zone);
  };
  const showTip = (zone: InspectionZone, at: { x: number; y: number }) => {
    if (tip.dataset.zone !== zone) {
      tip.textContent = options.labelOf(zone);
      if (states[zone] === 'old') {
        const note = document.createElement('span');
        note.className = 'text-warn-text ml-2 font-medium';
        note.textContent = 'Ya venía';
        tip.append(note);
      }
      tip.dataset.zone = zone;
    }
    const x = Math.min(Math.max(4, at.x + 14), canvas.clientWidth - tip.offsetWidth - 4);
    const y = at.y - tip.offsetHeight - 12 < 4 ? at.y + 18 : at.y - tip.offsetHeight - 12;
    tip.style.transform = `translate(${x}px, ${y}px)`;
    tip.style.opacity = '1';
  };
  const hideTip = () => {
    tip.style.opacity = '0';
  };
  /** En táctil no hay hover: el nombre aparece un momento donde se tocó. */
  const flashTip = (zone: InspectionZone, at: { x: number; y: number }) => {
    showTip(zone, at);
    if (flashTimer !== null) window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(() => {
      flashTimer = null;
      if (hoverZone === null) hideTip();
    }, 1200);
  };

  const onPointerDown = (event: PointerEvent) => {
    pressed = { x: event.clientX, y: event.clientY, at: performance.now(), moved: false };
  };
  const onPointerMove = (event: PointerEvent) => {
    if (
      pressed !== null &&
      !pressed.moved &&
      Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > TAP_SLOP_PX
    ) {
      pressed.moved = true;
      setHover(null);
      hideTip();
    }
    if (event.pointerType === 'mouse') {
      pointer = local(event);
      needPick = true;
    }
  };
  const onPointerLeave = () => {
    pointer = null;
    setHover(null);
    if (flashTimer === null) hideTip();
  };
  const onPointerUp = (event: PointerEvent) => {
    const press = pressed;
    pressed = null;
    needPick = true;
    // Arrastrar gira el carro; solo un toque corto y quieto marca la pieza.
    if (press === null || press.moved || performance.now() - press.at > TAP_MS) return;
    const at = local(event);
    const zone = pick(at.x, at.y);
    if (zone === null) return;
    if (event.pointerType !== 'mouse') flashTip(zone, at);
    if (states[zone] !== 'old') options.onToggle(zone);
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('pointerup', onPointerUp);

  // ---------- Bucle, solo mientras el visor vive ----------
  let frameId = 0;
  const frame = (now: number) => {
    stepFlight(now);
    controls.update();
    if (flight !== null && pointer !== null) needPick = true;
    if (needPick && !(pressed?.moved ?? false)) {
      needPick = false;
      const zone = pointer === null ? null : pick(pointer.x, pointer.y);
      setHover(zone);
      if (zone !== null && pointer !== null) showTip(zone, pointer);
      else if (flashTimer === null) hideTip();
    }
    renderer.render(scene, camera);
    frameId = window.requestAnimationFrame(frame);
  };

  paintAll();
  paintDecor();
  resize();
  frameId = window.requestAnimationFrame(frame);

  return {
    sync(next) {
      states = next;
      tip.dataset.zone = '';
      paintAll();
    },
    highlight(zone) {
      if (zone === listZone) return;
      listZone = zone;
      paintAll();
    },
    focusZone(zone) {
      if (fit === 0) return;
      flyTo(ZONE_VIEWS[zone]);
    },
    view(view) {
      flyTo(VIEWS[view]);
    },
    repaint() {
      palette = readPalette(T);
      paintAll();
      paintDecor();
    },
    dispose() {
      window.cancelAnimationFrame(frameId);
      if (flashTimer !== null) window.clearTimeout(flashTimer);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      scene.traverse((node) => {
        if (node instanceof T.Mesh || node instanceof T.LineSegments) {
          node.geometry.dispose();
          const materials: Three.Material[] = Array.isArray(node.material)
            ? node.material
            : [node.material];
          for (const material of materials) material.dispose();
        }
      });
      shadowMaterial.map?.dispose();
      renderer.dispose();
      canvas.remove();
      tip.remove();
    },
  };
}

/** Los colores de la escena, de los tokens del tema que está puesto. */
function readPalette(T: typeof Three): Palette {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const token = (name: string) => {
    const color = new T.Color();
    const value = css.getPropertyValue(name).trim();
    if (value !== '') color.setStyle(value);
    return color;
  };
  const surface = token('--surface');
  const info = token('--info-text');

  return {
    body: token('--surface-3'),
    glass: token('--surface-2').lerp(info, 0.25),
    edge: info,
    hover: token('--line'),
    hoverEdge: token('--text'),
    hit: token('--danger'),
    hitEdge: token('--danger-text'),
    old: token('--warn').lerp(surface, 0.65),
    oldEdge: token('--warn-text'),
    floor: surface,
    grid: token('--line'),
    shadow: token('--bg'),
    sky: token('--text'),
    ground: token('--surface'),
    light: root.classList.contains('light'),
  };
}

/** Sombra de contacto: un degradado radial que tiñe el material del piso. */
function contactShadow(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (context !== null) {
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.45)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }

  return canvas;
}
