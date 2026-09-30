"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

type RecorderStatus = "idle" | "recording" | "processing";

interface VoiceInputButtonProps {
  // Recebe o texto já transcrito — quem usa decide o que fazer (preencher campo,
  // mandar direto como pergunta, etc.).
  onTranscribed: (text: string) => void;
  className?: string;
  disabled?: boolean;
  title?: string;
}

// Botão de microfone reutilizável: clique grava, clique de novo transcreve e devolve
// o texto. Usado tanto na busca do header quanto no chat de ajuda (/dashboard/busca).
export function VoiceInputButton({ onTranscribed, className, disabled, title }: VoiceInputButtonProps) {
  const { token } = useAuth();
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleStop = useCallback(
    (recorder: MediaRecorder, stream: MediaStream) => async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      if (!token || blob.size === 0) {
        setStatus("idle");
        return;
      }
      setStatus("processing");
      try {
        const { text } = await api.transcribeAudio(blob, token);
        onTranscribed(text);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Não consegui transcrever o áudio. Tente de novo.");
      } finally {
        setStatus("idle");
      }
    },
    [token, onTranscribed]
  );

  async function startRecording() {
    if (status !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Seu navegador não permite gravar áudio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStop(recorder, stream);
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch {
      toast.error("Não consegui acessar o microfone — verifique a permissão do navegador.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  const busy = status === "processing";
  const recording = status === "recording";

  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={recording ? stopRecording : startRecording}
      aria-label={recording ? "Parar gravação e transcrever" : (title ?? "Perguntar por voz")}
      title={recording ? "Parar gravação e transcrever" : (title ?? "Perguntar por voz")}
      className={className}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : recording ? (
        <Square className="size-4 animate-pulse fill-current text-destructive" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}
