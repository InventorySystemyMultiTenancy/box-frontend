"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "./HeroScrollVideo.module.css";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HeroScrollVideo({ children }: { children?: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(0);
  const targetTimeRef = useRef(0);
  const visibleTimeRef = useRef(0);
  const tickingRef = useRef(false);
  const scrubFrameRef = useRef(0);
  const lastSeekAtRef = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onLoadedMetadata() {
      if (!video) return;
      durationRef.current = video.duration;
      video.pause();

      const initialTime = prefersReducedMotion() ? video.duration * 0.5 : 0.001;
      targetTimeRef.current = initialTime;
      visibleTimeRef.current = initialTime;
      video.currentTime = initialTime;

      video.play().then(() => video.pause()).catch(() => {});
      setReady(true);
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    function seekVideo(time: number) {
      const video = videoRef.current;
      if (!video || !durationRef.current || video.seeking) return false;

      const nextTime = Math.min(durationRef.current - 0.04, Math.max(0.001, time));
      const seekableTo = video.seekable.length ? video.seekable.end(video.seekable.length - 1) : durationRef.current;
      if (nextTime > seekableTo) return false;

      if (typeof video.fastSeek === "function") {
        video.fastSeek(nextTime);
      } else {
        video.currentTime = nextTime;
      }
      return true;
    }

    function updateTargetTime() {
      tickingRef.current = false;
      const track = trackRef.current;
      const duration = durationRef.current;
      if (!track || !duration) return;

      const rect = track.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      track.style.setProperty("--scroll-progress", progress.toFixed(4));
      targetTimeRef.current = progress * duration;
    }

    function scrubTowardTarget() {
      const now = performance.now();
      const targetTime = targetTimeRef.current;
      const visibleTime = visibleTimeRef.current;
      const nextTime = visibleTime + (targetTime - visibleTime) * 0.34;
      const seekDelta = Math.abs(nextTime - visibleTime);
      const targetDelta = Math.abs(targetTime - nextTime);
      const canSeek = now - lastSeekAtRef.current > 34;

      if (canSeek && (seekDelta > 0.018 || targetDelta > 0.035) && seekVideo(nextTime)) {
        visibleTimeRef.current = nextTime;
        lastSeekAtRef.current = now;
      }

      scrubFrameRef.current = requestAnimationFrame(scrubTowardTarget);
    }

    function onScroll() {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(updateTargetTime);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    updateTargetTime();
    scrubFrameRef.current = requestAnimationFrame(scrubTowardTarget);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (scrubFrameRef.current) cancelAnimationFrame(scrubFrameRef.current);
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
