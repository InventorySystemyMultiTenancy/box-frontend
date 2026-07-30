"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "./HeroScrollVideo.module.css";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Abaixo desta largura o hero abandona o scroll-scrubbing: em aparelhos reais o loop de
// seek a cada frame (rAF infinito) sobrecarrega a GPU/CPU e trava a rolagem — o vídeo
// também depende de 100vh, que oscila na barra de endereço do navegador mobile e fazia o
// texto do hero (posicionado por margem negativa) sumir de tela por alguns segundos.
function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
}

/**
 * Componente do site institucional que ora escrutina o video na página de rolagem.
 * No desktop: vídeo fixo (position: sticky) cujo frame é controlado pela posição de
 * rolagem (scroll-scrubbing). No mobile: vídeo simplesmente toca em loop dentro de uma
 * seção normal de 100svh — sem sticky, sem seeks — para não travar em aparelhos reais.
 */
export default function HeroScrollVideo({ overlay, children }: { overlay: ReactNode; children?: ReactNode }) {
  const [mobile] = useState(isMobileViewport);
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

      if (mobile) {
        // No mobile o autoplay/loop do próprio <video> cuida da reprodução.
        setReady(true);
        return;
      }

      video.pause();
      const initialTime = prefersReducedMotion() ? video.duration * 0.5 : 0.001;
      targetTimeRef.current = initialTime;
      visibleTimeRef.current = initialTime;
      video.currentTime = initialTime;

      video.play().then(() => video.pause()).catch(() => {});
      setReady(true);
    }

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    // Se o navegador já carregou os metadados (vídeo em cache) antes deste efeito
    // rodar, o evento "loadedmetadata" já disparou e nunca chegaríamos a ouvi-lo.
    if (video.readyState >= 1) onLoadedMetadata();
    return () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
  }, [mobile]);

  useEffect(() => {
    if (mobile || prefersReducedMotion()) return;

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
  }, [mobile]);

  const canAutoplay = mobile && !prefersReducedMotion();

  return (
    <div ref={trackRef} className={`${styles.scrollTrack} ${mobile ? styles.scrollTrackMobile : ""}`}>
      <div className={styles.sticky}>
        <video
          ref={videoRef}
          className={`${styles.video} ${ready ? styles.ready : ""}`}
          src="/hero-scroll-scrub.mp4"
          muted
          playsInline
          preload="auto"
          autoPlay={canAutoplay}
          loop={canAutoplay}
        />
        <div className={styles.scrim} />
        {mobile && <div className={styles.overlaySlot}>{overlay}</div>}
      </div>
      {mobile ? children : <div className={styles.content}>{overlay}{children}</div>}
    </div>
  );
}
