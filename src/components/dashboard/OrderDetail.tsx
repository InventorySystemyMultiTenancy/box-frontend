"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinOrderRoom } from "@/lib/socket";
import { Approval, ServiceOrder, ServiceOrderStatus, STATUS_LABELS, TimelineEvent, VehiclePart } from "@/lib/types";
import StatusStrip from "@/components/dashboard/StatusStrip";
import Timeline from "@/components/dashboard/Timeline";
import VehicleSchematic from "@/components/dashboard/VehicleSchematic";
import ApprovalCard from "@/components/dashboard/ApprovalCard";
import styles from "./dashboard.module.css";

const PART_OPTIONS = [
  { key: "motor", label: "Motor" },
  { key: "freios", label: "Freios" },
  { key: "suspensao", label: "Suspensão" },
  { key: "transmissao", label: "Transmissão" },
  { key: "escapamento", label: "Escapamento" },
  { key: "eletrica", label: "Elétrica / Bateria" },
  { key: "arcondicionado", label: "Ar-condicionado" },
  { key: "direcao", label: "Direção" },
  { key: "pneus", label: "Pneus" },
  { key: "bateria", label: "Bateria" },
  { key: "arrefecimento", label: "Arrefecimento" },
  { key: "combustivel", label: "Combustível" },
  { key: "carroceria", label: "Carroceria" },
];

/** Painel completo de uma ordem de serviço — status, timeline, aprovação e esquema do
 * veículo. Usado tanto na área do cliente quanto no projeto selecionado pelo mecânico. */
