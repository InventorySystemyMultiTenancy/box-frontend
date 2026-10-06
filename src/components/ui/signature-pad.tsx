"use client";

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { Eraser } from "lucide-react";

export interface SignaturePadHandle {
  /** PNG da assinatura, ou null se nada foi desenhado. */
  toBlob: () => Promise<Blob | null>;
  clear: () => void;
  isEmpty: () => boolean;
}

/**
 * Campo de assinatura com o dedo/caneta/mouse (pointer events — funciona no celular e no
 * tablet entregue ao cliente no balcão). Fundo branco no PNG para ficar legível impresso.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, { label?: string; onChange?: (empty: boolean) => void }>(
  function SignaturePad({ label = "Assinatura do cliente", onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [empty, setEmpty] = useState(true);

    // Canvas na resolução real da tela (nítido em celular com densidade alta). Refeito no
    // primeiro toque também: dentro de um Dialog com animação de zoom, o tamanho medido na
    // montagem pode ainda não ser o final, e o traço sairia deslocado do dedo.
    function setup() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const ctx = canvas.getContext("2d")!;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    }

    useEffect(setup, []);

    function point(e: React.PointerEvent<HTMLCanvasElement>) {
      const rect = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function start(e: React.PointerEvent<HTMLCanvasElement>) {
      if (empty) setup();
      e.currentTarget.setPointerCapture(e.pointerId);
      drawing.current = true;
      const ctx = e.currentTarget.getContext("2d")!;
      const { x, y } = point(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 0.01, y + 0.01);
      ctx.stroke();
      if (empty) {
        setEmpty(false);
        onChange?.(false);
      }
    }

    function move(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = e.currentTarget.getContext("2d")!;
      const { x, y } = point(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    function end() {
      drawing.current = false;
    }

    function clear() {
      setup();
      setEmpty(true);
      onChange?.(true);
    }

    useImperativeHandle(ref, () => ({
      toBlob: () =>
        new Promise((resolve) => {
          if (empty || !canvasRef.current) return resolve(null);
          canvasRef.current.toBlob((blob) => resolve(blob), "image/png");
        }),
      clear,
      isEmpty: () => empty,
    }));

    return (
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.8rem" }}>
          <span>{label}</span>
          <button
            type="button"
            onClick={clear}
            disabled={empty}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", border: 0, background: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <Eraser size={14} /> Limpar
          </button>
        </div>
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          aria-label={label}
          style={{
            width: "100%",
            height: 140,
            border: "1px dashed var(--border-strong)",
            borderRadius: 8,
            background: "#fff",
            touchAction: "none",
            cursor: "crosshair",
          }}
        />
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Assine com o dedo, caneta ou mouse dentro do quadro.</span>
      </div>
    );
  }
);
