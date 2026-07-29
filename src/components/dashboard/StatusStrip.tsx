import { SERVICE_ORDER_STATUSES, STATUS_LABELS, STATUS_TONE, ServiceOrderStatus } from "@/lib/types";
import styles from "./dashboard.module.css";

export default function StatusStrip({ current }: { current: ServiceOrderStatus }) {
  const currentIndex = SERVICE_ORDER_STATUSES.indexOf(current);
  return (
    <div className={styles.statusStrip}>
      {SERVICE_ORDER_STATUSES.map((status, i) => {
        const isCurrent = status === current;
        const isPast = i < currentIndex;
        return (
          <span
            key={status}
            className={`${styles.badge} ${styles[`tone-${STATUS_TONE[status]}`]} ${
              !isCurrent && !isPast ? styles.badgeInactive : ""
            }`}
          >
            <i className={styles.dot} />
            {STATUS_LABELS[status]}
          </span>
        );
      })}
    </div>
  );
}
