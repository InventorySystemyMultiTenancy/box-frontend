"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "./HeroScrollVideo.module.css";

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Abaixo desta largura o hero abandona o scroll-scrubbing: em aparelhos reais o loop de
// seek a cada frame (rAF infinito) sobrecarrega a GPU/CPU e trava a rolagem. No lugar,
// o vídeo vira um fundo fixo (position: fixed) tocando em loop normal — sem nenhum
// custo de JS por frame — enquanto o conteúdo rola por cima normalmente.
function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches;
}

/**
 * No desktop: vídeo fixo (position: sticky) cujo frame é controlado pela posição de
 * rolagem (scroll-scrubbing). No mobile: vídeo é um fundo fixo tocando em loop normal —
 * continua visível atrás de todas as seções, mas sem nenhum seek atrelado ao scroll.
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
        // Não confiamos só no atributo autoplay — em vários navegadores mobile reais
        // ele é ignorado silenciosamente dependendo de economia de dados/bateria.
        video.muted = true;
        video.loop = !prefersReducedMotion();
        if (!prefersReducedMotion()) {
          video.play().catch(() => {});
        }
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

    // Alguns navegadores mobile só liberam a reprodução após um primeiro gesto do
    // usuário, mesmo com o vídeo mudo — reforça o play() no primeiro toque/scroll.
    function retryPlay() {
      if (mobile && video && video.paused && !prefersReducedMotion()) {
        video.play().catch(() => {});
      }
    }
    if (mobile) {
      document.addEventListener("touchstart", retryPlay, { once: true, passive: true });
      document.addEventListener("scroll", retryPlay, { once: true, passive: true });
    }

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      document.removeEventListener("touchstart", retryPlay);
      document.removeEventListener("scroll", retryPlay);
    };
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

  return (
    <div ref={trackRef} className={`${styles.scrollTrack} ${mobile ? styles.scrollTrackMobile : ""}`}>
      <div className={styles.sticky}>
        <video
          ref={videoRef}
          className={`${styles.video} ${!mobile ? styles.videoFading : ""} ${ready ? styles.ready : ""}`}
          src={mobile ? "/hero-scroll-scrub-mobile.mp4" : "/hero-scroll-scrub.mp4"}
          poster="/hero-poster.jpg"
          muted
          playsInline
          preload="auto"
        />
        <div className={styles.scrim} />
      </div>
      <div className={mobile ? styles.mobileFlow : styles.content}>
        {overlay}
        {children}
      </div>
    </div>
  );
}
