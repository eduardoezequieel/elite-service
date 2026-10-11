import type { FleetVehicleCategory } from '@elite/shared';
import type * as Three from 'three';

/**
 * spec 115, RN-3 — El carro en 3D, visto en diagonal de frente.
 *
 * three.js baja con `import()` solo en el navegador (ADR-015). Un solo renderer
 * arma cada combinación tipo + pintura una vez, la fotografía, recorta el aire
 * transparente alrededor del carro y guarda la imagen: las tarjetas muestran un
 * `<img>`, no un canvas vivo cada una. Sin WebGL, `null`, y la tarjeta queda
 * con su ícono.
 *
 * Perfiles laterales en metros: x de la cola (0) al frente, y hacia arriba.
 */
interface CarModel {
  len: number;
  width: number;
  wheels: readonly [number, number];
  r: number;
  lower: readonly (readonly [number, number])[];
  cabin: readonly [Point, Point, Point, Point];
  cabW: number;
  roof: readonly [number, number, number];
  rails?: boolean;
  bed?: readonly [number, number];
}
type Point = readonly [number, number];

const MODELS: Record<FleetVehicleCategory, CarModel> = {
  SEDAN: {
    len: 4.5,
    width: 1.78,
    wheels: [0.95, 3.55],
    r: 0.33,
    lower: [
      [4.55, 0.5],
      [4.55, 0.72],
      [4.35, 0.86],
      [3.3, 0.98],
      [1.2, 0.98],
      [0.25, 0.95],
      [0.02, 0.85],
      [0, 0.5],
    ],
    cabin: [
      [1.0, 0.96],
      [3.4, 0.96],
      [2.72, 1.4],
      [1.75, 1.42],
    ],
    cabW: 1.5,
    roof: [1.8, 2.7, 1.42],
  },
  SUV: {
    len: 4.6,
    width: 1.9,
    wheels: [1.0, 3.6],
    r: 0.38,
    lower: [
      [4.55, 0.45],
      [4.6, 0.85],
      [4.45, 1.05],
      [3.6, 1.15],
      [0.1, 1.15],
      [0, 1.05],
      [0, 0.45],
    ],
    cabin: [
      [0.12, 1.13],
      [3.62, 1.13],
      [3.0, 1.76],
      [0.3, 1.78],
    ],
    cabW: 1.7,
    roof: [0.3, 2.98, 1.78],
    rails: true,
  },
  PICKUP: {
    len: 5.0,
    width: 1.9,
    wheels: [1.0, 4.0],
    r: 0.38,
    lower: [
      [4.95, 0.45],
      [5.0, 0.85],
      [4.85, 1.08],
      [3.9, 1.15],
      [0, 1.15],
      [0, 0.45],
    ],
    cabin: [
      [2.15, 1.13],
      [3.95, 1.13],
      [3.35, 1.84],
      [2.25, 1.86],
    ],
    cabW: 1.72,
    roof: [2.27, 3.33, 1.86],
    bed: [0.02, 2.13],
  },
};

const WIDTH = 520;
const HEIGHT = 290;

type Studio = (category: FleetVehicleCategory, paint: string) => string;

let studio: Promise<Studio | null> | null = null;
const shots = new Map<string, Promise<string | null>>();

/** La imagen del carro como `data:` PNG, o `null` sin WebGL. Una sola vez por tipo + pintura. */
export function renderCar(category: FleetVehicleCategory, paint: string): Promise<string | null> {
  const key = `${category}:${paint}`;
  let shot = shots.get(key);

  if (shot === undefined) {
    studio ??= openStudio();
    shot = studio.then((render) => (render === null ? null : render(category, paint)));
    shots.set(key, shot);
  }

  return shot;
}

