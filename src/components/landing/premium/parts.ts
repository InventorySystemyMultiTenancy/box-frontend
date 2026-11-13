import * as THREE from "three";

/**
 * Componentes mecânicos procedurais (sem arquivos de modelo — carregam instantâneo).
 * Cada peça tem um nome (aparece ao passar o mouse), a cor (holograma azul ou laranja de
 * destaque) e o vetor da vista explodida.
 */
export interface PartPiece {
  name: string;
  geometry: THREE.BufferGeometry;
  position?: [number, number, number];
  rotation?: [number, number, number];
  explode: [number, number, number];
  accent?: boolean;
  /** Animação própria: pistão sobe/desce, engrenagem gira, etc. */
  motion?: "piston" | "spinZ" | "spinZReverse" | "spinX";
  phase?: number;
  /** Peça de contexto (carcaça): bem transparente para não esconder o resto. */
  ghost?: boolean;
  /** Multiplicador da velocidade de rotação (relação entre engrenagens). */
  speed?: number;
}

export interface MechanicalPart {
  id: "motor" | "freios" | "suspensao" | "transmissao";
  pieces: PartPiece[];
}

function gearShape(teeth: number, outer: number, inner: number, hole: number) {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const pts: [number, number][] = [
      [inner, a],
      [outer, a + step * 0.18],
      [outer, a + step * 0.48],
      [inner, a + step * 0.66],
    ];
    pts.forEach(([r, ang], k) => {
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  shape.holes.push(h);
  // Furos de alívio.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const r = (inner + hole) / 2;
    const p = new THREE.Path();
    p.absarc(Math.cos(a) * r, Math.sin(a) * r, (inner - hole) * 0.18, 0, Math.PI * 2, true);
    shape.holes.push(p);
  }
  return shape;
}

function gear(teeth: number, outer: number, depth: number) {
  const g = new THREE.ExtrudeGeometry(gearShape(teeth, outer, outer * 0.86, outer * 0.18), {
    depth,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 1,
    curveSegments: 6,
  });
  g.translate(0, 0, -depth / 2);
  return g;
}

function helix(radius: number, height: number, turns: number, tube: number) {
  const points: THREE.Vector3[] = [];
  const n = turns * 32;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(a) * radius, t * height - height / 2, Math.sin(a) * radius));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), n * 2, tube, 8, false);
}

function motor(): MechanicalPart {
  const pieces: PartPiece[] = [];
  const block = new THREE.BoxGeometry(2.0, 0.9, 0.9, 6, 3, 3);
  pieces.push({ name: "Bloco do motor", geometry: block, position: [0, 0, 0], explode: [0, 0, 0] });
  pieces.push({
    name: "Cabeçote",
    geometry: new THREE.BoxGeometry(2.0, 0.32, 0.86, 6, 1, 3),
    position: [0, 0.63, 0],
    explode: [0, 0.5, 0],
  });
  pieces.push({
    name: "Tampa de válvulas",
    geometry: new THREE.CapsuleGeometry(0.3, 1.5, 4, 12).rotateZ(Math.PI / 2).scale(1, 0.55, 1),
    position: [0, 0.92, 0],
    explode: [0, 0.8, 0],
    accent: true,
  });
  for (let i = 0; i < 4; i++) {
    const x = -0.72 + i * 0.48;
    pieces.push({
      name: `Pistão ${i + 1}`,
      geometry: new THREE.CylinderGeometry(0.17, 0.17, 0.26, 20),
      position: [x, 0.18, 0],
      explode: [0, 0.55, 0.9],
      motion: "piston",
      phase: i % 3 === 0 ? 0 : Math.PI,
    });
    pieces.push({
      name: `Biela ${i + 1}`,
      geometry: new THREE.BoxGeometry(0.06, 0.5, 0.06),
      position: [x, -0.15, 0],
      explode: [0, 0.2, 0.9],
      motion: "piston",
      phase: i % 3 === 0 ? 0 : Math.PI,
    });
    pieces.push({
      name: "Coletor de admissão",
      geometry: new THREE.TorusGeometry(0.32, 0.055, 8, 24, Math.PI * 0.9),
      position: [x, 0.62, 0.42],
      rotation: [0, Math.PI / 2, 0],
      explode: [0, 0.5, 0.9],
      accent: true,
    });
  }
  pieces.push({
    name: "Virabrequim",
    geometry: new THREE.CylinderGeometry(0.07, 0.07, 2.3, 12).rotateZ(Math.PI / 2),
    position: [0, -0.5, 0],
    explode: [0, -0.55, 0],
    motion: "spinX",
  });
  pieces.push({
    name: "Volante do motor",
    geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.07, 40).rotateZ(Math.PI / 2),
    position: [-1.22, -0.3, 0],
    explode: [-0.8, 0, 0],
    motion: "spinX",
    accent: true,
  });
  pieces.push({
    name: "Polia e correia",
    geometry: new THREE.TorusGeometry(0.26, 0.03, 8, 32).rotateY(Math.PI / 2),
    position: [1.08, -0.25, 0],
    explode: [0.7, 0, 0],
    motion: "spinX",
  });
  return { id: "motor", pieces };
}

