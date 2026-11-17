"use client";

import { useEffect } from "react";

/**
 * Publica a área REALMENTE visível da tela em variáveis CSS (--vvh altura, --vvtop
 * deslocamento). No celular, com o teclado aberto, 100dvh continua sendo a tela inteira
 * (o teclado cobre a parte de baixo) — as janelas de formulário usam estas variáveis para
 * caber no espaço visível e rolar por dentro, em vez de a página de trás rolar.
 */
export default function ViewportVars() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty("--vvh", `${vv.height}px`);
      root.style.setProperty("--vvtop", `${vv.offsetTop}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return null;
}
