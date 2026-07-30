"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useIsMobile } from "@/lib/useIsMobile";
import styles from "./HeroScrollVideo.module.css";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Duração real dos dois arquivos (conferida via ffprobe). Alguns navegadores (Safari,
// principalmente com MP4 sem moov no início do arquivo) podem reportar `duration`
// como Infinity/NaN por um tempo — esse valor serve de fallback para o scrub nunca
// travar esperando um número que talvez nunca chegue.
const FALLBACK_DURATION = 10;

function getDuration(video: HTMLVideoElement) {
  return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : FALLBACK_DURATION;
}

/**
 * Vídeo controlado pelo scroll (scroll-scrubbed) dentro de uma seção sticky em tela
 * cheia — mesmo core (GSAP ScrollTrigger + scrub) no desktop e no mobile. O que muda
 * no mobile: fonte de vídeo mais leve, remount seguro via key ao trocar de fonte, e o
 * truque de "play + pause" para o iOS Safari não ficar com o primeiro frame preto.
 */
export default function HeroScrollVideo({ overlay, children }: { overlay: ReactNode; children?: ReactNode }) {
  const isMobile = useIsMobile();
  const trackRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(prefersReducedMotion);

  const videoSrc = isMobile ? "/hero-scroll-scrub-mobile.mp4" : "/hero-scroll-scrub.mp4";

  useEffect(() => {
    const video = videoRef.current;
    const track = trackRef.current;
    const sticky = stickyRef.current;
    if (!video || !track || !sticky) return;

    if (prefersReducedMotion()) {
      video.currentTime = 0;
      return;
    }

    let becameReady = false;
    let pendingProgress = 0;
    let trigger: ScrollTrigger | undefined;
    let cancelled = false;

    function markReady() {
      if (becameReady || !video || cancelled) return;
      becameReady = true;

      video.currentTime = pendingProgress * getDuration(video);

      // iOS Safari (e alguns Android) não desenham nenhum frame num vídeo pausado
      // que nunca rodou — "ligar e desligar" rapidamente força a decodificação do
      // primeiro frame antes de currentTime funcionar visualmente.
      const playPromise = video.play();
      if (playPromise) {
        playPromise.then(() => video.pause()).catch(() => {});
      }
      setReady(true);

      trigger = ScrollTrigger.create({
        trigger: track,
        start: "top top",
        end: "bottom bottom",
        pin: sticky,
        scrub: true,
        onUpdate: (self) => {
          pendingProgress = self.progress;
          if (!track || !video) return;
          track.style.setProperty("--scroll-progress", self.progress.toFixed(4));
          if (!video.seeking) {
            video.currentTime = self.progress * getDuration(video);
          }
        },
      });
    }

    // `readyState >= 1` já garante metadados (inclusive em cache) mesmo que o navegador
    // ainda não tenha resolvido `duration` corretamente — não travamos mais nisso.
    video.addEventListener("loadedmetadata", markReady);
    if (video.readyState >= 1) markReady();

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", markReady);
      trigger?.kill();
    };
  }, [videoSrc]);

  return (
    <>
      {/* Altura fixa (não min-height): delimita exatamente a distância de scroll do
          scrub. O restante das seções da página fica FORA deste bloco — como
          irmão, não filho — para não herdar essa altura travada em 220vh. */}
      <div ref={trackRef} className={styles.scrollTrack}>
        <div ref={stickyRef} className={styles.sticky}>
          <video
            key={videoSrc}
            ref={videoRef}
            className={`${styles.video} ${ready ? styles.ready : ""}`}
            src={videoSrc}
            poster="/hero-poster.jpg"
            muted
            playsInline
            preload="auto"
          />
          <div className={styles.scrim} />
          <div className={styles.overlaySlot}>{overlay}</div>
        </div>
      </div>
      <div className={styles.content}>{children}</div>
    </>
  );
}
