"use client";

import { useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import { Approval, PART_STATUS_LABELS, PART_STATUS_TONE, VehiclePart } from "@/lib/types";
import styles from "./dashboard.module.css";

const HOTSPOT_POSITIONS: Record<string, { x: number; y: number }> = {
  motor: { x: 150, y: 118 },
  arrefecimento: { x: 150, y: 76 },
  bateria: { x: 96, y: 124 },
  eletrica: { x: 204, y: 134 },
  arcondicionado: { x: 150, y: 180 },
  direcao: { x: 104, y: 208 },
  freios: { x: 78, y: 164 },
  suspensao: { x: 222, y: 338 },
  transmissao: { x: 150, y: 266 },
  escapamento: { x: 150, y: 442 },
  pneus: { x: 58, y: 360 },
  combustivel: { x: 212, y: 398 },
  carroceria: { x: 150, y: 300 },
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

  if (/dianteir|frente|capo|radiador|parachoque dianteiro/.test(text)) pos.y = Math.min(pos.y, 132);
  if (/traseir|atras|porta malas|tanque|parachoque traseiro/.test(text)) pos.y = Math.max(pos.y, 392);
  if (/esquerd|motorista/.test(text)) pos.x = Math.min(pos.x, 86);
  if (/direit|passageiro/.test(text)) pos.x = Math.max(pos.x, 214);

  if (/vidro|para-brisa|parabrisa/.test(text)) {
    pos.x = /lateral|porta|esquerd|direit|motorista|passageiro/.test(text) ? (/direit|passageiro/.test(text) ? 222 : 78) : 150;
    pos.y = /traseir|atras/.test(text) ? 408 : /lateral|porta/.test(text) ? 250 : 154;
  }

  if (/roda|pneu/.test(text)) {
    pos.x = /direit|passageiro/.test(text) ? 249 : 51;
    pos.y = /dianteir|frente/.test(text) ? 176 : 364;
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
  const [referenceImageOk, setReferenceImageOk] = useState(true);
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
        <svg viewBox="0 0 300 520" role="group" aria-label="Modelo raio-x do veiculo visto de cima com pontos de manutencao">
          <defs>
            <linearGradient id="xrayGreen" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#c8ff2f" stopOpacity="0.3" />
              <stop offset="48%" stopColor="#86f300" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#c8ff2f" stopOpacity="0.2" />
            </linearGradient>
            <filter id="greenGlow" x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <pattern id="wireGrid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#b6ff24" strokeOpacity="0.18" strokeWidth="0.7" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="300" height="520" fill="transparent" />
          {referenceImageOk ? (
            <image
              href="/vehicle-xray-top.jpeg"
              x="22"
              y="10"
              width="256"
              height="500"
              preserveAspectRatio="xMidYMid meet"
              onError={() => setReferenceImageOk(false)}
            />
          ) : (
            <g filter="url(#greenGlow)" stroke="#b6ff24" strokeLinecap="round" strokeLinejoin="round">
              <path
                d="M78 456 C68 423 65 377 67 318 L70 150 C72 97 94 62 128 48 L172 48 C206 62 228 97 230 150 L233 318 C235 377 232 423 222 456 C207 476 93 476 78 456 Z"
                fill="url(#xrayGreen)"
                strokeOpacity="0.9"
                strokeWidth="2"
              />
              <path d="M92 78 C111 57 128 51 150 51 C172 51 189 57 208 78" fill="none" strokeOpacity="0.72" strokeWidth="1.2" />
              <path d="M76 430 C102 462 198 462 224 430" fill="none" strokeOpacity="0.72" strokeWidth="1.2" />
              <path d="M70 154 L230 154 M68 317 L232 317 M77 405 L223 405" fill="none" strokeOpacity="0.58" strokeWidth="1.1" />

              <path d="M104 88 L196 88 L215 150 L193 199 L107 199 L85 150 Z" fill="url(#wireGrid)" strokeOpacity="0.85" strokeWidth="1.5" />
              <path d="M93 218 L119 201 L181 201 L207 218 L218 309 L184 340 L116 340 L82 309 Z" fill="url(#wireGrid)" strokeOpacity="0.68" strokeWidth="1.25" />
              <path d="M100 228 L137 215 L137 291 L98 303 Z M163 215 L200 228 L202 303 L163 291 Z" fill="none" strokeOpacity="0.58" strokeWidth="1" />
              <path d="M101 324 L137 311 L137 379 L99 391 Z M163 311 L199 324 L201 391 L163 379 Z" fill="none" strokeOpacity="0.58" strokeWidth="1" />
              <path d="M91 398 L209 398 L220 439 L80 439 Z" fill="url(#wireGrid)" strokeOpacity="0.6" strokeWidth="1.2" />
              <path d="M112 116 L188 116 M111 139 L189 139 M150 82 L150 442" fill="none" strokeOpacity="0.45" strokeDasharray="4 6" strokeWidth="1" />
              <path d="M88 184 C107 171 128 166 150 166 C172 166 193 171 212 184" fill="none" strokeOpacity="0.44" strokeWidth="1" />

              <rect x="30" y="132" width="31" height="91" rx="13" fill="none" strokeOpacity="0.88" strokeWidth="2.2" />
              <rect x="239" y="132" width="31" height="91" rx="13" fill="none" strokeOpacity="0.88" strokeWidth="2.2" />
              <rect x="30" y="319" width="31" height="94" rx="13" fill="none" strokeOpacity="0.9" strokeWidth="2.2" />
              <rect x="239" y="319" width="31" height="94" rx="13" fill="none" strokeOpacity="0.9" strokeWidth="2.2" />
              <rect x="40" y="147" width="11" height="61" rx="5" fill="none" strokeOpacity="0.48" strokeWidth="0.9" />
              <rect x="249" y="147" width="11" height="61" rx="5" fill="none" strokeOpacity="0.48" strokeWidth="0.9" />
              <rect x="40" y="334" width="11" height="64" rx="5" fill="none" strokeOpacity="0.48" strokeWidth="0.9" />
              <rect x="249" y="334" width="11" height="64" rx="5" fill="none" strokeOpacity="0.48" strokeWidth="0.9" />

              <path d="M61 176 L239 176 M61 364 L239 364" fill="none" strokeOpacity="0.45" strokeWidth="1.5" />
              <path d="M91 131 C119 119 181 119 209 131 M90 430 C119 446 181 446 210 430" fill="none" strokeOpacity="0.58" strokeWidth="1" />
              <path d="M75 181 C96 199 204 199 225 181 M75 368 C99 386 201 386 225 368" fill="none" strokeOpacity="0.34" strokeWidth="0.9" />
              <path d="M70 253 L230 253 M76 282 L224 282" fill="none" strokeOpacity="0.28" strokeWidth="0.8" />
              {Array.from({ length: 9 }).map((_, i) => (
                <path
                  key={`rib-${i}`}
                  d={`M${80 + i * 17.5} 75 C${88 + i * 13.8} 125 ${88 + i * 13.8} 405 ${80 + i * 17.5} 457`}
                  fill="none"
                  strokeOpacity="0.24"
                  strokeWidth="0.45"
                />
              ))}
              {Array.from({ length: 12 }).map((_, i) => (
                <path
                  key={`cross-${i}`}
                  d={`M70 ${104 + i * 29} C112 ${96 + i * 29} 188 ${96 + i * 29} 230 ${104 + i * 29}`}
                  fill="none"
                  strokeOpacity="0.24"
                  strokeWidth="0.45"
                />
              ))}
            </g>
          )}

          {withPosition.map((part) => {
            const pos = positionForPart(part);
            const isActive = part.id === active?.id;
            const tone = PART_STATUS_TONE[part.status];
            const fill = isActive ? "#b6ff24" : tone === "crit" ? "var(--critical)" : tone === "warn" ? "var(--warning)" : "var(--accent-cobre)";
            return (
              <g key={part.id}>
                {isActive && <circle cx={pos.x} cy={pos.y} r={14} fill="none" stroke="#b6ff24" strokeWidth={1.6} opacity={0.55} />}
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
