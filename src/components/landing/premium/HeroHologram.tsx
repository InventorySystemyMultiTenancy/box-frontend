"use client";

/* eslint-disable react-hooks/immutability -- React Three Fiber: uniforms, buffers e câmera são
   alterados a cada frame (useFrame) por definição, fora do ciclo de render do React. */

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { buildCarBody, buildWheel, CAR, carBounds } from "./car-geometry";
import { createHoloMaterial, tickHolo, type HoloMaterial } from "./holo-material";
import { useInView, usePrefersReducedMotion } from "./hooks";
import styles from "./premium.module.css";

type HotspotId = "motor" | "freios" | "suspensao" | "eletrica";

const HOTSPOTS: { id: HotspotId; label: string; detail: string; position: [number, number, number] }[] = [
  { id: "motor", label: "Motor", detail: "Diagnóstico e reparo", position: [1.35, 1.0, 0] },
  { id: "freios", label: "Freios", detail: "Discos, pastilhas e fluido", position: [1.32, 0.4, 0.98] },
  { id: "suspensao", label: "Suspensão", detail: "Amortecedores e molas", position: [-1.36, 0.78, 0.95] },
  { id: "eletrica", label: "Elétrica", detail: "Faróis, módulos e chicotes", position: [2.15, 0.72, -0.55] },
];

