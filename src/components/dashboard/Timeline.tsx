import { TimelineEvent } from "@/lib/types";
import styles from "./dashboard.module.css";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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
          <div className={styles.tlTime}>
            {formatTime(event.occurredAt)}
            {/* Quem avançou a etapa / concluiu a manutenção / registrou o evento. */}
            {event.author?.name && ` · por ${event.author.name}`}
          </div>
          <div className={styles.tlText}>{event.title}</div>
          {event.description &&
            event.description !== `Observação: ${event.note}` &&
            (canViewPrices || !/R\$|valor/i.test(event.description)) && <div className={styles.tlSub}>{event.description}</div>}
          {/* Observação digitada ao avançar etapa / finalizar — sempre visível e destacada. */}
          {event.note && (
            <div className={styles.tlNote}>
              <strong>Observação:</strong> {event.note}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
