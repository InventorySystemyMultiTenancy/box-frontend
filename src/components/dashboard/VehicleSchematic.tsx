"use client";

import { useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import { Approval, PART_STATUS_LABELS, PART_STATUS_TONE, VehiclePart } from "@/lib/types";
import styles from "./dashboard.module.css";

const HOTSPOT_POSITIONS: Record<string, { x: number; y: number }> = {
  motor: { x: 200, y: 58 },
  arrefecimento: { x: 200, y: 42 },
  bateria: { x: 148, y: 54 },
  eletrica: { x: 252, y: 74 },
  arcondicionado: { x: 200, y: 92 },
  direcao: { x: 156, y: 104 },
  freios: { x: 126, y: 104 },
  suspensao: { x: 274, y: 126 },
  transmissao: { x: 200, y: 128 },
  escapamento: { x: 200, y: 206 },
  pneus: { x: 86, y: 82 },
  combustivel: { x: 254, y: 182 },
  carroceria: { x: 200, y: 154 },
};

const UNRESOLVED_STATUSES = new Set(["CRITICAL", "WARNING", "IN_PROGRESS"]);

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function positionForPart(part: VehiclePart) {
  const base = HOTSPOT_POSITIONS[part.key] ?? HOTSPOT_POSITIONS.carroceria;
  const text = normalize(`${part.name} ${part.note ?? ""}`);
  const pos = { ...base };

  if (/dianteir|frente|capo|radiador|parachoque dianteiro/.test(text)) pos.y = Math.min(pos.y, 82);
  if (/traseir|atras|porta malas|tanque|parachoque traseiro/.test(text)) pos.y = Math.max(pos.y, 190);
  if (/esquerd|motorista/.test(text)) pos.x = Math.min(pos.x, 126);
  if (/direit|passageiro/.test(text)) pos.x = Math.max(pos.x, 274);
  if (/vidro|para-brisa|parabrisa/.test(text)) {
    pos.x = /lateral|porta/.test(text) ? (/direit|passageiro/.test(text) ? 274 : 126) : 200;
    pos.y = /traseir|atras/.test(text) ? 174 : 104;
  }
  if (/roda|pneu/.test(text)) {
    pos.x = /direit|passageiro/.test(text) ? 314 : 86;
    pos.y = /traseir|atras/.test(text) ? 196 : 82;
  }

  return pos;
}

export default function VehicleSchematic({
  parts,
  approvals = [],
  canRespond = false,
  onRespondApproval,
  canResolve = false,
  onResolvePart,
}: {
  parts: VehiclePart[];
  approvals?: Approval[];
  canRespond?: boolean;
  onRespondApproval?: (approvalId: string, status: "APPROVED" | "REJECTED", responseNote?: string) => Promise<void>;
  canResolve?: boolean;
  onResolvePart?: (partId: string) => Promise<void>;
}) {
  const withPosition = useMemo(() => parts.filter((p) => HOTSPOT_POSITIONS[p.key]), [parts]);

  const priorityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, IN_PROGRESS: 2, DONE: 3, NOT_INSPECTED: 4 };
  const defaultPart = [...withPosition].sort((a, b) => priorityOrder[a.status] - priorityOrder[b.status])[0];

  const [activeId, setActiveId] = useState<string | undefined>(defaultPart?.id);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [resolving, setResolving] = useState(false);
  const active = withPosition.find((p) => p.id === activeId) ?? defaultPart;

  const activeMediaIds = new Set(active?.media.map((media) => media.id) ?? []);
  const activeApproval = approvals.find((approval) =>
    active ? approval.partId === active.id || approval.media.some((media) => activeMediaIds.has(media.id)) : false
  );

  async function respond(status: "APPROVED" | "REJECTED") {
    if (!activeApproval || !onRespondApproval) return;
    if (status === "REJECTED" && !rejectNote.trim()) return;
    setBusy(status);
    try {
      await onRespondApproval(activeApproval.id, status, status === "REJECTED" ? rejectNote : undefined);
      setRejectNote("");
    } finally {
      setBusy(null);
    }
  }

  async function resolve() {
    if (!active || !onResolvePart) return;
    setResolving(true);
    try {
      await onResolvePart(active.id);
    } finally {
      setResolving(false);
    }
  }

  if (withPosition.length === 0) {
    return <p className={styles.tlSub}>Nenhum componente inspecionado ainda.</p>;
  }

  return (
    <div>
      <div className={styles.carWrap}>
        <svg viewBox="0 0 400 260" role="group" aria-label="Visão superior cirúrgica do veículo com pontos de manutenção">
          <defs>
            <linearGradient id="glass" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-cian)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent-cian)" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          <rect x="92" y="46" width="216" height="174" rx="46" fill="var(--bg-elevated)" stroke="var(--border-strong)" strokeWidth="1.5" />
          <path d="M138 46 Q200 18 262 46" fill="none" stroke="var(--border-strong)" strokeWidth="1.4" />
          <path d="M122 218 Q200 242 278 218" fill="none" stroke="var(--border-strong)" strokeWidth="1.4" />

          <rect x="104" y="66" width="34" height="52" rx="12" fill="var(--bg)" stroke="var(--border-strong)" />
          <rect x="262" y="66" width="34" height="52" rx="12" fill="var(--bg)" stroke="var(--border-strong)" />
          <rect x="104" y="158" width="34" height="52" rx="12" fill="var(--bg)" stroke="var(--border-strong)" />
          <rect x="262" y="158" width="34" height="52" rx="12" fill="var(--bg)" stroke="var(--border-strong)" />

          <line x1="121" y1="92" x2="279" y2="92" stroke="var(--border)" strokeWidth="5" />
          <line x1="121" y1="184" x2="279" y2="184" stroke="var(--border)" strokeWidth="5" />
          <line x1="200" y1="58" x2="200" y2="208" stroke="var(--border-strong)" strokeWidth="2" strokeDasharray="5 5" />

          <path d="M150 86 L250 86 L268 122 L250 160 L150 160 L132 122 Z" fill="url(#glass)" stroke="var(--accent-cian)" strokeOpacity="0.45" />
          <path d="M160 94 L240 94 L250 122 L240 150 L160 150 L150 122 Z" fill="none" stroke="var(--border)" />
          <line x1="150" y1="122" x2="250" y2="122" stroke="var(--border)" />

          <rect x="158" y="38" width="84" height="42" rx="16" fill="none" stroke="var(--accent-cobre)" strokeOpacity="0.55" />
          <circle cx="178" cy="58" r="10" fill="none" stroke="var(--border-strong)" />
          <circle cx="222" cy="58" r="10" fill="none" stroke="var(--border-strong)" />
          <path d="M168 196 Q200 210 232 196" fill="none" stroke="var(--accent-cobre)" strokeOpacity="0.55" strokeWidth="2" />
          <circle cx="200" cy="205" r="11" fill="none" stroke="var(--border-strong)" />

          <path d="M126 88 L148 72 M274 88 L252 72 M126 184 L148 198 M274 184 L252 198" stroke="var(--border-strong)" strokeWidth="1.5" />
          <path d="M186 78 L214 78 M184 170 L216 170 M190 78 L190 170 M210 78 L210 170" stroke="var(--grid-line)" strokeWidth="1.3" />

          {withPosition.map((part) => {
            const pos = positionForPart(part);
            const isActive = part.id === active?.id;
            const tone = PART_STATUS_TONE[part.status];
            const fill = isActive ? "var(--accent-cian)" : tone === "crit" ? "var(--critical)" : tone === "warn" ? "var(--warning)" : "var(--accent-cobre)";
            return (
              <g key={part.id}>
                {isActive && <circle cx={pos.x} cy={pos.y} r={14} fill="none" stroke="var(--accent-cian)" strokeWidth={1.6} opacity={0.55} />}
                <circle
                  className={styles.hotspot}
                  cx={pos.x}
                  cy={pos.y}
                  r={isActive ? 8.5 : 7}
                  fill={fill}
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
          {active.media.length > 0 && (
            <div className={styles.mediaGrid}>
              {active.media.map((media) =>
                media.type === "PHOTO" ? (
                  <a key={media.id} href={mediaUrl(media.url)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(media.url)} alt={media.label ?? active.name} />
                  </a>
                ) : (
                  <a key={media.id} href={mediaUrl(media.url)} target="_blank" rel="noreferrer">
                    {media.label ?? "Arquivo anexado"}
                  </a>
                )
              )}
            </div>
          )}
          {activeApproval && (
            <div className={styles.problemApproval}>
              <div className={styles.problemApprovalHead}>
                <strong>{activeApproval.title}</strong>
                <span
                  className={`${styles.badge} ${
                    activeApproval.status === "APPROVED"
                      ? styles["tone-ok"]
                      : activeApproval.status === "REJECTED"
                        ? styles["tone-crit"]
                        : styles["tone-warn"]
                  }`}
                >
                  <i className={styles.dot} />
                  {activeApproval.status === "APPROVED" ? "Aprovado" : activeApproval.status === "REJECTED" ? "Reprovado" : "Pendente"}
                </span>
              </div>
              <p>{activeApproval.description}</p>
              {activeApproval.partUsages && activeApproval.partUsages.length > 0 && (
                <div className={styles.partUsageList}>
                  {activeApproval.partUsages.map((usage) => (
                    <span key={usage.id}>
                      {usage.quantity}x {usage.inventoryPart.name}
                    </span>
                  ))}
                </div>
              )}
              {activeApproval.laborValue != null && <div className={styles.value}>Mão de obra: R$ {activeApproval.laborValue.toFixed(2)}</div>}
              {activeApproval.partsValue != null && <div className={styles.value}>Peças: R$ {activeApproval.partsValue.toFixed(2)}</div>}
              {activeApproval.estimatedValue != null && <div className={styles.value}>R$ {activeApproval.estimatedValue.toFixed(2)}</div>}
              {activeApproval.responseNote && <p className={styles.responseNote}>{activeApproval.responseNote}</p>}
              {canRespond && activeApproval.status === "PENDING" && activeApproval.estimatedValue != null && (
                <>
                  <textarea
                    className={styles.rejectReason}
                    placeholder="Motivo da reprovação, se for recusar"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                  <div className={styles.approvalActions}>
                    <button className={styles.btnApprove} disabled={busy !== null} onClick={() => respond("APPROVED")}>
                      {busy === "APPROVED" ? "Aprovando..." : "Aprovar serviço"}
                    </button>
                    <button className={styles.btnReject} disabled={busy !== null || !rejectNote.trim()} onClick={() => respond("REJECTED")}>
                      {busy === "REJECTED" ? "Reprovando..." : "Reprovar"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {canResolve && UNRESOLVED_STATUSES.has(active.status) && (
            <div className={styles.approvalActions}>
              <button className={styles.btnApprove} disabled={resolving} onClick={resolve}>
                {resolving ? "Marcando..." : "Marcar problema como resolvido"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
