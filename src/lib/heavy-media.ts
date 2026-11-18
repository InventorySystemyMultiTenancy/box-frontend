"use client";

import { useSyncExternalStore } from "react";

/**
 * Vídeos decorativos (fundo do login, animação de entrada) só em computador com rede e
 * aparelho bons. No celular — principalmente nos mais antigos — eram ~6 MB baixados antes
 * de a pessoa conseguir entrar, e a tela travava/demorava muito. Lá fica uma imagem leve.
 */
export function canUseHeavyMedia(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const nav = navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
      deviceMemory?: number;
    };
    if (nav.connection?.saveData) return false;
    if (nav.connection?.effectiveType && /2g|3g/.test(nav.connection.effectiveType)) return false;
    if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
    if (nav.hardwareConcurrency && nav.hardwareConcurrency < 4) return false;
    return window.matchMedia("(min-width: 1024px) and (hover: hover) and (prefers-reduced-motion: no-preference)").matches;
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

/** No servidor e na primeira pintura = false (nada pesado é pedido antes da decisão). */
export function useHeavyMedia() {
  return useSyncExternalStore(noopSubscribe, canUseHeavyMedia, () => false);
}