async function openStudio(): Promise<Studio | null> {
  if (typeof window === 'undefined') return null;

  const T = await import('three');
  let renderer: Three.WebGLRenderer;

  try {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(WIDTH, HEIGHT);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;

  const camera = new T.PerspectiveCamera(26, WIDTH / HEIGHT, 0.1, 100);
  camera.position.set(5.4, 3.1, 6.2);
  camera.lookAt(0, 0.62, 0);

  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xdfe8ff, 0x1a2233, 0.9 * Math.PI));
  const lights: [number, number, Point3][] = [
    [0xffffff, 1.6, [4, 7, 5]],
    [0x9fbfff, 0.7, [-6, 3, -4]],
    [0xffffff, 0.5, [8, 1.5, 1]],
  ];
  for (const [color, intensity, [x, y, z]] of lights) {
    const light = new T.DirectionalLight(color, intensity * Math.PI);
    light.position.set(x, y, z);
    scene.add(light);
  }

  const shadowMaterial = new T.MeshBasicMaterial({
    map: new T.CanvasTexture(contactShadow()),
    transparent: true,
    depthWrite: false,
  });
  const materials = {
    glass: new T.MeshStandardMaterial({ color: 0x141d2b, metalness: 0.7, roughness: 0.12 }),
    tire: new T.MeshStandardMaterial({ color: 0x121418, roughness: 0.9 }),
    rim: new T.MeshStandardMaterial({ color: 0xc3cad5, metalness: 0.85, roughness: 0.3 }),
    trim: new T.MeshStandardMaterial({ color: 0x15181e, roughness: 0.6 }),
    head: new T.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff4dc,
      emissiveIntensity: 0.9,
    }),
    tail: new T.MeshStandardMaterial({
      color: 0xa3121a,
      emissive: 0x7a0d12,
      emissiveIntensity: 0.6,
    }),
    plate: new T.MeshStandardMaterial({ color: 0xeef1f6, roughness: 0.5 }),
  };

  const extrude = (shape: Three.Shape, depth: number, material: Three.Material, bevel: number) => {
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: depth - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 3,
      curveSegments: 16,
    });
    geometry.translate(0, 0, -(depth - bevel * 2) / 2);

    return new T.Mesh(geometry, material);
  };
  const box = ([w, h, d]: Point3, material: Three.Material, [x, y, z]: Point3): Three.Mesh => {
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);

    return mesh;
  };

  function build(category: FleetVehicleCategory, paintColor: string): Three.Group {
    const m = MODELS[category];
    const paint = new T.MeshStandardMaterial({
      color: new T.Color(paintColor),
      metalness: 0.35,
      roughness: 0.38,
    });
    const car = new T.Group();
    const archRadius = m.r + 0.07;
    const floor = 0.3;

    // Carrocería baja con los arcos de las ruedas recortados.
    const body = new T.Shape();
    body.moveTo(0.06, floor);
    for (const wheelX of m.wheels) {
      body.lineTo(wheelX - archRadius, floor);
      body.absarc(wheelX, m.r, archRadius, Math.PI, 0, true);
    }
    const [front] = m.lower;
    body.lineTo((front?.[0] ?? m.len) - 0.08, floor);
    for (const [x, y] of m.lower) body.lineTo(x, y);
    body.lineTo(0.06, floor);
    car.add(extrude(body, m.width, paint, 0.07));

    // Cabina de vidrio con techo y pilar pintados.
    const [p0, p1, p2, p3] = m.cabin;
    const cabin = new T.Shape();
    cabin.moveTo(p0[0], p0[1]);
    cabin.lineTo(p1[0], p1[1]);
    cabin.quadraticCurveTo(p2[0] + 0.25, p2[1] - 0.06, p2[0], p2[1]);
    cabin.lineTo(p3[0], p3[1]);
    cabin.quadraticCurveTo(p3[0] - 0.25, p3[1] - 0.05, p0[0], p0[1]);
    car.add(extrude(cabin, m.cabW, materials.glass, 0.06));

    const [roofFrom, roofTo, roofY] = m.roof;
    const roofMid = (roofFrom + roofTo) / 2;
    car.add(
      box([roofTo - roofFrom + 0.08, 0.07, m.cabW + 0.02], paint, [roofMid, roofY + 0.01, 0]),
    );
    const pillarX = roofMid + (category === 'SUV' ? 0.25 : 0);
    car.add(box([0.1, roofY - p0[1], m.cabW + 0.03], paint, [pillarX, (roofY + p0[1]) / 2, 0]));

    if (m.rails === true) {
      for (const side of [-1, 1]) {
        car.add(
          box([roofTo - roofFrom - 0.3, 0.05, 0.05], materials.trim, [
            roofMid,
            roofY + 0.09,
            side * (m.cabW / 2 - 0.12),
          ]),
        );
      }
    }

    if (m.bed !== undefined) {
      const [bedFrom, bedTo] = m.bed;
      const wall = 0.28;
      const top = 1.15;
      const bedMid = (bedFrom + bedTo) / 2;
      for (const side of [-1, 1]) {
        car.add(
          box([bedTo - bedFrom, wall, 0.08], paint, [
            bedMid,
            top + wall / 2,
            side * (m.width / 2 - 0.06),
          ]),
        );
      }
      car.add(box([0.08, wall, m.width - 0.04], paint, [bedFrom + 0.04, top + wall / 2, 0]));
      car.add(
        box([bedTo - bedFrom - 0.1, 0.02, m.width - 0.2], materials.trim, [bedMid, top + 0.01, 0]),
      );
    }

    // Frente: parrilla, faros y placa. Cola: calaveras. Retrovisores.
    const nose = m.lower[1] ?? [m.len, 0.8];
    const noseY = ((front?.[1] ?? 0.5) + nose[1]) / 2;
    const grille = category === 'PICKUP' ? 1.0 : category === 'SUV' ? 0.8 : 0.62;
    const tailY = (m.lower[m.lower.length - 2]?.[1] ?? 0.9) - 0.12;
    car.add(
      box([0.06, category === 'PICKUP' ? 0.32 : 0.18, grille], materials.trim, [
        nose[0] + 0.01,
        noseY + 0.06,
        0,
      ]),
    );
    for (const side of [-1, 1]) {
      car.add(
        box([0.06, 0.09, 0.34], materials.head, [
          nose[0] - 0.03,
          noseY + 0.13,
          side * (m.width / 2 - 0.26),
        ]),
      );
      car.add(box([0.06, 0.12, 0.24], materials.tail, [-0.01, tailY, side * (m.width / 2 - 0.2)]));
      car.add(
        box([0.12, 0.05, 0.16], materials.trim, [
          p1[0] - 0.12,
          p1[1] + 0.08,
          side * (m.cabW / 2 + 0.1),
        ]),
      );
    }
    car.add(
      box([0.03, 0.12, 0.42], materials.plate, [nose[0] + 0.03, (front?.[1] ?? 0.5) - 0.12, 0]),
    );

    for (const wheelX of m.wheels) {
      for (const side of [-1, 1]) {
        const z = side * (m.width / 2 - 0.17);
        const tire = new T.Mesh(new T.CylinderGeometry(m.r, m.r, 0.26, 28), materials.tire);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(wheelX, m.r, z);
        const rim = new T.Mesh(
          new T.CylinderGeometry(m.r * 0.62, m.r * 0.62, 0.27, 20),
          materials.rim,
        );
        rim.rotation.x = Math.PI / 2;
        rim.position.set(wheelX, m.r, z + side * 0.005);
        car.add(tire, rim);
      }
    }

    const shadow = new T.Mesh(new T.PlaneGeometry(m.len + 1.2, m.width + 1.0), shadowMaterial);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(m.len / 2, 0.002, 0);
    car.add(shadow);
    car.position.x = -m.len / 2;

    return car;
  }

  return (category, paintColor) => {
    const car = build(category, paintColor);
    scene.add(car);
    renderer.render(scene, camera);
    const image = cropped(renderer.domElement);
    scene.remove(car);
    car.traverse((node) => {
      if (node instanceof T.Mesh) node.geometry.dispose();
    });

    return image;
  };
}