function freios(): MechanicalPart {
  const pieces: PartPiece[] = [];
  const disc = new THREE.CylinderGeometry(1.05, 1.05, 0.08, 64, 1, true).rotateX(Math.PI / 2);
  pieces.push({ name: "Disco de freio", geometry: disc, explode: [0, 0, 0], motion: "spinZ" });
  pieces.push({
    name: "Face do disco",
    geometry: new THREE.RingGeometry(0.42, 1.05, 64, 3),
    position: [0, 0, 0.04],
    explode: [0, 0, 0],
    motion: "spinZ",
  });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = 0.62 + (i % 3) * 0.13;
    pieces.push({
      name: "Furação de ventilação",
      geometry: new THREE.CircleGeometry(0.035, 10),
      position: [Math.cos(a) * r, Math.sin(a) * r, 0.045],
      explode: [0, 0, 0],
      motion: "spinZ",
    });
  }
  pieces.push({
    name: "Cubo de roda",
    geometry: new THREE.CylinderGeometry(0.4, 0.44, 0.32, 32).rotateX(Math.PI / 2),
    position: [0, 0, 0.14],
    explode: [0, 0, 1.2],
    motion: "spinZ",
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    pieces.push({
      name: "Prisioneiro",
      geometry: new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8).rotateX(Math.PI / 2),
      position: [Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.42],
      explode: [0, 0, 1.6],
      motion: "spinZ",
    });
  }
  pieces.push({
    name: "Pinça de freio",
    geometry: new THREE.TorusGeometry(0.9, 0.17, 12, 32, Math.PI * 0.42),
    position: [0, 0, 0],
    rotation: [0, 0, Math.PI * 0.08],
    explode: [0.7, 0.7, 0],
    accent: true,
  });
  for (const z of [0.12, -0.12]) {
    pieces.push({
      name: "Pastilha de freio",
      geometry: new THREE.TorusGeometry(0.88, 0.05, 6, 24, Math.PI * 0.32),
      position: [0, 0, z],
      rotation: [0, 0, Math.PI * 0.13],
      explode: [0.45, 0.45, z * 6],
      accent: true,
    });
  }
  return { id: "freios", pieces };
}

