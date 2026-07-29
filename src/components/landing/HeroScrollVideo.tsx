"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "./HeroScrollVideo.module.css";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hero com scroll-scrubbing: em vez de um player, o vídeo funciona como um flipbook —
 * a posição de rolagem dentro de .scrollTrack define diretamente o frame exibido
 * (currentTime = progresso * duração), sem easing, igual ao slider antes/depois da spec.
 */
export default function HeroScrollVideo({ children }: { children?: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(0);
  const targetTimeRef = useRef(0);
  const renderedTimeRef = useRef(0);
  const tickingRef = useRef(false);
  const smoothingRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onLoadedMetadata() {
      if (!video) return;
      durationRef.current = video.duration;
      // "acorda" o decoder em navegadores que só pintam o frame após um play/pause —
      // necessário sobretudo no Safari iOS antes de aceitar seeks programáticos.
      video.play().then(() => video.pause()).catch(() => {});
      const initialTime = prefersReducedMotion() ? video.duration * 0.5 : 0;
      video.currentTime = initialTime;
      targetTimeRef.current = initialTime;
      renderedTimeRef.current = initialTime;
      setReady(true);
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    function applySmoothedFrame() {
      const track = trackRef.current;
      const video = videoRef.current;
      const duration = durationRef.current;
      if (!track || !video || !duration) {
        smoothingRef.current = 0;
        return;
      }

      const nextTime = renderedTimeRef.current + (targetTimeRef.current - renderedTimeRef.current) * 0.18;
      renderedTimeRef.current = nextTime;

      if (Math.abs(video.currentTime - nextTime) > 0.025) {
        video.currentTime = nextTime;
      }

      if (Math.abs(targetTimeRef.current - nextTime) > 0.01) {
        smoothingRef.current = requestAnimationFrame(applySmoothedFrame);
      } else {
        renderedTimeRef.current = targetTimeRef.current;
        smoothingRef.current = 0;
      }
    }

    function updateTargetFrame() {
      tickingRef.current = false;
      const track = trackRef.current;
      const duration = durationRef.current;
      if (!track || !duration) return;

      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      targetTimeRef.current = progress * duration;

      if (!smoothingRef.current) {
        smoothingRef.current = requestAnimationFrame(applySmoothedFrame);
      }
    }

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(updateTargetFrame);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateTargetFrame();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (smoothingRef.current) cancelAnimationFrame(smoothingRef.current);
    };
  }, []);

  return (
    <div ref={trackRef} className={styles.scrollTrack}>
      <div className={styles.sticky}>
        <video
          ref={videoRef}
          className={`${styles.video} ${ready ? styles.ready : ""}`}
          src="/hero-scroll-scrub.mp4"
          muted
          playsInline
          preload="auto"
        />
        <div className={styles.scrim} />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