/** Pseudoaleatório determinístico (mesmas partículas a cada render). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function Car({ revealRef, active }: { revealRef: React.RefObject<number>; active: HotspotId | null }) {
  const { minY, maxY } = carBounds();
  const parts = useMemo(() => {
    const { body, grid } = buildCarBody();
    const wheel = buildWheel();
    const bodyMat = createHoloMaterial({ opacity: 0.5, minY, maxY });
    const gridMat = createHoloMaterial({ opacity: 0.28, line: true, minY, maxY });
    const wheelMat = createHoloMaterial({ opacity: 0.75, minY, maxY });
    const discMat = createHoloMaterial({ color: "#ff8a3d", edge: "#ffd2a8", opacity: 0.7, minY, maxY });
    return { body, grid, wheel, bodyMat, gridMat, wheelMat, discMat };
  }, [minY, maxY]);

  useEffect(
    () => () => {
      parts.body.dispose();
      parts.grid.dispose();
      Object.values(parts.wheel).flat().forEach((g) => (g as THREE.BufferGeometry).dispose());
      [parts.bodyMat, parts.gridMat, parts.wheelMat, parts.discMat].forEach((m) => m.dispose());
    },
    [parts]
  );

  useFrame(({ clock }) => {
    const mats: HoloMaterial[] = [parts.bodyMat, parts.gridMat, parts.wheelMat, parts.discMat];
    tickHolo(mats, clock.elapsedTime, revealRef.current ?? 1);
    const target = (id: HotspotId) => (active === id ? 1 : 0);
    parts.bodyMat.uniforms.uHighlight.value = THREE.MathUtils.lerp(parts.bodyMat.uniforms.uHighlight.value, target("motor") * 0.6, 0.12);
    parts.wheelMat.uniforms.uHighlight.value = THREE.MathUtils.lerp(
      parts.wheelMat.uniforms.uHighlight.value,
      Math.max(target("freios"), target("suspensao")),
      0.12
    );
    parts.discMat.uniforms.uHighlight.value = THREE.MathUtils.lerp(parts.discMat.uniforms.uHighlight.value, target("freios") * 1.4, 0.12);
  });

  const wheelX = [-CAR.length / 2 + CAR.axleRear * CAR.length, -CAR.length / 2 + CAR.axleFront * CAR.length];
  const lightsOn = active === "eletrica";

  return (
    <group>
      <mesh geometry={parts.body} material={parts.bodyMat} />
      <lineSegments geometry={parts.grid} material={parts.gridMat} />
      {wheelX.flatMap((x) =>
        [1, -1].map((side) => (
          <group key={`${x}-${side}`} position={[x, CAR.wheelRadius, side * CAR.wheelZ]} rotation={[0, side < 0 ? Math.PI : 0, 0]}>
            <mesh geometry={parts.wheel.tire} material={parts.wheelMat} />
            <mesh geometry={parts.wheel.rim} material={parts.wheelMat} />
            <mesh geometry={parts.wheel.hub} material={parts.wheelMat} />
            {parts.wheel.spokes.map((g, i) => (
              <mesh key={i} geometry={g} material={parts.wheelMat} />
            ))}
            <mesh geometry={parts.wheel.disc} material={parts.discMat} />
          </group>
        ))
      )}
      {/* Faróis (LED) e lanterna em faixa — como na imagem de referência. */}
      {[0.56, -0.56].map((z) => (
        <mesh key={z} position={[CAR.length / 2 - 0.2, 0.68, z]} rotation={[0, z > 0 ? 0.35 : -0.35, -0.3]}>
          <boxGeometry args={[0.05, 0.022, 0.34]} />
          <meshBasicMaterial color={lightsOn ? "#ffffff" : "#bff4ff"} transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[-CAR.length / 2 + 0.05, 0.84, 0]}>
        <boxGeometry args={[0.04, 0.03, 1.36]} />
        <meshBasicMaterial color="#ff6a2b" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Plataforma: anéis luminosos, anel tracejado girando, brilho no chão e anel de escaneamento. */
function Platform({ revealRef, reduced }: { revealRef: React.RefObject<number>; reduced: boolean }) {
  const dashed = useRef<THREE.Group>(null);
  const scan = useRef<THREE.Mesh>(null);
  const rings = useRef<THREE.Group>(null);
  const floorMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color("#2bb8ff") } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `
          uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
          void main(){
            vec2 p = vUv * 2.0 - 1.0;
            float r = length(p);
            float glow = smoothstep(1.0, 0.0, r) * 0.28;
            vec2 g = abs(fract(p * 9.0) - 0.5);
            float grid = (1.0 - smoothstep(0.0, 0.03, min(g.x, g.y))) * smoothstep(1.0, 0.25, r) * 0.22;
            float pulse = smoothstep(0.02, 0.0, abs(r - fract(uTime * 0.18))) * 0.35 * (1.0 - r);
            // Alfa = intensidade: fora do brilho o canvas continua transparente.
            gl_FragColor = vec4(uColor, clamp(glow + grid + pulse, 0.0, 1.0));
          }`,
      }),
    []
  );
  const dashes = useMemo(() => Array.from({ length: 48 }, (_, i) => i), []);

  useFrame(({ clock }, delta) => {
    floorMat.uniforms.uTime.value = clock.elapsedTime;
    const r = revealRef.current ?? 1;
    if (rings.current) rings.current.scale.setScalar(0.6 + 0.4 * easeOut(r * 1.4));
    if (dashed.current && !reduced) dashed.current.rotation.y += delta * 0.18;
    if (scan.current) {
      const t = reduced ? 0.5 : (Math.sin(clock.elapsedTime * 0.7) + 1) / 2;
      scan.current.position.y = 0.05 + t * 1.3;
      (scan.current.material as THREE.MeshBasicMaterial).opacity = 0.35 * Math.min(1, r * 1.5);
    }
  });

  const glow = (color: string, opacity: number) => (
    <meshBasicMaterial color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
  );

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} material={floorMat}>
        <planeGeometry args={[7.5, 7.5]} />
      </mesh>
      <group ref={rings}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <ringGeometry args={[2.72, 2.79, 128]} />
          {glow("#6fe0ff", 0.95)}
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <ringGeometry args={[3.08, 3.1, 128]} />
          {glow("#3fa9ff", 0.6)}
        </mesh>
        <group ref={dashed}>
          {dashes.map((i) => (
            <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
              <ringGeometry args={[2.88, 2.95, 4, 1, (i / dashes.length) * Math.PI * 2, (Math.PI * 2) / dashes.length / 2.2]} />
              {glow("#9eeaff", 0.75)}
            </mesh>
          ))}
        </group>
      </group>
      <mesh ref={scan} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.45, 2.5, 96]} />
        {glow("#9eeaff", 0.35)}
      </mesh>
    </group>
  );
}

