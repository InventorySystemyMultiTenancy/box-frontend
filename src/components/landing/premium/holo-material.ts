import * as THREE from "three";

/**
 * Material "holograma": brilho de borda (fresnel), faixas de escaneamento que sobem pela
 * peça e revelação progressiva de baixo para cima (uReveal 0 → 1) com uma linha luminosa
 * na frente da revelação. Aditivo e sem escrita de profundidade — vários hologramas
 * sobrepostos somam luz, como projeção de verdade.
 */
const vertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uEdgeColor;
  uniform float uTime;
  uniform float uReveal;
  uniform float uMinY;
  uniform float uMaxY;
  uniform float uOpacity;
  uniform float uHighlight;
  uniform float uLine;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;

  void main() {
    float h = clamp((vWorld.y - uMinY) / max(uMaxY - uMinY, 0.0001), 0.0, 1.0);
    float front = uReveal * 1.08 - 0.04;
    if (h > front) discard;

    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
    float scan = smoothstep(0.0, 1.0, sin(vWorld.y * 38.0 - uTime * 2.4) * 0.5 + 0.5) * 0.12;
    float band = smoothstep(0.06, 0.0, abs(fract(vWorld.y * 0.9 - uTime * 0.18) - 0.5)) * 0.35;
    float edge = smoothstep(0.035, 0.0, front - h) * step(uReveal, 0.999);

    float base = mix(0.05 + fresnel * 0.95 + scan + band, 0.9, uLine);
    vec3 col = uColor * base + uEdgeColor * edge * 2.4;
    col += uEdgeColor * uHighlight * (0.35 + fresnel);
    float alpha = clamp((base + edge * 2.0 + uHighlight * 0.4) * uOpacity, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;

export interface HoloUniforms {
  [uniform: string]: THREE.IUniform;
  uColor: THREE.IUniform<THREE.Color>;
  uEdgeColor: THREE.IUniform<THREE.Color>;
  uTime: THREE.IUniform<number>;
  uReveal: THREE.IUniform<number>;
  uMinY: THREE.IUniform<number>;
  uMaxY: THREE.IUniform<number>;
  uOpacity: THREE.IUniform<number>;
  uHighlight: THREE.IUniform<number>;
  uLine: THREE.IUniform<number>;
}

export function createHoloMaterial(opts: { color?: string; edge?: string; opacity?: number; line?: boolean; minY?: number; maxY?: number } = {}) {
  const uniforms: HoloUniforms = {
    uColor: { value: new THREE.Color(opts.color ?? "#3fd0ff") },
    uEdgeColor: { value: new THREE.Color(opts.edge ?? "#d9f7ff") },
    uTime: { value: 0 },
    uReveal: { value: 1 },
    uMinY: { value: opts.minY ?? 0 },
    uMaxY: { value: opts.maxY ?? 1.5 },
    uOpacity: { value: opts.opacity ?? 1 },
    uHighlight: { value: 0 },
    uLine: { value: opts.line ? 1 : 0 },
  };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export type HoloMaterial = ReturnType<typeof createHoloMaterial>;

/** Atualiza tempo/revelação de vários materiais de uma vez (chamado no useFrame). */
export function tickHolo(materials: HoloMaterial[], time: number, reveal?: number) {
  for (const m of materials) {
    m.uniforms.uTime.value = time;
    if (reveal !== undefined) m.uniforms.uReveal.value = reveal;
  }
}
