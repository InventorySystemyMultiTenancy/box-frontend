"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useInView, usePrefersReducedMotion } from "./hooks";
import styles from "./premium.module.css";

/**
 * Card com perspectiva 3D que acompanha o ponteiro e um brilho que segue o cursor.
 * Só no mouse (no toque fica o estado normal, sem "grudar" inclinado).
 */
export function TiltCard({ children, className = "", max = 7 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse" || reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * max}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * max}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div ref={ref} className={`${styles.tilt} ${className}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </div>
  );
}

/** Número que conta até o valor ao aparecer na tela ("6.400+", "4.9/5", "17"). */
export function Counter({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref);
  const reduced = usePrefersReducedMotion();
  const match = value.match(/^([^\d]*)([\d.,]+)(.*)$/);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    if (!inView || reduced || !match) return;
    const [, prefix, num, suffix] = match;
    // "6.400" (milhar BR) vs "4.9" (decimal).
    const thousands = /^\d{1,3}(\.\d{3})+$/.test(num);
    const target = thousands ? Number(num.replace(/\./g, "")) : Number(num.replace(",", "."));
    const decimals = thousands ? 0 : (num.split(/[.,]/)[1]?.length ?? 0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1600);
      const eased = 1 - Math.pow(1 - t, 4);
      const current = target * eased;
      const text = thousands
        ? Math.round(current).toLocaleString("pt-BR")
        : decimals
          ? current.toFixed(decimals).replace(".", num.includes(",") ? "," : ".")
          : String(Math.round(current));
      setShown(`${prefix}${text}${suffix}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Só quando entra na tela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced]);

  return (
    <span ref={ref} aria-label={value}>
      {shown}
    </span>
  );
}

const TIMELINE_DEMO = [
  { t: "08:12", title: "Veículo entrou na oficina", meta: "Check-in com 24 fotos" },
  { t: "09:40", title: "Diagnóstico registrado", meta: "Laudo + 6 fotos + 1 vídeo" },
  { t: "10:05", title: "Novo item para aprovação", meta: "Pastilhas de freio dianteiras", approval: true },
  { t: "10:07", title: "Aprovado pelo cliente", meta: "Pelo celular" },
  { t: "16:30", title: "Etapa avançada: Pronto para retirada", meta: "Checklist de saída assinado" },
];

/** Painel holográfico ilustrando a timeline ao vivo (exemplo, não dados reais). */
export function LiveTimelineDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const reduced = usePrefersReducedMotion();
  const [count, setCount] = useState(reduced ? TIMELINE_DEMO.length : 0);

  useEffect(() => {
    if (!inView || reduced) return;
    const id = window.setInterval(() => setCount((c) => (c >= TIMELINE_DEMO.length + 2 ? 1 : c + 1)), 1300);
    return () => window.clearInterval(id);
  }, [inView, reduced]);

  const visible = Math.min(count, TIMELINE_DEMO.length);

  return (
    <div ref={ref} className={styles.hudPanel} aria-label="Exemplo da timeline ao vivo do projeto">
      <div className={styles.hudBar}>
        <span className={styles.liveDot} />
        <span>AO VIVO</span>
        <span className={`mono ${styles.hudCode}`}>OS-2026-0418</span>
      </div>
      <ol className={styles.hudTimeline}>
        {TIMELINE_DEMO.map((e, i) => (
          <li key={e.title} className={i < visible ? styles.hudIn : ""}>
            <span className={`mono ${styles.hudTime}`}>{e.t}</span>
            <div>
              <strong>{e.title}</strong>
              <small>{e.meta}</small>
              {e.approval && i < visible && (
                <span className={styles.hudApprove}>
                  <span>Recusar</span>
                  <span className={styles.hudApproveYes}>Aprovar</span>
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
      <span className={styles.hudCaption}>Exemplo ilustrativo</span>
    </div>
  );
}

/** Revela o conteúdo (subindo + fade + leve blur) ao entrar na tela. */
export function Appear({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`${styles.appear} ${shown ? styles.appearIn : ""} ${className}`} style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}>
      {children}
    </div>
  );
}
