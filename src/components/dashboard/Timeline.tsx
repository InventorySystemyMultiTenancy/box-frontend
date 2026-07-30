import { TimelineEvent } from "@/lib/types";
import styles from "./dashboard.module.css";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function Timeline({
  events,
  justArrivedId,
  canViewPrices = true,
}: {
  events: TimelineEvent[];
  justArrivedId?: string | null;
  canViewPrices?: boolean;
}) {
  if (events.length === 0) {
    return <p className={styles.tlSub}>Nenhum evento registrado ainda.</p>;
  }
  return (
    <div className={styles.timeline}>
      {events.map((event) => (
        <div
          key={event.id}
          className={`${styles.tlItem} ${event.done ? styles.done : ""} ${
            event.id === justArrivedId ? styles.entering : ""
          }`}
        >
          <div className={styles.tlTime}>{formatTime(event.occurredAt)}</div>
          <div className={styles.tlText}>{event.title}</div>
          {event.description && (canViewPrices || !/R\$|valor/i.test(event.description)) && <div className={styles.tlSub}>{event.description}</div>}
        </div>
      ))}
    </div>
  );
}
