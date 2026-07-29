"use client";

import { useState } from "react";
import { Approval } from "@/lib/types";
import styles from "./dashboard.module.css";

export default function ApprovalCard({
  approval,
  onRespond,
}: {
  approval: Approval;
  onRespond: (status: "APPROVED" | "REJECTED") => Promise<void>;
}) {
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);

  async function respond(status: "APPROVED" | "REJECTED") {
    setBusy(status);
    try {
      await onRespond(status);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={`${styles.panel} ${styles.approval}`}>
      <h2>Aprovação pendente</h2>
      <h3>{approval.title}</h3>
      <p>{approval.description}</p>
      {approval.estimatedValue != null && (
        <div className={styles.value}>Valor estimado: R$ {approval.estimatedValue.toFixed(2)}</div>
      )}
      {approval.status === "PENDING" ? (
        <div className={styles.approvalActions}>
          <button className={styles.btnApprove} disabled={busy !== null} onClick={() => respond("APPROVED")}>
            {busy === "APPROVED" ? "Aprovando..." : "Aprovar"}
          </button>
          <button className={styles.btnReject} disabled={busy !== null} onClick={() => respond("REJECTED")}>
            {busy === "REJECTED" ? "Recusando..." : "Recusar"}
          </button>
        </div>
      ) : (
        <span
          className={`${styles.badge} ${approval.status === "APPROVED" ? styles["tone-ok"] : styles["tone-crit"]} ${
            styles.resolvedTag
          }`}
        >
          <i className={styles.dot} />
          {approval.status === "APPROVED" ? "Aprovado" : "Recusado"}
        </span>
      )}
    </div>
  );
}
