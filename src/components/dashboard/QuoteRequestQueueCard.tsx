"use client";

import { useState } from "react";
import { QuoteRequest } from "@/lib/types";
import styles from "./dashboard.module.css";

export default function QuoteRequestQueueCard({
  request,
  onAccept,
  onDecline,
}: {
  request: QuoteRequest;
  onAccept: (scheduledAt: string, initialValue?: number) => Promise<void>;
  onDecline: (reason?: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"idle" | "accept" | "decline">("idle");
  const [scheduledAt, setScheduledAt] = useState("");
  const [initialValue, setInitialValue] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirmAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledAt) return;
    setBusy(true);
    try {
      await onAccept(new Date(scheduledAt).toISOString(), initialValue ? Number(initialValue) : undefined);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDecline(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onDecline(declineReason || undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.queueCard}>
      <h3>
        {request.vehicle.brand} {request.vehicle.model} {request.vehicle.year}
      </h3>
      <p>{request.problemDescription}</p>
      <div className={styles.partMeta} style={{ marginTop: "0.6rem" }}>
        <span>Cliente: {request.customer.name}</span>
        {request.problemName && <span>Área relatada: {request.problemName}</span>}
        <span>Dias sugeridos: {request.preferredDates}</span>
      </div>

      {mode === "idle" && (
        <div className={styles.approvalActions}>
          <button className={styles.btnApprove} onClick={() => setMode("accept")}>
            Aceitar
          </button>
          <button className={styles.btnReject} onClick={() => setMode("decline")}>
            Recusar
          </button>
        </div>
      )}

      {mode === "accept" && (
        <form className={styles.miniForm} onSubmit={confirmAccept}>
          <label>
            Data e horário para o cliente levar o veículo
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
          </label>
          <label>
            Valor inicial para o agendamento (opcional)
            <input type="number" min="0" step="0.01" value={initialValue} onChange={(e) => setInitialValue(e.target.value)} />
          </label>
          <div className={styles.approvalActions}>
            <button className={styles.btnApprove} type="submit" disabled={busy || !scheduledAt}>
              {busy ? "Confirmando..." : "Confirmar aceite"}
            </button>
            <button className={styles.btnReject} type="button" onClick={() => setMode("idle")} disabled={busy}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {mode === "decline" && (
        <form className={styles.miniForm} onSubmit={confirmDecline}>
          <label>
            Motivo (opcional, visível para o cliente)
            <textarea value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} rows={2} />
          </label>
          <div className={styles.approvalActions}>
            <button className={styles.btnReject} type="submit" disabled={busy}>
              {busy ? "Recusando..." : "Confirmar recusa"}
            </button>
            <button className={styles.btnReject} type="button" onClick={() => setMode("idle")} disabled={busy}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
