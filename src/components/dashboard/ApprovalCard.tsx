"use client";

import { useState } from "react";
import { Approval } from "@/lib/types";
import { API_URL } from "@/lib/api";
import styles from "./dashboard.module.css";

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

export default function ApprovalCard({
  approval,
  onRespond,
  canRespond = true,
  canViewPrices = true,
  canForceResolve = false,
  onForceResolve,
}: {
  approval: Approval;
  onRespond: (status: "APPROVED" | "REJECTED", responseNote?: string) => Promise<void>;
  canRespond?: boolean;
  canViewPrices?: boolean;
  canForceResolve?: boolean;
  onForceResolve?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [responseNote, setResponseNote] = useState("");
  const [forcingResolve, setForcingResolve] = useState(false);

  async function respond(status: "APPROVED" | "REJECTED") {
    if (status === "REJECTED" && !responseNote.trim()) return;
    setBusy(status);
    try {
      await onRespond(status, status === "REJECTED" ? responseNote : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function forceResolve() {
    if (!onForceResolve) return;
    setForcingResolve(true);
    try {
      await onForceResolve();
    } finally {
      setForcingResolve(false);
    }
  }

  return (
    <div className={`${styles.panel} ${styles.approval}`}>
      <h2>Aprovação pendente</h2>
      <h3>{approval.title}</h3>
      <p>{approval.description}</p>
      {approval.media.length > 0 && (
        <div className={styles.mediaGrid}>
          {approval.media.map((media) =>
            media.type === "PHOTO" ? (
              <a key={media.id} href={mediaUrl(media.url)} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaUrl(media.url)} alt={media.label ?? approval.title} />
              </a>
            ) : (
              <a key={media.id} href={mediaUrl(media.url)} target="_blank" rel="noreferrer">
                {media.label ?? "Arquivo anexado"}
              </a>
            )
          )}
        </div>
      )}
      {canViewPrices && approval.estimatedValue != null && (
        <div className={styles.value}>Valor estimado: R$ {approval.estimatedValue.toFixed(2)}</div>
      )}
      {approval.note && (
        <div className={styles.partNote}>
          <strong>Observação do mecânico:</strong> {approval.note}
        </div>
      )}
      {canRespond && approval.status === "PENDING" ? (
        <>
          <textarea
            className={styles.rejectReason}
            placeholder="Motivo da reprovação, se for recusar"
            value={responseNote}
            onChange={(e) => setResponseNote(e.target.value)}
          />
          <div className={styles.approvalActions}>
            <button className={styles.btnApprove} disabled={busy !== null} onClick={() => respond("APPROVED")}>
              {busy === "APPROVED" ? "Aprovando..." : "Aprovar"}
            </button>
            <button className={styles.btnReject} disabled={busy !== null || !responseNote.trim()} onClick={() => respond("REJECTED")}>
              {busy === "REJECTED" ? "Recusando..." : "Reprovar"}
            </button>
          </div>
        </>
      ) : (
        <>
          <span
            className={`${styles.badge} ${
              approval.status === "APPROVED" ? styles["tone-ok"] : approval.status === "REJECTED" ? styles["tone-crit"] : styles["tone-warn"]
            } ${styles.resolvedTag}`}
          >
            <i className={styles.dot} />
            {approval.status === "APPROVED" ? "Aprovado" : approval.status === "REJECTED" ? "Reprovado" : "Aguardando resposta do cliente"}
          </span>
          {approval.responseNote && <p className={styles.responseNote}>{approval.responseNote}</p>}
          {canForceResolve && approval.status === "PENDING" && onForceResolve && (
            <div className={styles.approvalActions} style={{ marginTop: "0.6rem" }}>
              <button className={styles.btnApprove} disabled={forcingResolve} onClick={forceResolve}>
                {forcingResolve ? "Avançando..." : "Avançar mesmo sem aprovação do cliente"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
