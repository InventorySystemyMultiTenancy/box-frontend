import { QuoteRequest } from "@/lib/types";
import styles from "./dashboard.module.css";

export default function QuoteRequestStatusCard({ request, onRetry }: { request: QuoteRequest; onRetry?: () => void }) {
  return (
    <div className={styles.panel}>
      <h2>Sua solicitação de orçamento</h2>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: "0.95rem" }}>
        {request.vehicle.brand} {request.vehicle.model} {request.vehicle.year}
      </h3>
      <p style={{ fontSize: "0.86rem", color: "var(--text-muted)", marginTop: "0.5rem" }}>{request.problemDescription}</p>
      <div className={styles.partMeta} style={{ marginTop: "0.7rem" }}>
        <span>Dias sugeridos: {request.preferredDates}</span>
        <span>Enviada em {new Date(request.createdAt).toLocaleString("pt-BR")}</span>
      </div>

      {request.status === "PENDING" && (
        <span className={`${styles.badge} ${styles["tone-warn"]} ${styles.resolvedTag}`}>
          <i className={styles.dot} />
          Aguardando resposta da oficina
        </span>
      )}

      {request.status === "ACCEPTED" && (
        <span className={`${styles.badge} ${styles["tone-ok"]} ${styles.resolvedTag}`}>
          <i className={styles.dot} />
          Aceita — carregando seu painel...
        </span>
      )}

      {request.status === "DECLINED" && (
        <>
          <span className={`${styles.badge} ${styles["tone-crit"]} ${styles.resolvedTag}`}>
            <i className={styles.dot} />
            Não foi possível aceitar desta vez
          </span>
          {request.declineReason && <p className={styles.responseNote}>{request.declineReason}</p>}
          {onRetry && (
            <div className={styles.approvalActions}>
              <button className={styles.btnApprove} onClick={onRetry}>
                Solicitar novamente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
