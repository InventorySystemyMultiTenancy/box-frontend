"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHeavyMedia } from "@/lib/heavy-media";
import styles from "./LoginIntroOverlay.module.css";

const DESKTOP_SRC = "/Logo_assembling_in_auto_shop_20260925091252.mp4";
const FADE_MS = 650;

let externalPlay: ((target: string) => Promise<void>) | null = null;

/** Chamado pela tela de login (após confirmar email/senha) — toca o vídeo de abertura
 * até o fim e só então navega pro dashboard, com fade. Resolve mesmo se o overlay
 * ainda não tiver montado, pra nunca travar o login. */
export function playLoginIntro(target = "/dashboard"): Promise<void> {
  return externalPlay ? externalPlay(target) : Promise.resolve();
}

/** Fica no layout raiz (fora da página de login) pra sobreviver à troca de rota — o
 * fade final revela o dashboard já montado por baixo em vez de piscar o form antigo. */
export default function LoginIntroOverlay() {
  const pathname = usePathname();
  const router = useRouter();
  // Só em computador (ver lib/heavy-media): no celular a animação eram ~3 MB a mais e
  // vários segundos antes do painel — lá o login vai direto.
  const heavyMedia = useHeavyMedia();
  const targetRef = useRef("/dashboard");
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resolveRef = useRef<(() => void) | null>(null);

  const finish = useCallback(() => {
    router.push(targetRef.current);
    setFading(true);
    window.setTimeout(() => {
      setVisible(false);
      setFading(false);
      resolveRef.current?.();
      resolveRef.current = null;
    }, FADE_MS);
  }, [router]);

  useEffect(() => {
    externalPlay = (target) =>
      new Promise<void>((resolve) => {
        targetRef.current = target;
        const video = videoRef.current;
        if (!video || !heavyMedia) {
          resolve();
          return;
        }
        resolveRef.current = resolve;
        setVisible(true);
        video.currentTime = 0;
        const attempt = video.play();
        if (attempt && typeof attempt.catch === "function") {
          attempt.catch(() => {
            video.muted = true;
            video.play().catch(finish);
          });
        }
      });
    return () => {
      externalPlay = null;
    };
  }, [finish, heavyMedia]);

  // Preload começa assim que a tela de login abre; mantém a src durante o fade mesmo
  // depois da navegação pro dashboard (senão o vídeo perde o frame no meio da transição).
  const introSrc = heavyMedia && (pathname === "/login" || visible) ? DESKTOP_SRC : undefined;

  return (
    <div className={`${styles.overlay} ${visible ? styles.visible : ""} ${fading ? styles.fading : ""}`}>
      <video
        ref={videoRef}
        className={styles.video}
        src={introSrc}
        playsInline
        preload="auto"
        onEnded={finish}
        onError={finish}
      />
    </div>
  );
}
