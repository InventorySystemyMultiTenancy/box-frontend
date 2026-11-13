"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { buildParts, type MechanicalPart, type PartPiece } from "./parts";
import { createHoloMaterial, type HoloMaterial } from "./holo-material";
import { useInView, usePrefersReducedMotion } from "./hooks";
import styles from "./premium.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const COPY: Record<MechanicalPart["id"], { title: string; text: string; chips: string[] }> = {
  motor: {
    title: "Motor",
    text: "Do cabeçote ao virabrequim: diagnóstico e reparo com cada peça avaliada, fotografada e registrada na timeline do seu carro.",
    chips: ["Diagnóstico", "Reparo", "Arrefecimento"],
  },
  freios: {
    title: "Freios",
    text: "Discos, pastilhas e pinças inspecionados com evidência. Você vê o desgaste e aprova a troca antes de qualquer serviço.",
    chips: ["Discos e pastilhas", "Pinças", "Fluido"],
  },
  suspensao: {
    title: "Suspensão",
    text: "Amortecedores, molas e bandejas com histórico individual — não um status genérico de \"carro em manutenção\".",
    chips: ["Amortecedores", "Molas", "Direção"],
  },
  transmissao: {
    title: "Transmissão",
    text: "Câmbio e embreagem desmontados peça por peça, com laudo, fotos e garantia salva na sua conta.",
    chips: ["Transmissão", "Embreagem"],
  },
};

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface PieceRuntime {
  piece: PartPiece;
  material: HoloMaterial;
}

function PartView({
  part,
  index,
  state,
  reduced,
  hovered,
  onHover,
}: {
  part: MechanicalPart;
  index: number;
  state: React.RefObject<{ active: number; explode: number }>;
  reduced: boolean;
  hovered: { part: number; piece: number; point: THREE.Vector3 } | null;
  onHover: (value: { part: number; piece: number; point: THREE.Vector3 } | null) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const reveal = useRef(0);
  const runtime = useMemo<PieceRuntime[]>(
    () =>
      part.pieces.map((piece) => ({
        piece,
        material: createHoloMaterial({
          color: piece.accent ? "#ff8a3d" : "#3fd0ff",
          edge: piece.accent ? "#ffd8b5" : "#dff8ff",
          opacity: piece.ghost ? 0.22 : 0.85,
          minY: -1.8,
          maxY: 1.8,
        }),
      })),
    [part]
  );

  useEffect(
    () => () => {
      runtime.forEach((r) => {
        r.material.dispose();
        r.piece.geometry.dispose();
      });
    },
    [runtime]
  );

  useFrame(({ clock }, delta) => {
    const s = state.current!;
    const target = s.active === index ? 1 : 0;
    // Suavização por tempo (igual em qualquer taxa de quadros): entra em ~1,2 s, sai rápido.
    const k = 1 - Math.exp(-delta * (target ? 2.6 : 7));
    reveal.current = reduced ? target : THREE.MathUtils.lerp(reveal.current, target, k);
    if (group.current) group.current.visible = reveal.current > 0.01;
    if (!group.current?.visible) return;
    const t = clock.elapsedTime;
    const explode = s.active === index ? s.explode : 0;
    runtime.forEach(({ piece, material }, i) => {
      material.uniforms.uTime.value = t;
      material.uniforms.uReveal.value = reveal.current;
      const isHovered = hovered?.part === index && hovered.piece === i;
      const sameName = hovered?.part === index && part.pieces[hovered.piece]?.name === piece.name;
      material.uniforms.uHighlight.value = THREE.MathUtils.lerp(material.uniforms.uHighlight.value, isHovered || sameName ? 1 : 0, 0.2);
      const mesh = meshes.current[i];
      if (!mesh) return;
      const base = piece.position ?? [0, 0, 0];
      const speed = reduced ? 0 : (piece.speed ?? 1);
      let bob = 0;
      if (piece.motion === "piston" && !reduced) bob = Math.sin(t * 4 + (piece.phase ?? 0)) * 0.12;
      mesh.position.set(base[0] + piece.explode[0] * explode, base[1] + piece.explode[1] * explode + bob, base[2] + piece.explode[2] * explode);
      const rot = piece.rotation ?? [0, 0, 0];
      const spin = t * 0.9 * speed + (piece.phase ?? 0);
      if (piece.motion === "spinZ") mesh.rotation.set(rot[0], rot[1], rot[2] + spin);
      else if (piece.motion === "spinZReverse") mesh.rotation.set(rot[0], rot[1], rot[2] - spin);
      else if (piece.motion === "spinX") mesh.rotation.set(rot[0] + spin * 2, rot[1], rot[2]);
      else mesh.rotation.set(rot[0], rot[1], rot[2]);
    });
  });

  return (
    <group ref={group}>
      {runtime.map(({ piece, material }, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          geometry={piece.geometry}
          material={material}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => {
            e.stopPropagation();
            onHover({ part: index, piece: i, point: e.point.clone() });
          }}
          onPointerOut={() => onHover(null)}
        />
      ))}
    </group>
  );
}

