"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";
import { Approval, InventoryPart, PART_STATUS_LABELS, PART_STATUS_TONE, VehiclePart } from "@/lib/types";
import styles from "./dashboard.module.css";

const HOTSPOT_POSITIONS: Record<string, { x: number; y: number }> = {
  motor: { x: 150, y: 92 },
  arrefecimento: { x: 150, y: 58 },
  bateria: { x: 96, y: 116 },
  eletrica: { x: 204, y: 118 },
  arcondicionado: { x: 150, y: 180 },
  direcao: { x: 104, y: 208 },
  freios: { x: 51, y: 176 },
  suspensao: { x: 222, y: 338 },
  transmissao: { x: 150, y: 266 },
  escapamento: { x: 150, y: 442 },
  pneus: { x: 51, y: 364 },
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

  if (part.key === "motor") return { x: 150, y: 92 };

  if (/dianteir|frente|capo|radiador|parachoque dianteiro/.test(text)) pos.y = Math.min(pos.y, 132);
  if (/traseir|atras|porta malas|tanque|parachoque traseiro/.test(text)) pos.y = Math.max(pos.y, 392);
  if (/esquerd|motorista/.test(text)) pos.x = Math.min(pos.x, 86);
  if (/direit|passageiro/.test(text)) pos.x = Math.max(pos.x, 214);

  if (/vidro|para-brisa|parabrisa/.test(text)) {
    pos.x = /lateral|porta|esquerd|direit|motorista|passageiro/.test(text) ? (/direit|passageiro/.test(text) ? 222 : 78) : 150;
    pos.y = /traseir|atras/.test(text) ? 408 : /lateral|porta/.test(text) ? 250 : 154;
  }

  if (/roda|pneu|freio|suspensao/.test(text) || ["pneus", "freios", "suspensao"].includes(part.key)) {
    pos.x = /direit|passageiro/.test(text) ? 249 : 51;
    pos.y = /dianteir|frente/.test(text) ? 176 : 364;
  }

  return pos;
}

