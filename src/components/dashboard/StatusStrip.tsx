import { STATUS_LABELS, STATUS_TONE, ServiceOrderStatus } from "@/lib/types";
import styles from "./dashboard.module.css";

/** Mostra só a etapa atual do projeto — não a lista inteira de status possíveis. */
export default function StatusStrip({ current }: { current: ServiceOrderStatus }) {
  return (
    <div className={styles.statusStrip}>
      <span className={`${styles.badge} ${styles.badgeCurrent} ${styles[`tone-${STATUS_TONE[current]}`]}`}>
        <i className={styles.dot} />
        {STATUS_LABELS[current]}
      </span>
    </div>
  );
}
