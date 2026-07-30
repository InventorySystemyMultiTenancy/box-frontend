"use client";

import { useEffect, useState } from "react";

/**
 * matchMedia (não innerWidth + listener de resize) porque já debounça nativamente e
 * dispara também em mudança de orientação da tela — o caso mais comum de "mobile"
 * mudar de estado no celular sem a página recarregar.
 */
function matchesBreakpoint(breakpointPx: number) {
  return typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpointPx}px)`).matches;
}

export function useIsMobile(breakpointPx = 760) {
  const [isMobile, setIsMobile] = useState(() => matchesBreakpoint(breakpointPx));

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpointPx]);

  return isMobile;
}