export default function VehicleSchematic({
  parts,
  approvals = [],
  canRespond = false,
  canViewPrices = false,
  onRespondApproval,
  canManageMaintenance = false,
  onStartPart,
  onResolvePart,
  canEditPrice = false,
  inventoryParts = [],
  onPriceProblem,
  onUpdateProblem,
}: {
  parts: VehiclePart[];
  approvals?: Approval[];
  canRespond?: boolean;
  canViewPrices?: boolean;
  onRespondApproval?: (approvalId: string, status: "APPROVED" | "REJECTED", responseNote?: string) => Promise<void>;
  canManageMaintenance?: boolean;
  onStartPart?: (partId: string) => Promise<void>;
  onResolvePart?: (partId: string) => Promise<void>;
  canEditPrice?: boolean;
  inventoryParts?: InventoryPart[];
  onPriceProblem?: (
    approvalId: string,
    data: { laborValue: number; partUsages: { inventoryPartId: string; quantity: number }[] }
  ) => Promise<void>;
  onUpdateProblem?: (
    approvalId: string,
    data: { note?: string; partUsages: { inventoryPartId: string; quantity: number }[]; files: File[] }
  ) => Promise<void>;
}) {
  const withPosition = useMemo(() => parts.filter((p) => HOTSPOT_POSITIONS[p.key]), [parts]);

  const priorityOrder: Record<string, number> = { CRITICAL: 0, WARNING: 1, IN_PROGRESS: 2, DONE: 3, NOT_INSPECTED: 4 };
  const defaultPart = [...withPosition].sort((a, b) => priorityOrder[a.status] - priorityOrder[b.status])[0];

  const [activeId, setActiveId] = useState<string | undefined>(defaultPart?.id);
  const [rejectNote, setRejectNote] = useState("");
  const [busy, setBusy] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [starting, setStarting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const active = withPosition.find((p) => p.id === activeId) ?? defaultPart;

  const activeMediaIds = new Set(active?.media.map((media) => media.id) ?? []);
  const activeApproval = approvals.find((approval) =>
    active ? approval.partId === active.id || approval.media.some((media) => activeMediaIds.has(media.id)) : false
  );

  type UsageRow = { inventoryPartId: string; quantity: string };

  const [editingPrice, setEditingPrice] = useState(false);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [priceLaborValue, setPriceLaborValue] = useState("");
  const [priceUsages, setPriceUsages] = useState<UsageRow[]>([]);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBusy, setDetailsBusy] = useState(false);
  const [detailNote, setDetailNote] = useState("");
  const [detailUsages, setDetailUsages] = useState<UsageRow[]>([]);
  const [detailFiles, setDetailFiles] = useState<File[]>([]);

  useEffect(() => {
    setEditingPrice(false);
    setPriceLaborValue(activeApproval?.laborValue != null ? String(activeApproval.laborValue) : "");
    setPriceUsages(
      activeApproval?.partUsages?.map((usage) => ({ inventoryPartId: usage.inventoryPart.id, quantity: String(usage.quantity) })) ?? []
    );
    setDetailsOpen(false);
    setDetailNote(activeApproval?.note ?? "");
    setDetailUsages([]);
    setDetailFiles([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeApproval?.id]);

  function addUsageRow(setter: React.Dispatch<React.SetStateAction<UsageRow[]>>) {
    setter((prev) => [...prev, { inventoryPartId: "", quantity: "1" }]);
  }
  function updateUsageRow(
    setter: React.Dispatch<React.SetStateAction<UsageRow[]>>,
    index: number,
    field: keyof UsageRow,
    value: string
  ) {
    setter((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }
  function removeUsageRow(setter: React.Dispatch<React.SetStateAction<UsageRow[]>>, index: number) {
    setter((prev) => prev.filter((_, i) => i !== index));
  }
  function usagesToPayload(rows: UsageRow[]) {
    return rows
      .filter((row) => row.inventoryPartId)
      .map((row) => ({ inventoryPartId: row.inventoryPartId, quantity: Number(row.quantity) || 1 }));
  }

  async function savePrice(e: React.FormEvent) {
    e.preventDefault();
    if (!activeApproval || !onPriceProblem) return;
    setPricingBusy(true);
    try {
      await onPriceProblem(activeApproval.id, {
        laborValue: Number(priceLaborValue) || 0,
        partUsages: usagesToPayload(priceUsages),
      });
      setEditingPrice(false);
    } finally {
      setPricingBusy(false);
    }
  }

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!activeApproval || !onUpdateProblem) return;
    setDetailsBusy(true);
    try {
      await onUpdateProblem(activeApproval.id, {
        note: detailNote,
        partUsages: usagesToPayload(detailUsages),
        files: detailFiles,
      });
      setDetailUsages([]);
      setDetailFiles([]);
      setDetailsOpen(false);
    } finally {
      setDetailsBusy(false);
    }
  }

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

  async function start() {
    if (!active || !onStartPart) return;
    setStarting(true);
    try {
      await onStartPart(active.id);
    } finally {
      setStarting(false);
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
          <image href="/vehicle-xray-top.jpg" x="0" y="0" width="300" height="520" preserveAspectRatio="xMidYMid slice" />

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
              {canViewPrices && activeApproval.laborValue != null && <div className={styles.value}>Mão de obra: R$ {activeApproval.laborValue.toFixed(2)}</div>}
              {canViewPrices && activeApproval.partsValue != null && <div className={styles.value}>Peças: R$ {activeApproval.partsValue.toFixed(2)}</div>}
              {canViewPrices && activeApproval.estimatedValue != null && <div className={styles.value}>R$ {activeApproval.estimatedValue.toFixed(2)}</div>}
              {activeApproval.note && (
                <div className={styles.partNote}>
                  <strong>Observação do mecânico:</strong> {activeApproval.note}
                </div>
              )}
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

              {canEditPrice && onPriceProblem && (
                <div className={styles.approvalActions}>
                  {!editingPrice ? (
                    <button className={styles.actionButton} type="button" onClick={() => setEditingPrice(true)}>
                      {activeApproval.estimatedValue != null ? "Editar preço" : "Precificar problema"}
                    </button>
                  ) : (
                    <form className={styles.formGrid} onSubmit={savePrice}>
                      <label>
                        Mão de obra
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={priceLaborValue}
                          onChange={(e) => setPriceLaborValue(e.target.value)}
                          required
                        />
                      </label>
                      {priceUsages.map((row, index) => (
                        <div key={index} className={styles.fullField}>
                          <label>
                            Peça utilizada
                            <select
                              value={row.inventoryPartId}
                              onChange={(e) => updateUsageRow(setPriceUsages, index, "inventoryPartId", e.target.value)}
                            >
                              <option value="">Nenhuma peça</option>
                              {inventoryParts.map((part) => (
                                <option key={part.id} value={part.id}>
                                  {part.name} · estoque {part.stockQty}
                                  {part.unitCost != null ? ` · R$ ${part.unitCost.toFixed(2)}` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Quantidade
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) => updateUsageRow(setPriceUsages, index, "quantity", e.target.value)}
                            />
                          </label>
                          <button type="button" className={styles.btnReject} onClick={() => removeUsageRow(setPriceUsages, index)}>
                            Remover peça
                          </button>
                        </div>
                      ))}
                      <button type="button" className={styles.actionButton} onClick={() => addUsageRow(setPriceUsages)}>
                        Adicionar peça
                      </button>
                      <button className={styles.actionButton} type="submit" disabled={pricingBusy}>
                        {pricingBusy ? "Salvando..." : "Salvar preço"}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {canManageMaintenance && onUpdateProblem && (
                <div className={styles.approvalActions}>
                  {!detailsOpen ? (
                    <button className={styles.actionButton} type="button" onClick={() => setDetailsOpen(true)}>
                      Adicionar fotos, peças ou observação
                    </button>
                  ) : (
                    <form className={styles.formGrid} onSubmit={saveDetails}>
                      <label className={styles.fullField}>
                        Observação
                        <textarea value={detailNote} onChange={(e) => setDetailNote(e.target.value)} />
                      </label>
                      {detailUsages.map((row, index) => (
                        <div key={index} className={styles.fullField}>
                          <label>
                            Peça necessária
                            <select
                              value={row.inventoryPartId}
                              onChange={(e) => updateUsageRow(setDetailUsages, index, "inventoryPartId", e.target.value)}
                            >
                              <option value="">Selecione</option>
                              {inventoryParts.map((part) => (
                                <option key={part.id} value={part.id}>
                                  {part.name} · estoque {part.stockQty}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Quantidade
                            <input
                              type="number"
                              min="1"
                              value={row.quantity}
                              onChange={(e) => updateUsageRow(setDetailUsages, index, "quantity", e.target.value)}
                            />
                          </label>
                          <button type="button" className={styles.btnReject} onClick={() => removeUsageRow(setDetailUsages, index)}>
                            Remover peça
                          </button>
                        </div>
                      ))}
                      <button type="button" className={styles.actionButton} onClick={() => addUsageRow(setDetailUsages)}>
                        Adicionar peça
                      </button>
                      <label className={styles.fullField}>
                        Fotos
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => setDetailFiles(Array.from(e.target.files ?? []))}
                        />
                        {detailFiles.length > 0 && <span>{detailFiles.length} imagem(ns) selecionada(s)</span>}
                      </label>
                      <button className={styles.actionButton} type="submit" disabled={detailsBusy}>
                        {detailsBusy ? "Salvando..." : "Salvar detalhes"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
          {canManageMaintenance && UNRESOLVED_STATUSES.has(active.status) && (
            <div className={styles.approvalActions}>
              {active.status === "IN_PROGRESS" ? (
                <button className={styles.btnApprove} disabled={resolving} onClick={resolve}>
                  {resolving ? "Concluindo..." : "Problema concluído"}
                </button>
              ) : (
                <button
                  className={styles.btnApprove}
                  disabled={starting || activeApproval?.status === "PENDING" || activeApproval?.status === "REJECTED"}
                  onClick={start}
                >
                  {starting ? "Iniciando..." : "Iniciar manutenção"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
