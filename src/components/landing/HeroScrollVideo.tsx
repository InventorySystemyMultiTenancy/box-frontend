"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "./HeroScrollVideo.module.css";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HeroScrollVideo({ children }: { children?: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const tickingRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const idleTimerRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onCanPlay() {
      if (!video) return;
      video.playbackRate = prefersReducedMotion() ? 0.65 : 0.85;
      video.play().catch(() => {});
      setReady(true);
    }

    video.addEventListener("canplay", onCanPlay);
    return () => video.removeEventListener("canplay", onCanPlay);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    function clamp(min: number, value: number, max: number) {
      return Math.min(max, Math.max(min, value));
    }

    function updateScrollSync() {
      tickingRef.current = false;
      const track = trackRef.current;
      const video = videoRef.current;
      if (!track || !video) return;

      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      track.style.setProperty("--scroll-progress", progress.toFixed(4));

      const now = performance.now();
      const scrollY = window.scrollY;
      const elapsed = Math.max(16, now - (lastTimeRef.current || now));
      const delta = scrollY - lastScrollYRef.current;
      const speed = Math.min(1.25, Math.abs(delta) / elapsed);
      const directionFactor = delta < 0 ? 0.72 : 1;
      const targetRate = clamp(0.65, (0.82 + speed * 0.9) * directionFactor, 1.8);

      video.playbackRate += (targetRate - video.playbackRate) * 0.32;
      video.play().catch(() => {});

      lastScrollYRef.current = scrollY;
      lastTimeRef.current = now;

      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = window.setTimeout(() => {
        const currentVideo = videoRef.current;
        if (!currentVideo) return;
        currentVideo.playbackRate += (0.85 - currentVideo.playbackRate) * 0.6;
      }, 140);
    }

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(updateScrollSync);
    }

    lastScrollYRef.current = window.scrollY;
    lastTimeRef.current = performance.now();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateScrollSync();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
    };
  }, []);

  return (
    <div ref={trackRef} className={styles.scrollTrack}>
      <div className={styles.sticky}>
        <video
          ref={videoRef}
          className={`${styles.video} ${ready ? styles.ready : ""}`}
          src="/hero-scroll-scrub.mp4"
          autoPlay
          loop
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