type Point3 = readonly [number, number, number];

/** Sombra de contacto: un degradado radial en el piso, sin cálculo de sombras. */
function contactShadow(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');

  if (context !== null) {
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(0,0,0,0.55)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
  }

  return canvas;
}

/** Recorta el aire transparente alrededor del carro para que llene el escenario. */
function cropped(source: HTMLCanvasElement): string {
  const { width, height } = source;
  const copy = document.createElement('canvas');
  copy.width = width;
  copy.height = height;
  const context = copy.getContext('2d');

  if (context === null) return source.toDataURL('image/png');

  context.drawImage(source, 0, 0);
  const pixels = context.getImageData(0, 0, width, height).data;
  let left = width;
  let top = height;
  let right = 0;
  let bottom = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if ((pixels[(y * width + x) * 4 + 3] ?? 0) > 24) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right <= left) return source.toDataURL('image/png');

  const pad = Math.round(width * 0.01);
  left = Math.max(0, left - pad);
  top = Math.max(0, top - pad);
  right = Math.min(width - 1, right + pad);
  bottom = Math.min(height - 1, bottom + pad);

  const out = document.createElement('canvas');
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out
    .getContext('2d')
    ?.drawImage(copy, left, top, out.width, out.height, 0, 0, out.width, out.height);

  return out.toDataURL('image/png');
}
