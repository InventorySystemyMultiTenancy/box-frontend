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
          <g filter="url(#greenGlow)" stroke="#b6ff24" strokeLinecap="round" strokeLinejoin="round">
            <path
              d="M86 478 C66 446 58 391 59 322 L62 161 C64 91 91 43 150 31 C209 43 236 91 238 161 L241 322 C242 391 234 446 214 478 C193 493 107 493 86 478 Z"
              fill="url(#xrayGreen)"
              strokeOpacity="0.88"
              strokeWidth="1.9"
            />
            <path d="M82 92 C103 55 128 43 150 40 C172 43 197 55 218 92" fill="none" strokeOpacity="0.65" strokeWidth="1.1" />
            <path d="M69 438 C94 470 206 470 231 438" fill="none" strokeOpacity="0.65" strokeWidth="1.1" />
            <path d="M75 160 L225 160 M70 342 L230 342 M82 414 L218 414" fill="none" strokeOpacity="0.5" strokeWidth="1" />

            <path d="M105 92 L195 92 L213 156 L190 205 L110 205 L87 156 Z" fill="url(#wireGrid)" strokeOpacity="0.8" strokeWidth="1.4" />
            <path d="M99 219 L139 205 L161 205 L201 219 L212 323 L176 355 L124 355 L88 323 Z" fill="url(#wireGrid)" strokeOpacity="0.65" strokeWidth="1.2" />
            <path d="M108 232 L138 222 L138 292 L106 300 Z M162 222 L192 232 L194 300 L162 292 Z" fill="none" strokeOpacity="0.55" strokeWidth="1" />
            <path d="M104 322 L136 310 L136 378 L103 389 Z M164 310 L196 322 L197 389 L164 378 Z" fill="none" strokeOpacity="0.55" strokeWidth="1" />
            <path d="M118 118 L182 118 M116 141 L184 141 M150 96 L150 430" fill="none" strokeOpacity="0.45" strokeDasharray="4 6" strokeWidth="1" />
            <path d="M92 186 C110 173 128 168 150 168 C172 168 190 173 208 186" fill="none" strokeOpacity="0.42" strokeWidth="1" />
            <path d="M95 401 L205 401 L215 445 L85 445 Z" fill="url(#wireGrid)" strokeOpacity="0.55" strokeWidth="1.2" />

            <rect x="37" y="133" width="28" height="86" rx="14" fill="none" strokeOpacity="0.82" strokeWidth="2" />
            <rect x="235" y="133" width="28" height="86" rx="14" fill="none" strokeOpacity="0.82" strokeWidth="2" />
            <rect x="37" y="320" width="28" height="90" rx="14" fill="none" strokeOpacity="0.88" strokeWidth="2" />
            <rect x="235" y="320" width="28" height="90" rx="14" fill="none" strokeOpacity="0.88" strokeWidth="2" />
            <rect x="46" y="146" width="10" height="60" rx="5" fill="none" strokeOpacity="0.45" strokeWidth="0.9" />
            <rect x="244" y="146" width="10" height="60" rx="5" fill="none" strokeOpacity="0.45" strokeWidth="0.9" />
            <rect x="46" y="334" width="10" height="62" rx="5" fill="none" strokeOpacity="0.45" strokeWidth="0.9" />
            <rect x="244" y="334" width="10" height="62" rx="5" fill="none" strokeOpacity="0.45" strokeWidth="0.9" />

            <path d="M65 176 L235 176 M65 365 L235 365" fill="none" strokeOpacity="0.42" strokeWidth="1.4" />
            <path d="M92 132 C120 120 180 120 208 132 M94 438 C121 454 179 454 206 438" fill="none" strokeOpacity="0.55" strokeWidth="1" />
            <path d="M76 181 C95 199 205 199 224 181 M78 368 C101 386 199 386 222 368" fill="none" strokeOpacity="0.32" strokeWidth="0.9" />
            {Array.from({ length: 9 }).map((_, i) => (
              <path
                key={`rib-${i}`}
                d={`M${82 + i * 17} 78 C${90 + i * 13} 122 ${90 + i * 13} 405 ${82 + i * 17} 459`}
                fill="none"
                strokeOpacity="0.24"
                strokeWidth="0.45"
              />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <path
                key={`cross-${i}`}
                d={`M70 ${105 + i * 29} C111 ${97 + i * 29} 189 ${97 + i * 29} 230 ${105 + i * 29}`}
                fill="none"
                strokeOpacity="0.24"
                strokeWidth="0.45"
              />
            ))}
          </g>

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
