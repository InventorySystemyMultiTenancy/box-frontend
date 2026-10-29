"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import styles from "../dashboard.module.css";

type Connection = { configured: boolean; state: string | null; number: string | null; error?: string };

const STATE_LABELS: Record<string, string> = {
  open: "Conectado",
  connecting: "Aguardando leitura do QR code",
  close: "Desconectado",
  missing: "Nenhum número conectado",
  error: "Não foi possível consultar",
};

// Número que envia os avisos automáticos (projeto finalizado → equipe e cliente). Só a
// conexão fica aqui; chave, instância e números da equipe vêm das variáveis de ambiente.
export function WhatsappConnectionPanel() {
  const { token } = useAuth();
  const [qr, setQr] = useState<{ qrBase64: string | null; pairingCode: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const { data: connection, refetch, error } = useQuery({
    queryKey: ["whatsapp-connection"],
    queryFn: async () => (await api.whatsappConnection(token!)) as Connection,
    enabled: !!token,
    // Enquanto o QR está na tela, confere a cada 4s se o número já conectou.
    refetchInterval: (query) => (qr && query.state.data?.state !== "open" ? 4000 : false),
  });
  const load = () => refetch();

  async function handleConnect() {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.whatsappConnect(token);
      if (result.state === "open") {
        setQr(null);
        setMessage("O número já está conectado.");
      } else {
        setQr({ qrBase64: result.qrBase64, pairingCode: result.pairingCode });
      }
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Não foi possível gerar o QR code.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    if (!token || !window.confirm("Desconectar este WhatsApp? Os avisos automáticos param até conectar um número de novo.")) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.whatsappDisconnect(token);
      setQr(null);
      await load();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Não foi possível desconectar.");
    } finally {
      setBusy(false);
    }
  }

  const connected = connection?.state === "open";
  const errorMessage = message ?? (error ? (error instanceof ApiError ? error.message : "Não foi possível consultar o WhatsApp.") : null);

  return (
    <div className={styles.panel}>
      <h2>WhatsApp</h2>
      <div className="grid gap-3 text-sm">
        {connection && !connection.configured ? (
          <p className="text-muted-foreground">
            O WhatsApp ainda não foi configurado no servidor (EVOLUTION_API_URL e EVOLUTION_API_KEY).
          </p>
        ) : (
          <>
            <div>
              <span className="text-muted-foreground">Status: </span>
              <strong>{connection ? (STATE_LABELS[connection.state ?? ""] ?? connection.state) : "Carregando..."}</strong>
              {connected && connection?.number && <span className="block text-muted-foreground">Número: +{connection.number}</span>}
            </div>
            <p className="text-xs text-muted-foreground">
              Número que envia os avisos automáticos de veículo pronto. Para associar, abra o WhatsApp no celular em
              Aparelhos conectados → Conectar aparelho e leia o QR code.
            </p>
            {qr && !connected && (
              <div className="grid justify-items-center gap-2">
                {qr.qrBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr.qrBase64} alt="QR code para conectar o WhatsApp" className="size-56 rounded-md bg-white p-2" />
                ) : (
                  <p className="text-muted-foreground">QR code indisponível — tente de novo.</p>
                )}
                {qr.pairingCode && <span className="text-xs text-muted-foreground">Código: {qr.pairingCode}</span>}
              </div>
            )}
            {connected ? (
              <button type="button" className={styles.actionButton} style={{ background: "var(--bg-panel)", color: "inherit" }} disabled={busy} onClick={handleDisconnect}>
                {busy ? "Aguarde..." : "Desconectar"}
              </button>
            ) : (
              <button type="button" className={styles.actionButton} disabled={busy || !connection} onClick={handleConnect}>
                {busy ? "Gerando..." : qr ? "Gerar novo QR code" : "Conectar (ler QR code)"}
              </button>
            )}
          </>
        )}
        {errorMessage && <div className={styles.formMessage}>{errorMessage}</div>}
      </div>
    </div>
  );
}
