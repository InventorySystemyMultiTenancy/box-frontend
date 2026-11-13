import * as THREE from "three";

/**
 * Carroceria procedural de um esportivo (frente em +x, teto em +y, chão em y=0): uma
 * sequência de seções transversais ao longo do comprimento, cada uma com base, lateral,
 * linha de cintura e teto (mais estreito na cabine). A malha resultante e o "grid" de
 * linhas dela são a base do holograma.
 */
export const CAR = {
  length: 4.4,
  axleRear: 0.19,
  axleFront: 0.8,
  wheelRadius: 0.35,
  wheelZ: 0.8,
};

type Key = [number, number];

// Perfis (u = 0 traseira → 1 frente).
const TOP: Key[] = [
  [0, 0.74],
  [0.04, 0.94],
  [0.12, 1.0],
  [0.24, 1.03],
  [0.36, 1.28],
  [0.48, 1.36],
  [0.58, 1.33],
  [0.71, 1.02],
  [0.84, 0.9],
  [0.95, 0.74],
  [1, 0.5],
];
const BOTTOM: Key[] = [
  [0, 0.38],
  [0.05, 0.22],
  [0.5, 0.19],
  [0.95, 0.21],
  [1, 0.36],
];
const HALF_WIDTH: Key[] = [
  [0, 0.8],
  [0.07, 0.92],
  [0.2, 0.97],
  [0.5, 0.93],
  [0.8, 0.96],
  [0.93, 0.9],
  [1, 0.66],
];

/** Interpolação Catmull-Rom 1D por chaves (u crescente). */
function sample(keys: Key[], u: number) {
  if (u <= keys[0][0]) return keys[0][1];
  if (u >= keys[keys.length - 1][0]) return keys[keys.length - 1][1];
  let i = 0;
  while (i < keys.length - 2 && u > keys[i + 1][0]) i++;
  const p0 = keys[Math.max(0, i - 1)][1];
  const p1 = keys[i][1];
  const p2 = keys[i + 1][1];
  const p3 = keys[Math.min(keys.length - 1, i + 2)][1];
  const t = (u - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Meia seção (z ≥ 0) do fundo-centro até o teto-centro. */
function halfSection(u: number, steps: number): [number, number][] {
  const top = sample(TOP, u);
  const bottom = sample(BOTTOM, u);
  const hw = sample(HALF_WIDTH, u);
  const cabin = smooth(1.06, 1.24, top);
  const belt = Math.min(top - 0.05, 0.6 + (top - 0.6) * (1 - cabin) * 0.55 + cabin * 0.4);
  const topW = hw * (0.86 - 0.24 * cabin);
  const ctrl: [number, number][] = [
    [0, bottom],
    [hw * 0.82, bottom],
    [hw, bottom + 0.14],
    [hw, Math.max(bottom + 0.2, belt)],
    [topW, top - 0.05 - 0.04 * cabin],
    [0, top],
  ];
  const curve = new THREE.SplineCurve(ctrl.map(([z, y]) => new THREE.Vector2(z, y)));
  return curve.getSpacedPoints(steps).map((p) => [Math.max(0, p.x), p.y]);
}

export function buildCarBody(segmentsU = 72, halfSteps = 18) {
  const L = CAR.length;
  const ring: THREE.Vector3[][] = [];
  for (let i = 0; i <= segmentsU; i++) {
    const u = i / segmentsU;
    const x = -L / 2 + u * L;
    const half = halfSection(u, halfSteps);
    // Anel fechado: lado +z (fundo → teto) e depois lado -z (teto → fundo).
    const pts: THREE.Vector3[] = half.map(([z, y]) => new THREE.Vector3(x, y, z));
    for (let k = half.length - 2; k >= 1; k--) pts.push(new THREE.Vector3(x, half[k][1], -half[k][0]));
    ring.push(pts);
  }
  const perRing = ring[0].length;

  const positions: number[] = [];
  ring.forEach((pts) => pts.forEach((p) => positions.push(p.x, p.y, p.z)));
  const index: number[] = [];
  for (let i = 0; i < segmentsU; i++) {
    for (let k = 0; k < perRing; k++) {
      const a = i * perRing + k;
      const b = i * perRing + ((k + 1) % perRing);
      const c = (i + 1) * perRing + k;
      const d = (i + 1) * perRing + ((k + 1) % perRing);
      index.push(a, c, b, b, c, d);
    }
  }
  // Tampas da traseira e da frente (leque a partir do centro da seção).
  for (const [i, flip] of [
    [0, true],
    [segmentsU, false],
  ] as const) {
    const pts = ring[i];
    const center = pts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(pts.length);
    const ci = positions.length / 3;
    positions.push(center.x, center.y, center.z);
    for (let k = 0; k < perRing; k++) {
      const a = i * perRing + k;
      const b = i * perRing + ((k + 1) % perRing);
      if (flip) index.push(ci, a, b);
      else index.push(ci, b, a);
    }
  }

  const body = new THREE.BufferGeometry();
  body.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  body.setIndex(index);
  body.computeVertexNormals();

  // Grid de linhas: anéis a cada 4 seções + longitudinais a cada 2 pontos do anel.
  const lines: number[] = [];
  for (let i = 0; i <= segmentsU; i += 4) {
    const pts = ring[i];
    for (let k = 0; k < perRing; k++) {
      const p = pts[k];
      const q = pts[(k + 1) % perRing];
      lines.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }
  for (let k = 0; k < perRing; k += 2) {
    for (let i = 0; i < segmentsU; i++) {
      const p = ring[i][k];
      const q = ring[i + 1][k];
      lines.push(p.x, p.y, p.z, q.x, q.y, q.z);
    }
  }
  const grid = new THREE.BufferGeometry();
  grid.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));

  return { body, grid };
}

/** Roda: pneu (toro), aro com 5 raios e disco de freio. Centro na origem, eixo em z. */
export function buildWheel() {
  const r = CAR.wheelRadius;
  const tire = new THREE.TorusGeometry(r - 0.07, 0.085, 12, 40);
  const rim = new THREE.RingGeometry(r * 0.46, r * 0.62, 40, 1);
  const hub = new THREE.CircleGeometry(r * 0.14, 20);
  const spokes: THREE.BufferGeometry[] = [];
  for (let s = 0; s < 5; s++) {
    const spoke = new THREE.PlaneGeometry(r * 0.08, r * 0.5);
    spoke.translate(0, r * 0.33, 0.005);
    spoke.rotateZ((s / 5) * Math.PI * 2);
    spokes.push(spoke);
  }
  const disc = new THREE.RingGeometry(r * 0.16, r * 0.44, 36, 1);
  disc.translate(0, 0, -0.04);
  return { tire, rim, hub, spokes, disc };
}

export function carBounds() {
  return { minY: 0, maxY: 1.4 };
}