export default function OrderDetail({ orderId }: { orderId: string }) {
  const { user, token } = useAuth();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);
  const [problemForm, setProblemForm] = useState({
    key: "motor",
    name: "Motor",
    description: "",
    wearLevel: "",
    estimatedValue: "",
    files: [] as File[],
  });
  const [problemMessage, setProblemMessage] = useState<string | null>(null);
  const [problemBusy, setProblemBusy] = useState(false);

  const isStaff = user?.role === "MECHANIC" || user?.role === "ADMIN";

  useEffect(() => {
    if (!token) return;
    api
      .serviceOrder(orderId, token)
      .then(({ order }) => setOrder(order as ServiceOrder))
      .catch(() => setFetchError("Não foi possível carregar esta ordem de serviço."));
  }, [token, orderId]);

  useEffect(() => {
    if (!token || !orderId) return;
    joinOrderRoom(orderId, token);
    const socket = getSocket();

    function onStatus(payload: { orderId: string; status: ServiceOrderStatus; progress: number }) {
      setOrder((prev) => (prev && prev.id === payload.orderId ? { ...prev, status: payload.status, progress: payload.progress } : prev));
    }
    function onTimeline(payload: { event: TimelineEvent }) {
      setJustArrivedId(payload.event.id);
      setOrder((prev) =>
        prev && !prev.timelineEvents.some((event) => event.id === payload.event.id)
          ? { ...prev, timelineEvents: [...prev.timelineEvents, payload.event] }
          : prev
      );
    }
    function onPart(payload: { part: VehiclePart }) {
      setOrder((prev) => {
        if (!prev) return prev;
        const exists = prev.parts.some((p) => p.id === payload.part.id);
        const parts = exists ? prev.parts.map((p) => (p.id === payload.part.id ? payload.part : p)) : [...prev.parts, payload.part];
        return { ...prev, parts };
      });
    }
    function onApprovalNew(payload: { approval: Approval }) {
      setOrder((prev) =>
        prev && !prev.approvals.some((approval) => approval.id === payload.approval.id)
          ? { ...prev, approvals: [payload.approval, ...prev.approvals] }
          : prev
      );
    }
    function onApprovalUpdate(payload: { approval: Approval }) {
      setOrder((prev) =>
        prev ? { ...prev, approvals: prev.approvals.map((a) => (a.id === payload.approval.id ? payload.approval : a)) } : prev
      );
    }

    socket.on("status:update", onStatus);
    socket.on("timeline:new", onTimeline);
    socket.on("part:update", onPart);
    socket.on("approval:new", onApprovalNew);
    socket.on("approval:update", onApprovalUpdate);

    return () => {
      socket.off("status:update", onStatus);
      socket.off("timeline:new", onTimeline);
      socket.off("part:update", onPart);
      socket.off("approval:new", onApprovalNew);
      socket.off("approval:update", onApprovalUpdate);
    };
  }, [token, orderId]);

  const respondApproval = useCallback(
    async (approvalId: string, status: "APPROVED" | "REJECTED", responseNote?: string) => {
      if (!token || !order) return;
      const result = await api.respondApproval(order.id, approvalId, status, token, responseNote);
      const approval = (result as { approval?: Approval }).approval;
      if (approval) {
        setOrder((prev) =>
          prev ? { ...prev, approvals: prev.approvals.map((item) => (item.id === approval.id ? approval : item)) } : prev
        );
      }
    },
    [token, order]
  );

  async function createProblem(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !order) return;
    setProblemBusy(true);
    setProblemMessage(null);
    try {
      const result = await api.createProblem(order.id, problemForm, token);
      const part = result.part as VehiclePart;
      const approval = result.approval as Approval;
      const event = result.event as TimelineEvent;
      setOrder((prev) => {
        if (!prev) return prev;
        const partExists = prev.parts.some((p) => p.id === part.id);
        return {
          ...prev,
          status: "AWAITING_APPROVAL",
          progress: 35,
          parts: partExists ? prev.parts.map((p) => (p.id === part.id ? part : p)) : [...prev.parts, part],
          approvals: prev.approvals.some((a) => a.id === approval.id) ? prev.approvals : [approval, ...prev.approvals],
          timelineEvents: prev.timelineEvents.some((t) => t.id === event.id) ? prev.timelineEvents : [...prev.timelineEvents, event],
        };
      });
      setJustArrivedId(event.id);
      setProblemForm((prev) => ({ ...prev, description: "", wearLevel: "", estimatedValue: "", files: [] }));
      setProblemMessage("Problema identificado cadastrado.");
    } catch {
      setProblemMessage("Não foi possível cadastrar o problema.");
    } finally {
      setProblemBusy(false);
    }
  }

  async function startMaintenance() {
    if (!token || !order) return;
    await api.updateOrderStatus(order.id, "RECEIVED", token);
    setOrder((prev) => (prev ? { ...prev, status: "RECEIVED" } : prev));
  }

  if (fetchError) return <div className={styles.empty}>{fetchError}</div>;
  if (!order) return <div className={styles.empty}>Carregando ordem de serviço...</div>;

  const pendingApproval = order.approvals.find((a) => a.status === "PENDING");

  return (
    <div>
      <div className={styles.orderHeader}>
        <div>
          <h1>
            {order.vehicle.brand} {order.vehicle.model} {order.vehicle.year}
            {order.vehicle.engine ? ` · ${order.vehicle.engine}` : ""}
          </h1>
          <div className={styles.meta}>
            {order.code} · KM {order.vehicle.mileage.toLocaleString("pt-BR")}
          </div>
        </div>
        <span className={styles.live}>
          <i /> ATUALIZANDO AO VIVO
        </span>
      </div>

      <StatusStrip current={order.status} />

      <div className={styles.progressCard}>
        <div>{STATUS_LABELS[order.status]}</div>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${order.progress}%` }} />
        </div>
        <div className={styles.progressLabel}>
          <span>Progresso geral</span>
          <span>{order.progress}%</span>
        </div>
      </div>

      {isStaff && order.status === "SCHEDULED" && (
        <div className={`${styles.panel} ${styles.approval}`} style={{ marginBottom: "1.6rem" }}>
          <h2>Veículo agendado</h2>
          <p>
            Aguardando o cliente trazer o veículo
            {order.scheduledAt && ` — agendado para ${new Date(order.scheduledAt).toLocaleString("pt-BR")}`}.
          </p>
          <div className={styles.approvalActions}>
            <button className={styles.btnApprove} onClick={startMaintenance}>
              Veículo chegou — iniciar manutenção
            </button>
          </div>
        </div>
      )}

      <div className={styles.columns}>
        <div className={styles.panel}>
          <h2>Timeline da manutenção</h2>
          <Timeline events={order.timelineEvents} justArrivedId={justArrivedId} />
        </div>

        <div>
          {pendingApproval && (
            <ApprovalCard
              approval={pendingApproval}
              onRespond={(status, responseNote) => respondApproval(pendingApproval.id, status, responseNote)}
            />
          )}

          {isStaff && order.status !== "SCHEDULED" && (
            <div className={styles.panel}>
              <h2>Novo problema identificado</h2>
              <form className={styles.formGrid} onSubmit={createProblem}>
                <label>
                  Componente
                  <select
                    value={problemForm.key}
                    onChange={(e) => {
                      const option = PART_OPTIONS.find((item) => item.key === e.target.value);
                      setProblemForm((prev) => ({ ...prev, key: e.target.value, name: option?.label ?? prev.name }));
                    }}
                  >
                    {PART_OPTIONS.map((part) => (
                      <option key={part.key} value={part.key}>
                        {part.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nome exibido
                  <input value={problemForm.name} onChange={(e) => setProblemForm((prev) => ({ ...prev, name: e.target.value }))} required />
                </label>
                <label className={styles.fullField}>
                  Descrição do problema
                  <textarea
                    value={problemForm.description}
                    onChange={(e) => setProblemForm((prev) => ({ ...prev, description: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  Desgaste (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={problemForm.wearLevel}
                    onChange={(e) => setProblemForm((prev) => ({ ...prev, wearLevel: e.target.value }))}
                  />
                </label>
                <label>
                  Valor estimado
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={problemForm.estimatedValue}
                    onChange={(e) => setProblemForm((prev) => ({ ...prev, estimatedValue: e.target.value }))}
                  />
                </label>
                <label className={styles.fullField}>
                  Imagens do problema
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setProblemForm((prev) => ({ ...prev, files: Array.from(e.target.files ?? []) }))}
                  />
                  {problemForm.files.length > 0 && <span>{problemForm.files.length} imagem(ns) selecionada(s)</span>}
                </label>
                {problemMessage && <div className={styles.formMessage}>{problemMessage}</div>}
                <button className={styles.actionButton} type="submit" disabled={problemBusy}>
                  {problemBusy ? "Salvando..." : "Cadastrar problema"}
                </button>
              </form>
            </div>
          )}

          <div className={styles.panel}>
            <h2>Modelo do veículo</h2>
            <VehicleSchematic
              parts={order.parts}
              approvals={order.approvals}
              canRespond={user?.role === "CUSTOMER"}
              onRespondApproval={respondApproval}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
