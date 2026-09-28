"use client";

import { useEffect, useMemo } from "react";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoCaptureFieldProps {
  id: string;
  label: React.ReactNode;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  busy?: boolean;
  busyLabel?: string;
  hint?: React.ReactNode;
}

// Card grande e tocável em vez do seletor de arquivo nativo (pequeno e pouco claro
// no celular) — mostra uma prévia da foto tirada, pra quem está registrando confirmar
// visualmente que capturou a coisa certa antes de continuar.
export function PhotoCaptureField({ id, label, file, onChange, disabled, busy, busyLabel, hint }: PhotoCaptureFieldProps) {
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="col-span-2 grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-md border-2 border-dashed border-input p-3 text-center text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground",
          (disabled || busy) && "pointer-events-none opacity-60"
        )}
      >
        {busy ? (
          <>
            <Loader2 className="size-6 animate-spin" />
            <span>{busyLabel ?? "Analisando foto..."}</span>
          </>
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="Foto selecionada" className="h-28 w-auto rounded-md object-cover" />
        ) : (
          <>
            <Camera className="size-6" />
            <span>Toque para tirar a foto</span>
          </>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        capture="environment"
        disabled={disabled || busy}
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {!busy && file && <span className="text-xs text-muted-foreground">Foto capturada — toque na imagem pra trocar.</span>}
      {hint}
    </div>
  );
}
