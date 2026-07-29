"use client";

import { useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import { Approval, PART_STATUS_LABELS, PART_STATUS_TONE, VehiclePart } from "@/lib/types";
import styles from "./dashboard.module.css";

const HOTSPOT_POSITIONS: Record<string, { x: number; y: number }> = {
  motor: { x: 320, y: 118 },
  arrefecimento: { x: 358, y: 120 },
  bateria: { x: 302, y: 92 },
  eletrica: { x: 242, y: 94 },
  arcondicionado: { x: 278, y: 138 },
  direcao: { x: 218, y: 116 },
  freios: { x: 154, y: 160 },
  suspensao: { x: 160, y: 190 },
  transmissao: { x: 244, y: 158 },
  escapamento: { x: 214, y: 214 },
  pneus: { x: 128, y: 204 },
  combustivel: { x: 274, y: 212 },
  carroceria: { x: 246, y: 176 },
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

  if (/dianteir|frente|capo|radiador|parachoque dianteiro/.test(text)) pos.x = Math.max(pos.x, 318);
  if (/traseir|atras|porta malas|tanque|parachoque traseiro/.test(text)) pos.x = Math.min(pos.x, 124);
  if (/esquerd|motorista/.test(text)) pos.y = Math.min(pos.y, 104);
  if (/direit|passageiro/.test(text)) pos.y = Math.max(pos.y, 206);

  if (/vidro|para-brisa|parabrisa/.test(text)) {
    pos.x = /traseir|atras/.test(text) ? 170 : 252;
    pos.y = /lateral|porta/.test(text) ? (/direit|passageiro/.test(text) ? 194 : 102) : 138;
  }

  if (/roda|pneu/.test(text)) {
    pos.x = /traseir|atras/.test(text) ? 116 : 346;
    pos.y = /direit|passageiro/.test(text) ? 218 : 88;
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
        <svg viewBox="0 0 520 300" role="group" aria-label="Modelo wireframe do veículo com pontos de manutenção">
          <defs>
            <linearGradient id="xrayBody" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#48d7ff" stopOpacity="0.24" />
              <stop offset="55%" stopColor="#178ca7" stopOpacity="0.11" />
              <stop offset="100%" stopColor="#48d7ff" stopOpacity="0.06" />
            </linearGradient>
            <filter id="cyanGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g filter="url(#cyanGlow)" stroke="#4bd6ff" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M58 205 C74 128 116 83 189 67 L306 57 C382 52 452 88 479 150 C492 181 480 211 444 227 L314 246 C225 258 134 250 82 226 C64 218 56 214 58 205 Z"
              fill="url(#xrayBody)"
              strokeOpacity="0.82"
              strokeWidth="1.7"
            />
            <path d="M104 169 C136 105 180 82 260 78 L334 79 C377 83 417 107 439 148" fill="none" strokeOpacity="0.45" strokeWidth="1.2" />
            <path d="M86 216 C172 238 277 240 417 216" fill="none" strokeOpacity="0.4" strokeWidth="1.1" />
            <path d="M154 111 L231 90 L324 92 L382 128 L344 179 L215 190 L146 155 Z" fill="none" strokeOpacity="0.55" strokeWidth="1.4" />
            <path d="M202 116 L252 100 L315 103 L349 130 L322 162 L235 169 L182 148 Z" fill="#29c7df" fillOpacity="0.1" strokeOpacity="0.45" strokeWidth="1.1" />
            <path d="M110 194 L203 204 L310 201 L427 181" fill="none" strokeOpacity="0.35" strokeWidth="1.1" />
            <path d="M122 139 L194 158 L343 150 L437 121" fill="none" strokeOpacity="0.35" strokeWidth="1.1" />

            <ellipse cx="106" cy="104" rx="30" ry="42" transform="rotate(-17 106 104)" fill="none" strokeOpacity="0.8" strokeWidth="2" />
            <ellipse cx="378" cy="86" rx="30" ry="42" transform="rotate(-76 378 86)" fill="none" strokeOpacity="0.75" strokeWidth="2" />
            <ellipse cx="132" cy="223" rx="33" ry="47" transform="rotate(-70 132 223)" fill="none" strokeOpacity="0.85" strokeWidth="2.2" />
            <ellipse cx="405" cy="205" rx="32" ry="46" transform="rotate(-77 405 205)" fill="none" strokeOpacity="0.85" strokeWidth="2.2" />
            <ellipse cx="106" cy="104" rx="17" ry="26" transform="rotate(-17 106 104)" fill="none" strokeOpacity="0.35" strokeWidth="1" />
            <ellipse cx="378" cy="86" rx="16" ry="24" transform="rotate(-76 378 86)" fill="none" strokeOpacity="0.35" strokeWidth="1" />
            <ellipse cx="132" cy="223" rx="18" ry="28" transform="rotate(-70 132 223)" fill="none" strokeOpacity="0.35" strokeWidth="1" />
            <ellipse cx="405" cy="205" rx="18" ry="28" transform="rotate(-77 405 205)" fill="none" strokeOpacity="0.35" strokeWidth="1" />

            <path d="M125 107 L192 125 M158 219 L242 186 M348 92 L321 127 M378 206 L324 179" fill="none" strokeOpacity="0.32" strokeWidth="1.4" />
            <path d="M283 94 C288 118 287 143 279 168 M231 102 C236 126 236 153 229 181" fill="none" strokeOpacity="0.32" strokeWidth="1" />
            <path d="M294 118 L332 137 M287 151 L324 165 M188 132 L221 145" fill="none" strokeOpacity="0.3" strokeWidth="1" />
            <path d="M316 104 C352 112 385 130 425 157 M299 180 C340 182 382 175 432 157" fill="none" strokeOpacity="0.28" strokeWidth="1" />
          </g>

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