function Stage({
  parts,
  state,
  reduced,
  drag,
  mobile,
}: {
  parts: MechanicalPart[];
  state: React.RefObject<{ active: number; explode: number }>;
  reduced: boolean;
  drag: React.RefObject<number>;
  mobile: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const [hovered, setHovered] = useState<{ part: number; piece: number; point: THREE.Vector3 } | null>(null);

  useFrame(({ pointer }, delta) => {
    if (!group.current) return;
    if (!reduced && !hovered) spin.current += delta * 0.25;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0.5 + spin.current + (drag.current ?? 0) + pointer.x * 0.25, 0.08);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.18 - pointer.y * 0.12, 0.08);
  });

  const hoveredPiece = hovered ? parts[hovered.part]?.pieces[hovered.piece] : null;

  return (
    <>
      <group ref={group} scale={mobile ? 0.78 : 0.92}>
        {parts.map((part, i) => (
          <PartView key={part.id} part={part} index={i} state={state} reduced={reduced} hovered={hovered} onHover={setHovered} />
        ))}
      </group>
      {/* Base do "projetor" do holograma. */}
      <group position={[0, -1.85, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.18, 1.21, 96]} />
          <meshBasicMaterial color="#5fdcff" transparent opacity={0.75} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.72, 64]} />
          <meshBasicMaterial color="#5fdcff" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.18, 64]} />
          <meshBasicMaterial color="#0b4f7a" transparent opacity={0.12} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      {hovered && hoveredPiece && (
        <Html position={hovered.point} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className={styles.partTip}>{hoveredPiece.name}</div>
        </Html>
      )}
    </>
  );
}

export default function EngineeringScene() {
  const track = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const inView = useInView(canvasWrap, "200px");
  const reduced = usePrefersReducedMotion();
  const parts = useMemo(() => buildParts(), []);
  const state = useRef({ active: 0, explode: 0 });
  const drag = useRef(0);
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const [mobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        const p = self.progress * parts.length;
        const idx = Math.min(parts.length - 1, Math.floor(p));
        const local = p - idx;
        state.current.active = idx;
        // Vista explodida no meio de cada etapa; a última fica aberta até o fim.
        state.current.explode = smooth(0.18, 0.55, local);
        setActive(idx);
        setProgress(self.progress);
      },
    });
    return () => trigger.kill();
  }, [parts.length]);

  useEffect(() => {
    const el = canvasWrap.current;
    if (!el) return;
    let lastX: number | null = null;
    const down = (e: PointerEvent) => (lastX = e.clientX);
    const move = (e: PointerEvent) => {
      if (lastX === null) return;
      drag.current += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    };
    const up = () => (lastX = null);
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  function goTo(idx: number) {
    const el = track.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((idx + 0.45) / parts.length), behavior: reduced ? "auto" : "smooth" });
  }

  const copy = COPY[parts[active].id];

  return (
    <section className={styles.engTrack} ref={track} id="engenharia" aria-label="Engenharia: componentes do veículo em holograma">
      <div className={styles.engSticky}>
        <div className={styles.engInfo}>
          <span className={styles.eyebrow}>Engenharia · {String(active + 1).padStart(2, "0")}/{String(parts.length).padStart(2, "0")}</span>
          <h2 className={styles.engTitle} key={copy.title}>
            {copy.title}
          </h2>
          <p className={styles.engText} key={`${copy.title}-t`}>
            {copy.text}
          </p>
          <ul className={styles.chips}>
            {copy.chips.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <nav className={styles.engNav} aria-label="Componentes">
            {parts.map((p, i) => (
              <button key={p.id} type="button" className={i === active ? styles.engNavActive : ""} onClick={() => goTo(i)} aria-current={i === active}>
                <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                {COPY[p.id].title}
              </button>
            ))}
          </nav>
          <div className={styles.engProgress} aria-hidden>
            <span style={{ transform: `scaleX(${progress})` }} />
          </div>
          <p className={styles.engHint}>Arraste para girar · passe o mouse ou toque nas peças</p>
        </div>
        <div className={styles.engCanvas} ref={canvasWrap}>
          <div className={styles.engHud} aria-hidden>
            <span>SCAN</span>
            <span className="mono">{Math.round(progress * 100)}%</span>
          </div>
          <Canvas
            frameloop={inView ? "always" : "never"}
            dpr={[1, mobile ? 1.5 : 2]}
            camera={{ position: [0, 0.4, 6.4], fov: mobile ? 46 : 36 }}
            gl={{ antialias: true, alpha: true }}
          >
            <Stage parts={parts} state={state} reduced={reduced} drag={drag} mobile={mobile} />
          </Canvas>
        </div>
      </div>
    </section>
  );
}