function suspensao(): MechanicalPart {
  const pieces: PartPiece[] = [];
  pieces.push({ name: "Mola helicoidal", geometry: helix(0.42, 1.4, 6, 0.05), position: [0, 0.35, 0], explode: [0, 0.4, 0], accent: true });
  pieces.push({ name: "Amortecedor", geometry: new THREE.CylinderGeometry(0.16, 0.16, 1.2, 24), position: [0, -0.2, 0], explode: [0, -0.3, 0] });
  pieces.push({ name: "Haste do amortecedor", geometry: new THREE.CylinderGeometry(0.05, 0.05, 1.0, 12), position: [0, 0.75, 0], explode: [0, 0.4, 0] });
  pieces.push({ name: "Coxim superior", geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32), position: [0, 1.15, 0], explode: [0, 0.55, 0], accent: true });
  pieces.push({ name: "Prato da mola", geometry: new THREE.CylinderGeometry(0.52, 0.52, 0.05, 32), position: [0, -0.38, 0], explode: [0, -0.2, 0] });
  const arm = new THREE.Shape();
  arm.moveTo(-1.1, -0.15);
  arm.lineTo(0.2, -0.08);
  arm.lineTo(0.35, 0.08);
  arm.lineTo(-1.1, 0.4);
  arm.lineTo(-1.25, 0.12);
  arm.closePath();
  pieces.push({
    name: "Bandeja de suspensão",
    geometry: new THREE.ExtrudeGeometry(arm, { depth: 0.08, bevelEnabled: false }).rotateX(Math.PI / 2),
    position: [0.1, -1.05, 0.25],
    explode: [-0.4, -0.4, 0],
  });
  pieces.push({ name: "Manga de eixo", geometry: new THREE.BoxGeometry(0.22, 0.6, 0.22, 2, 4, 2), position: [0.45, -0.85, 0], explode: [0.7, -0.4, 0] });
  pieces.push({
    name: "Barra estabilizadora",
    geometry: new THREE.TorusGeometry(0.9, 0.035, 6, 32, Math.PI * 0.5).rotateX(Math.PI / 2),
    position: [-0.5, -1.25, -0.4],
    explode: [-0.6, -0.35, -0.4],
  });
  return { id: "suspensao", pieces };
}

function transmissao(): MechanicalPart {
  return {
    id: "transmissao",
    pieces: [
      { name: "Engrenagem motora", geometry: gear(24, 0.85, 0.22), position: [-0.55, 0.2, 0], explode: [-0.5, 0.2, 0.6], motion: "spinZ", accent: true },
      { name: "Engrenagem movida", geometry: gear(16, 0.58, 0.22), position: [0.82, 0.38, 0], explode: [0.35, 0.25, 0.6], motion: "spinZReverse", phase: 0.11, speed: 1.5 },
      { name: "Engrenagem intermediária", geometry: gear(12, 0.42, 0.2), position: [0.35, -0.8, 0.0], explode: [0.4, -0.6, -0.6], motion: "spinZReverse", speed: 2 },
      {
        name: "Eixo primário",
        geometry: new THREE.CylinderGeometry(0.08, 0.08, 1.8, 16).rotateX(Math.PI / 2),
        position: [-0.55, 0.2, 0],
        explode: [-0.5, 0.2, -0.4],
        motion: "spinZ",
      },
      {
        name: "Eixo secundário",
        geometry: new THREE.CylinderGeometry(0.07, 0.07, 1.6, 16).rotateX(Math.PI / 2),
        position: [0.82, 0.38, 0],
        explode: [0.35, 0.25, -0.4],
        motion: "spinZReverse",
        speed: 1.5,
      },
      {
        name: "Sincronizador",
        geometry: new THREE.TorusGeometry(0.3, 0.06, 10, 32),
        position: [-0.55, 0.2, 0.45],
        explode: [-0.5, 0.2, 1.3],
        motion: "spinZ",
        accent: true,
      },
      {
        name: "Carcaça do câmbio",
        geometry: new THREE.CapsuleGeometry(0.95, 1.1, 6, 24).rotateZ(Math.PI / 2).scale(1, 1, 0.55),
        position: [0.1, -0.05, 0],
        explode: [0, 0, -1.2],
        ghost: true,
      },
    ],
  };
}

export function buildParts(): MechanicalPart[] {
  return [motor(), freios(), suspensao(), transmissao()];
}