function Particles({ count, reduced }: { count: number; reduced: boolean }) {
  const ref = useRef<THREE.Points>(null);
  const { geometry, material } = useMemo(() => {
    const random = seeded(7);
    const pos = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2;
      const r = 1.2 + random() * 2.4;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = random() * 2.6;
      pos[i * 3 + 2] = Math.sin(a) * r;
      speed[i] = 0.08 + random() * 0.22;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute("speed", new THREE.BufferAttribute(speed, 1));
    const material = new THREE.PointsMaterial({
      color: "#9fe7ff",
      size: 0.028,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return { geometry, material };
  }, [count]);

  useEffect(() => () => (geometry.dispose(), material.dispose()), [geometry, material]);

  useFrame((_, delta) => {
    if (reduced || !ref.current) return;
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    const speed = geometry.getAttribute("speed") as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = pos.getY(i) + speed.getX(i) * delta;
      if (y > 2.6) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });

  return <points ref={ref} geometry={geometry} material={material} />;
}

function Rig({
  revealRef,
  reduced,
  dragRef,
  mobile,
  children,
}: {
  revealRef: React.RefObject<number>;
  reduced: boolean;
  dragRef: React.RefObject<number>;
  mobile: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const { camera, pointer } = useThree();
  const start = useRef<number | null>(null);
  const spin = useRef(0);

  useFrame(({ clock }, delta) => {
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;
    // Intro: 0,3 s de ambiente, revelação em ~2,4 s.
    revealRef.current = reduced ? 1 : easeOut((t - 0.3) / 2.4);
    const intro = reduced ? 1 : easeOut(t / 3.2);

    // Câmera: aproxima e desce suavemente na entrada; depois segue o mouse de leve.
    // No celular a câmera fica mais longe: o carro inteiro cabe na largura da tela.
    const radius = (mobile ? 10.8 : 9.2) - (mobile ? 2.6 : 2.9) * intro;
    const height = 3.6 - 1.55 * intro + pointer.y * 0.25;
    const angle = 0.78 + pointer.x * 0.12;
    camera.position.lerp(new THREE.Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius), 0.08);
    camera.lookAt(0, 0.62, 0);

    if (!reduced) spin.current += delta * 0.14;
    if (group.current) {
      const targetY = -0.5 + spin.current + (dragRef.current ?? 0);
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetY, 0.1);
    }
  });

  return <group ref={group}>{children}</group>;
}

export default function HeroHologram() {
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, "120px");
  const reduced = usePrefersReducedMotion();
  const revealRef = useRef(0);
  const dragRef = useRef(0);
  const [active, setActive] = useState<HotspotId | null>(null);
  const [showHotspots, setShowHotspots] = useState(false);
  const [mobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);

  useEffect(() => {
    const id = window.setTimeout(() => setShowHotspots(true), reduced ? 0 : 2900);
    return () => window.clearTimeout(id);
  }, [reduced]);

  // Arrastar na horizontal gira o carro 360°; na vertical a página continua rolando
  // normalmente (touch-action: pan-y no CSS).
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    let lastX: number | null = null;
    const down = (e: PointerEvent) => (lastX = e.clientX);
    const move = (e: PointerEvent) => {
      if (lastX === null) return;
      dragRef.current += (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
    };
    const up = () => (lastX = null);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  return (
    <div ref={wrap} className={styles.heroCanvas} aria-label="Holograma 3D de um veículo — arraste para girar" role="img">
      <Canvas
        frameloop={inView ? "always" : "never"}
        dpr={[1, mobile ? 1.5 : 2]}
        camera={{ position: [6, 3.6, 6.6], fov: mobile ? 42 : 30, near: 0.1, far: 60 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <Rig revealRef={revealRef} reduced={reduced} dragRef={dragRef} mobile={mobile}>
          <Car revealRef={revealRef} active={active} />
          <Platform revealRef={revealRef} reduced={reduced} />
          <Particles count={mobile ? 140 : 320} reduced={reduced} />
          {showHotspots &&
            HOTSPOTS.map((h) => (
              <Html key={h.id} position={h.position} center zIndexRange={[20, 0]}>
                <button
                  type="button"
                  className={`${styles.hotspot} ${active === h.id ? styles.hotspotActive : ""}`}
                  onPointerEnter={() => setActive(h.id)}
                  onPointerLeave={() => setActive((cur) => (cur === h.id ? null : cur))}
                  onFocus={() => setActive(h.id)}
                  onBlur={() => setActive(null)}
                  onClick={() => {
                    setActive((cur) => (cur === h.id ? null : h.id));
                  }}
                  aria-label={`${h.label}: ${h.detail}`}
                >
                  <span className={styles.hotspotDot} />
                  <span className={styles.hotspotLabel}>
                    <strong>{h.label}</strong>
                    <small>{h.detail}</small>
                  </span>
                </button>
              </Html>
            ))}
        </Rig>
      </Canvas>
    </div>
  );
}
