"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useMediaQuery, usePrefersReducedMotion } from "./hooks";
import styles from "./premium.module.css";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

const FALLBACK_DURATION = 10;
const duration = (v: HTMLVideoElement) => (Number.isFinite(v.duration) && v.duration > 0 ? v.duration : FALLBACK_DURATION);

export interface ProcessStep {
  n: string;
  title: string;
  text: string;
}

/**
 * "Como funciona" sobre o vídeo cinematográfico da oficina: a seção fica fixa na tela e o
 * scroll controla o vídeo (mesmo scrub do hero antigo) e revela as etapas em sequência.
 */
export default function ProcessVideoScene({ steps, eyebrow, title }: { steps: ProcessStep[]; eyebrow: string; title: string }) {
  const isMobile = useMediaQuery("(max-width: 760px)");
  const reduced = usePrefersReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [progress, setProgress] = useState(0);
  const src = isMobile ? "/hero-scroll-scrub-mobile.mp4" : "/hero-scroll-scrub.mp4";

  useEffect(() => {
    const el = track.current;
    const v = video.current;
    if (!el || !v) return;
    let primed = false;
    const prime = () => {
      if (primed) return;
      primed = true;
      // iOS só desenha frames depois de um play/pause.
      v.play()
        .then(() => v.pause())
        .catch(() => {});
    };
    v.addEventListener("loadedmetadata", prime);
    if (v.readyState >= 1) prime();
    const trigger = ScrollTrigger.create({
      trigger: el,
      start: "top top",
      end: "bottom bottom",
      scrub: true,
      onUpdate: (self) => {
        setProgress(self.progress);
        if (reduced || v.seeking) return;
        v.currentTime = Math.min(self.progress * duration(v), duration(v) - 0.05);
      },
    });
    return () => {
      v.removeEventListener("loadedmetadata", prime);
      trigger.kill();
    };
  }, [src, reduced]);

  // Cada etapa ocupa uma fatia do scroll (depois de uma entrada de 12%).
  const stepProgress = (i: number) => (progress - 0.12 - (i * 0.8) / steps.length) / (0.8 / steps.length);

  return (
    <section className={styles.videoTrack} ref={track} aria-label={title}>
      <div className={styles.videoSticky}>
        <video key={src} ref={video} className={styles.videoEl} src={src} poster="/hero-poster.jpg" muted playsInline preload="metadata" />
        <div className={styles.videoScrim} />
        <div className={styles.videoContent}>
          <div className={styles.videoHead} style={{ opacity: Math.min(1, progress * 8 + 0.15) }}>
            <span className={styles.eyebrow}>{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <ol className={styles.videoSteps}>
            {steps.map((s, i) => {
              const p = reduced ? 1 : Math.min(1, Math.max(0, stepProgress(i) * 2.2));
              return (
                <li key={s.n} className={p >= 1 ? styles.stepDone : ""} style={{ opacity: 0.18 + p * 0.82, transform: `translateY(${(1 - p) * 18}px)` }}>
                  <span className={`mono ${styles.stepN}`}>{s.n}</span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.text}</p>
                  </div>
                  <span className={styles.stepBar} style={{ transform: `scaleX(${p})` }} aria-hidden />
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
