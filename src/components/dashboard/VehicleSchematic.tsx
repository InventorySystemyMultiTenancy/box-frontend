"use client";

import { useMemo, useState } from "react";
import { PART_STATUS_LABELS, PART_STATUS_TONE, VehiclePart } from "@/lib/types";
import styles from "./dashboard.module.css";

// Mesmas coordenadas esquemáticas descritas na especificação de experiência —
// só os componentes que a ordem de serviço realmente possui viram um ponto clicável.
const HOTSPOT_POSITIONS: Record<string, { x: number; y: number }> = {
  motor: { x: 120, y: 70 },
  eletrica: { x: 85, y: 66 },
  arcondicionado: { x: 170, y: 58 },
  transmissao: { x: 205, y: 98 },
  escapamento: { x: 340, y: 103 },
  freios: { x: 98, y: 120 },
  suspensao: { x: 300, y: 139 },
  direcao: { x: 150, y: 90 },
  pneus: { x: 98, y: 140 },
  bateria: { x: 70, y: 60 },
  arrefecimento: { x: 135, y: 65 },
  combustivel: { x: 260, y: 100 },
  carroceria: { x: 200, y: 55 },
};

export default function VehicleSchematic({ parts }: { parts: VehiclePart[] }) {
  const withPosition = useMemo(() => parts.filter((p) => HOTSPOT_POSITIONS[p.key]), [parts]);

  const priorityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, IN_PROGRESS: 2, DONE: 3, NOT_INSPECTED: 4 };
  const defaultPart = [...withPosition].sort((a, b) => priorityOrder[a.status] - priorityOrder[b.status])[0];

  const [activeId, setActiveId] = useState<string | undefined>(defaultPart?.id);
  const active = withPosition.find((p) => p.id === activeId) ?? defaultPart;

  if (withPosition.length === 0) {
    return <p className={styles.tlSub}>Nenhum componente inspecionado ainda.</p>;
  }

  return (
    <div>
      <div className={styles.carWrap}>
        <svg viewBox="0 0 400 170" role="group" aria-label="Diagrama esquemático do veículo com pontos de manutenção">
          <path
            d="M30,118 L30,96 Q30,88 40,85 L75,85 L102,54 Q107,49 114,49 L224,49 Q231,49 236,54 L263,85 L358,85 Q368,85 368,96 L368,118 Z"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth={1.5}
          />
          <circle cx={98} cy={120} r={21} fill="var(--bg)" stroke="var(--text-muted)" strokeWidth={1.5} />
          <circle cx={300} cy={120} r={21} fill="var(--bg)" stroke="var(--text-muted)" strokeWidth={1.5} />
          <circle cx={98} cy={120} r={9} fill="none" stroke="var(--border-strong)" strokeWidth={1.5} />
          <circle cx={300} cy={120} r={9} fill="none" stroke="var(--border-strong)" strokeWidth={1.5} />

          {withPosition.map((part) => {
            const pos = HOTSPOT_POSITIONS[part.key];
            const isActive = part.id === active?.id;
            return (
              <g key={part.id}>
                {isActive && (
                  <circle cx={pos.x} cy={pos.y} r={12} fill="none" stroke="var(--accent-cian)" strokeWidth={1.5} opacity={0.5} />
                )}
                <circle
                  className={styles.hotspot}
                  cx={pos.x}
                  cy={pos.y}
                  r={isActive ? 8 : 6.5}
                  fill={isActive ? "var(--accent-cian)" : "var(--accent-cobre)"}
                  tabIndex={0}
                  role="button"
                  aria-label={part.name}
                  onClick={() => setActiveId(part.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActiveId(part.id);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {active && (
        <div className={styles.partPanel}>
          <div className={styles.partPanelHead}>
            <h3>{active.name}</h3>
            <span className={`${styles.badge} ${styles[`tone-${PART_STATUS_TONE[active.status]}`]}`}>
              <i className={styles.dot} />
              {PART_STATUS_LABELS[active.status]}
            </span>
          </div>
          {active.note && <div className={styles.partNote}>{active.note}</div>}
          <div className={styles.partMeta}>
            <span>Atualizado {new Date(active.updatedAt).toLocaleString("pt-BR")}</span>
            {active.responsible && <span>Responsável: {active.responsible.name}</span>}
            {active.warranty && <span>Garantia: {active.warranty}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
