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
}: {
  approval: Approval;
  onRespond: (status: "APPROVED" | "REJECTED", responseNote?: string) => Promise<void>;
  canRespond?: boolean;
  canViewPrices?: boolean;
}) {
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [responseNote, setResponseNote] = useState("");

  async function respond(status: "APPROVED" | "REJECTED") {
    if (status === "REJECTED" && !responseNote.trim()) return;
    setBusy(status);
    try {
      await onRespond(status, status === "REJECTED" ? responseNote : undefined);
    } finally {
      setBusy(null);
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
            className={`${styles.badge} ${approval.status === "APPROVED" ? styles["tone-ok"] : styles["tone-crit"]} ${
              styles.resolvedTag
            }`}
          >
            <i className={styles.dot} />
            {approval.status === "APPROVED" ? "Aprovado" : "Reprovado"}
          </span>
          {approval.responseNote && <p className={styles.responseNote}>{approval.responseNote}</p>}
        </>
      )}
    </div>
  );
}
