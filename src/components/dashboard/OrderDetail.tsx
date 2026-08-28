"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { getSocket, joinOrderRoom } from "@/lib/socket";
import { Approval, InventoryPart, PART_STATUS_LABELS, SERVICE_ORDER_STATUSES, ServiceOrder, ServiceOrderStatus, STATUS_LABELS, TimelineEvent, VehiclePart } from "@/lib/types";
import { buildWhatsAppLink } from "@/lib/whatsapp";
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

const POSITION_REQUIRED_PARTS = new Set(["pneus", "freios", "suspensao"]);

const AXLE_LABEL: Record<string, string> = {
  dianteiro: "dianteiro",
  traseiro: "traseiro",
};

const SIDE_LABEL: Record<string, string> = {
  esquerdo: "lado esquerdo",
  direito: "lado direito",
};

/** Painel completo de uma ordem de serviço — status, timeline, aprovação e esquema do
 * veículo. Usado tanto na área do cliente quanto no projeto selecionado pelo mecânico. */
function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function OrderDetail({ orderId, scrollToTimelineOnLoad = false }: { orderId: string; scrollToTimelineOnLoad?: boolean }) {
  const { user, token } = useAuth();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);
  const scrolledForOrderRef = useRef<string | null>(null);
  const [problemForm, setProblemForm] = useState({
    key: "motor",
    name: "Motor",
    description: "",
    wearLevel: "",
    laborValue: "",
    inventoryPartId: "",
    quantity: "1",
    axle: "dianteiro",
    side: "esquerdo",
    files: [] as File[],
  });
  const [priceForm, setPriceForm] = useState({ laborValue: "", inventoryPartId: "", quantity: "1" });
  const [inventoryParts, setInventoryParts] = useState<InventoryPart[]>([]);
  const [problemMessage, setProblemMessage] = useState<string | null>(null);
  const [problemBusy, setProblemBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState({ description: "", extraValue: "", photo: null as File | null });
  const [advancePhoto, setAdvancePhoto] = useState<File | null>(null);
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [advanceMessage, setAdvanceMessage] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);

  const isStaff = user?.role === "MECHANIC" || user?.role === "ADMIN";
  const isAdmin = user?.role === "ADMIN";
  const isCustomer = user?.role === "CUSTOMER";
  const canViewPrices = isCustomer || isAdmin;

  useEffect(() => {
    if (!token) return;
    api
      .serviceOrder(orderId, token)
      .then(({ order }) => setOrder(order as ServiceOrder))
      .catch(() => setFetchError("Não foi possível carregar esta ordem de serviço."));
  }, [token, orderId]);

  useEffect(() => {
    if (!token || !isStaff) return;
    api.inventoryParts(token).then(({ parts }) => setInventoryParts(parts as InventoryPart[]));
  }, [token, isStaff]);

  // Ao escolher um carro (mecânico/admin selecionando no Kanban/lista), rola até a
  // timeline dele — só uma vez por carro escolhido, não a cada atualização em tempo real.
  useEffect(() => {
    if (!scrollToTimelineOnLoad || !order || scrolledForOrderRef.current === order.id) return;
    scrolledForOrderRef.current = order.id;
    document.getElementById("vehicle-timeline")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [order, scrollToTimelineOnLoad]);

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
    function onArchived(payload: { orderId: string; archivedAt: string }) {
      setOrder((prev) => (prev && prev.id === payload.orderId ? { ...prev, archivedAt: payload.archivedAt } : prev));
    }

    socket.on("status:update", onStatus);
    socket.on("timeline:new", onTimeline);
    socket.on("part:update", onPart);
    socket.on("approval:new", onApprovalNew);
    socket.on("approval:update", onApprovalUpdate);
    socket.on("service-order:archived", onArchived);

    return () => {
      socket.off("status:update", onStatus);
      socket.off("timeline:new", onTimeline);
      socket.off("part:update", onPart);
      socket.off("approval:new", onApprovalNew);
      socket.off("approval:update", onApprovalUpdate);
      socket.off("service-order:archived", onArchived);
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
    const requiresPosition = POSITION_REQUIRED_PARTS.has(problemForm.key);
    const positionText = requiresPosition ? `${AXLE_LABEL[problemForm.axle]} ${SIDE_LABEL[problemForm.side]}` : "";
    const displayName = positionText ? `${problemForm.name} ${positionText}` : problemForm.name;
    const description = positionText ? `Local: ${positionText}. ${problemForm.description}` : problemForm.description;
    setProblemBusy(true);
    setProblemMessage(null);
    try {
      const result = await api.createProblem(
        order.id,
        {
          ...problemForm,
          name: displayName,
          description,
          partUsages: problemForm.inventoryPartId
            ? [{ inventoryPartId: problemForm.inventoryPartId, quantity: Number(problemForm.quantity) || 1 }]
            : [],
        },
        token
      );
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
      setProblemForm((prev) => ({ ...prev, description: "", wearLevel: "", laborValue: "", inventoryPartId: "", quantity: "1", files: [] }));
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

  // Avança para a próxima etapa da sequência (mesmo botão usado no Kanban, só que
  // aqui dentro do projeto e com a opção de anexar uma foto documentando a etapa.
  async function advanceStage(nextStatus: ServiceOrderStatus) {
    if (!token || !order) return;
    setAdvanceBusy(true);
    setAdvanceMessage(null);
    try {
      const result = await api.updateOrderStatus(order.id, nextStatus, token, advancePhoto);
      const updatedOrder = result.order as Partial<ServiceOrder>;
      const event = result.event as TimelineEvent | null;
      setOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: (updatedOrder.status as ServiceOrderStatus) ?? nextStatus,
          progress: updatedOrder.progress ?? prev.progress,
          timelineEvents:
            event && !prev.timelineEvents.some((t) => t.id === event.id) ? [...prev.timelineEvents, event] : prev.timelineEvents,
        };
      });
      if (event) setJustArrivedId(event.id);
      setAdvancePhoto(null);
    } catch {
      setAdvanceMessage("Não foi possível avançar a etapa.");
    } finally {
      setAdvanceBusy(false);
    }
  }

  async function resolvePart(partId: string) {
    if (!token || !order) return;
    const result = await api.resolvePart(order.id, partId, token);
    const part = result.part as VehiclePart;
    const event = result.event as TimelineEvent;
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        parts: prev.parts.map((p) => (p.id === part.id ? part : p)),
        timelineEvents: prev.timelineEvents.some((t) => t.id === event.id) ? prev.timelineEvents : [...prev.timelineEvents, event],
      };
    });
    setJustArrivedId(event.id);
  }

  async function startPart(partId: string) {
    if (!token || !order) return;
    const result = await api.startPart(order.id, partId, token);
    const part = result.part as VehiclePart;
    const event = result.event as TimelineEvent;
    const updatedOrder = result.order as Partial<ServiceOrder> | undefined;
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: updatedOrder?.status ?? "IN_PROGRESS",
        progress: updatedOrder?.progress ?? 65,
        parts: prev.parts.map((p) => (p.id === part.id ? part : p)),
        timelineEvents: prev.timelineEvents.some((t) => t.id === event.id) ? prev.timelineEvents : [...prev.timelineEvents, event],
      };
    });
    setJustArrivedId(event.id);
  }

  async function finalizeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !order) return;
    setFinalizeBusy(true);
    try {
      const result = await api.finalizeOrder(
        order.id,
        { description: finalizeForm.description || undefined, extraValue: finalizeForm.extraValue || undefined, photo: finalizeForm.photo },
        token
      );
      setOrder(result.order as ServiceOrder);
      setFinalizing(false);
      setFinalizeForm({ description: "", extraValue: "", photo: null });
    } finally {
      setFinalizeBusy(false);
    }
  }

  // "Dar baixa": encerra o projeto mesmo sem nenhuma confirmação/aceite do cliente —
  // some da lista/kanban de projetos em andamento, mas o registro (e a garantia das
  // peças/serviço, que independe disso) continua salvo e acessível normalmente.
  async function archiveOrder() {
    if (!token || !order) return;
    if (!confirm("Dar baixa neste projeto? Ele sairá da lista de projetos em andamento, mas continua salvo como concluído.")) return;
    setArchiveBusy(true);
    setArchiveMessage(null);
    try {
      const result = await api.archiveServiceOrder(order.id, token);
      setOrder(result.order as ServiceOrder);
    } catch (err) {
      setArchiveMessage(err instanceof ApiError ? err.message : "Não foi possível dar baixa neste projeto.");
    } finally {
      setArchiveBusy(false);
    }
  }

  const updateProblemDetails = useCallback(
    async (approvalId: string, data: { note?: string; partUsages: { inventoryPartId: string; quantity: number }[]; files: File[] }) => {
      if (!token || !order) return;
      const result = await api.updateProblemDetails(order.id, approvalId, data, token);
      const approval = result.approval as Approval;
      setOrder((prev) => (prev ? { ...prev, approvals: prev.approvals.map((a) => (a.id === approval.id ? approval : a)) } : prev));
    },
    [token, order]
  );

  const priceProblem = useCallback(
    async (approvalId: string, data: { laborValue: number; partUsages: { inventoryPartId: string; quantity: number }[] }) => {
      if (!token || !order) return;
      const result = await api.priceProblem(order.id, approvalId, data, token);
      const approval = result.approval as Approval;
      const part = result.part as VehiclePart | null;
      setOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "AWAITING_APPROVAL",
          progress: 35,
          approvals: prev.approvals.map((a) => (a.id === approval.id ? approval : a)),
          parts: part ? prev.parts.map((p) => (p.id === part.id ? part : p)) : prev.parts,
        };
      });
    },
    [token, order]
  );

  // Admin pode gerar o PDF a qualquer momento, independente do status ou de qualquer
  // confirmação do cliente — inclusive depois de o projeto já ter tido a baixa dada.
  // O cliente só pode gerar quando o veículo está pronto para retirada.
  function generateServicePdf() {
    if (!order) return;
    if (!isAdmin && !(isCustomer && order.status === "READY_FOR_PICKUP")) return;

    // Valor final = trabalho de fato concluído (peça com status DONE), não só o que o
    // cliente aprovou formalmente — mão de obra entra no total igual às peças, já que
    // o admin pode finalizar/dar baixa mesmo sem resposta do cliente a uma aprovação.
    const completedParts = order.parts.filter((part) => part.status === "DONE");
    const donePartIds = new Set(completedParts.map((part) => part.id));
    const completedApprovals = order.approvals.filter((approval) => approval.partId && donePartIds.has(approval.partId));
    const servicesTotal = completedApprovals.reduce((sum, approval) => sum + (approval.estimatedValue ?? 0), 0) || order.estimatedMin || 0;
    const total = servicesTotal + (order.deliveryExtraValue ?? 0);
    const partsRows = order.parts
      .map(
        (part) => `
          <tr>
            <td>${escapeHtml(part.name)}</td>
            <td>${escapeHtml(PART_STATUS_LABELS[part.status])}</td>
            <td>${escapeHtml(part.note ?? "—")}</td>
          </tr>
        `
      )
      .join("");
    const rows = completedApprovals
      .map((approval) => {
        const parts = approval.partUsages?.length
          ? approval.partUsages.map((usage) => `${usage.quantity}x ${usage.inventoryPart.name}`).join(", ")
          : "Sem peça vinculada";
        return `
          <tr>
            <td>${escapeHtml(approval.description)}</td>
            <td>${escapeHtml(parts)}</td>
            <td>${formatCurrency(approval.laborValue ?? 0)}</td>
            <td>${formatCurrency(approval.partsValue ?? 0)}</td>
            <td>${formatCurrency(approval.estimatedValue ?? 0)}</td>
          </tr>
        `;
      })
      .join("");
    const completedList = completedParts.map((part) => `<li>${escapeHtml(part.name)} - ${escapeHtml(part.note ?? "Serviço concluído")}</li>`).join("");
    const printedAt = new Date().toLocaleString("pt-BR");
    const vehicle = `${order.vehicle.brand} ${order.vehicle.model} ${order.vehicle.year}`;
    const popup = window.open("", "_blank", "width=960,height=720");
    if (!popup) return;

    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório ${escapeHtml(order.code)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: 32px; }
            h1 { margin: 0 0 6px; font-size: 24px; }
            h2 { margin-top: 26px; font-size: 16px; }
            .muted { color: #555; font-size: 13px; }
            .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 18px; margin-top: 18px; }
            .box { border: 1px solid #ddd; padding: 10px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f4f4f4; }
            .total { margin-top: 18px; text-align: right; font-size: 18px; font-weight: 700; }
            li { margin-bottom: 6px; }
          </style>
        </head>
        <body>
          <h1>Relatório do projeto</h1>
          <div class="muted">Gerado em ${printedAt} · Etapa atual: ${escapeHtml(STATUS_LABELS[order.status])}</div>
          <div class="summary">
            <div class="box"><strong>Ordem</strong><br />${escapeHtml(order.code)}</div>
            <div class="box"><strong>Cliente</strong><br />${escapeHtml(order.vehicle.owner?.name ?? "Não informado")}</div>
            <div class="box"><strong>Veículo</strong><br />${escapeHtml(vehicle)}</div>
            <div class="box"><strong>Placa</strong><br />${escapeHtml(order.vehicle.plate ?? "Não informada")}</div>
            <div class="box"><strong>Quilometragem</strong><br />${order.vehicle.mileage.toLocaleString("pt-BR")} km</div>
          </div>
          <h2>Problemas identificados</h2>
          <table>
            <thead>
              <tr>
                <th>Sistema</th>
                <th>Status</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>${partsRows || '<tr><td colspan="3">Nenhum problema registrado.</td></tr>'}</tbody>
          </table>
          <h2>Serviços realizados</h2>
          <ul>${completedList || "<li>Nenhum problema concluído registrado.</li>"}</ul>
          <h2>Valores do serviço</h2>
          <table>
            <thead>
              <tr>
                <th>Problema / serviço</th>
                <th>Peças usadas</th>
                <th>Mão de obra</th>
                <th>Valor peças</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="5">Nenhum valor de serviço concluído registrado.</td></tr>'}</tbody>
          </table>
          ${
            order.deliveryExtraValue
              ? `<div class="muted" style="margin-top: 8px; text-align: right;">Valor extra na entrega: ${formatCurrency(order.deliveryExtraValue)}</div>`
              : ""
          }
          <div class="total">Valor final: ${formatCurrency(total)}</div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  async function pricePendingProblem(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !order || !pendingApproval) return;
    const usage = priceForm.inventoryPartId
      ? [{ inventoryPartId: priceForm.inventoryPartId, quantity: Number(priceForm.quantity) || 1 }]
      : [];
    const result = await api.priceProblem(
      order.id,
      pendingApproval.id,
      {
        laborValue: Number(priceForm.laborValue) || 0,
        partUsages: usage,
      },
      token
    );
    const approval = result.approval as Approval;
    const part = result.part as VehiclePart | null;
    const event = result.event as TimelineEvent;
    setOrder((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: "AWAITING_APPROVAL",
        progress: 35,
        approvals: prev.approvals.map((a) => (a.id === approval.id ? approval : a)),
        parts: part ? prev.parts.map((p) => (p.id === part.id ? part : p)) : prev.parts,
        timelineEvents: prev.timelineEvents.some((t) => t.id === event.id) ? prev.timelineEvents : [...prev.timelineEvents, event],
      };
    });
    setJustArrivedId(event.id);
    setPriceForm({ laborValue: "", inventoryPartId: "", quantity: "1" });
  }

  if (fetchError) return <div className={styles.empty}>{fetchError}</div>;
  if (!order) return <div className={styles.empty}>Carregando ordem de serviço...</div>;

  const pendingApproval = order.approvals.find((a) => a.status === "PENDING");
  const unresolvedParts = order.parts.filter((p) => p.status === "CRITICAL" || p.status === "WARNING" || p.status === "IN_PROGRESS");
  // A liberação do veículo depende só do trabalho da oficina estar concluído (peças
  // sem pendência) — mecânico/admin podem avançar e entregar mesmo com uma aprovação
  // do cliente ainda pendente, forçando a peça correspondente para "concluído".
  const blockedForPickup = unresolvedParts.length > 0;
  // Sem nenhum problema resolvido ainda (inclusive quando nenhum problema sequer foi
  // identificado), não faz sentido oferecer "pronto para retirada" — precisa ter pelo
  // menos uma peça concluída.
  const hasResolvedProblem = order.parts.some((p) => p.status === "DONE");
  const canOfferPickup = !blockedForPickup && hasResolvedProblem;
  const isReady = order.status === "READY_FOR_PICKUP";
  const canRegisterProblems = !["SCHEDULED", "READY_FOR_PICKUP", "FINISHED"].includes(order.status);
  const pendingNeedsPrice = pendingApproval && pendingApproval.estimatedValue == null;

  // Próxima etapa da sequência — para no FINISHED, já que ir para "pronto para
  // retirada" exige o fluxo de finalização (peças concluídas), não um simples avanço.
  const statusIndex = SERVICE_ORDER_STATUSES.indexOf(order.status);
  const nextStatus: ServiceOrderStatus | null =
    statusIndex >= 0 && statusIndex < SERVICE_ORDER_STATUSES.length - 2 ? SERVICE_ORDER_STATUSES[statusIndex + 1] : null;

  const whatsAppLink =
    isStaff && order.vehicle.owner
      ? buildWhatsAppLink(
          order.vehicle.owner.phone,
          `Olá, ${order.vehicle.owner.name}! Seu ${order.vehicle.brand} ${order.vehicle.model} (OS ${order.code}) está na etapa: "${STATUS_LABELS[order.status]}". Acompanhe pelo sistema: ${typeof window !== "undefined" ? window.location.origin : ""}/dashboard`
        )
      : null;

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

      {isAdmin && (
        <div className={styles.approvalActions} style={{ marginBottom: "1.2rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
          {order.archivedAt && (
            <span className={styles.tlSub}>Baixa dada em {new Date(order.archivedAt).toLocaleString("pt-BR")} — projeto concluído</span>
          )}
          {archiveMessage && <span className={styles.tlSub}>{archiveMessage}</span>}
          <button className={styles.btnApprove} type="button" onClick={generateServicePdf}>
            Baixar PDF do projeto
          </button>
          {isReady && !order.archivedAt && (
            <button className={styles.btnApprove} type="button" disabled={archiveBusy} onClick={archiveOrder}>
              {archiveBusy ? "Dando baixa..." : "Dar baixa no projeto"}
            </button>
          )}
        </div>
      )}

      <StatusStrip current={order.status} />

      <div className={styles.progressCard}>
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

      {isStaff && canRegisterProblems && (
        <div className={`${styles.panel} ${styles.approval}`} style={{ marginBottom: "1.6rem" }}>
          <h2>Finalização</h2>
          {blockedForPickup ? (
            <p>
              Ainda há {unresolvedParts.length} problema{unresolvedParts.length > 1 ? "s" : ""} aguardando reparo antes de liberar o veículo.
            </p>
          ) : !hasResolvedProblem ? (
            <p>Nenhum problema identificado e resolvido ainda — registre e conclua ao menos um para liberar o veículo.</p>
          ) : (
            <>
              <p>Todos os problemas identificados foram resolvidos.</p>
              {pendingApproval && (
                <p className={styles.tlSub}>
                  Há uma aprovação do cliente ainda pendente, mas isso não impede a liberação do veículo.
                </p>
              )}
              {isAdmin ? (
                <div className={styles.approvalActions}>
                  <button className={styles.btnApprove} disabled={finalizing} onClick={() => setFinalizing(true)}>
                    {finalizing ? "Preencha a entrega abaixo, junto ao modelo do veículo" : "Veículo pronto para retirada"}
                  </button>
                </div>
              ) : (
                <div className={styles.approvalActions}>
                  <button className={styles.btnApprove} type="button" disabled>
                    Aguardando admin liberar retirada
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isStaff && (nextStatus || whatsAppLink) && (
        <div className={`${styles.panel} ${styles.approval}`} style={{ marginBottom: "1.6rem" }}>
          <h2>Avançar etapa</h2>
          {nextStatus && (
            <>
              <p>
                Etapa atual: <strong>{STATUS_LABELS[order.status]}</strong>. Próxima etapa: <strong>{STATUS_LABELS[nextStatus]}</strong>.
              </p>
              <label className={styles.fullField} style={{ display: "block", marginBottom: "0.8rem" }}>
                Foto desta etapa (opcional)
                <input type="file" accept="image/*" onChange={(e) => setAdvancePhoto(e.target.files?.[0] ?? null)} />
                {advancePhoto && <span>{advancePhoto.name}</span>}
              </label>
            </>
          )}
          {advanceMessage && <div className={styles.formMessage}>{advanceMessage}</div>}
          <div className={styles.approvalActions}>
            {nextStatus && (
              <button className={styles.btnApprove} disabled={advanceBusy} onClick={() => advanceStage(nextStatus)}>
                {advanceBusy ? "Avançando..." : `Avançar para "${STATUS_LABELS[nextStatus]}"`}
              </button>
            )}
            {whatsAppLink ? (
              <a className={styles.btnApprove} href={whatsAppLink} target="_blank" rel="noreferrer">
                Avisar cliente (WhatsApp)
              </a>
            ) : (
              isStaff && <span className={styles.tlSub}>Cliente sem telefone cadastrado.</span>
            )}
          </div>
        </div>
      )}

      {/* Modelo do veículo com acompanhamento dos problemas — em destaque, logo no topo. */}
      <div style={{ marginBottom: "1.6rem" }}>
        <div className={`${styles.panel} ${isReady ? styles.panelReady : ""}`}>
          <h2>Modelo do veículo</h2>
          {isReady && <div className={styles.readyBanner}>Veículo pronto e em ótimo estado — pode retirar!</div>}
          {isCustomer && isReady && (
            <div className={styles.approvalActions}>
              <button className={styles.btnApprove} onClick={generateServicePdf}>
                Gerar PDF do serviço
              </button>
            </div>
          )}
          <VehicleSchematic
            parts={order.parts}
            approvals={order.approvals}
            canRespond={user?.role === "CUSTOMER"}
            canViewPrices={canViewPrices}
            onRespondApproval={respondApproval}
            canManageMaintenance={isStaff}
            onStartPart={startPart}
            onResolvePart={resolvePart}
            canEditPrice={isAdmin}
            inventoryParts={inventoryParts}
            onPriceProblem={priceProblem}
            onUpdateProblem={updateProblemDetails}
          />
          {isStaff && canRegisterProblems && canOfferPickup && (
            <div className={styles.approvalActions}>
              {isAdmin ? (
                !finalizing && (
                  <button className={styles.btnApprove} onClick={() => setFinalizing(true)}>
                    Veículo pronto para retirada
                  </button>
                )
              ) : (
                <button className={styles.btnApprove} type="button" disabled>
                  Aguardando admin liberar retirada
                </button>
              )}
            </div>
          )}
          {isAdmin && isStaff && canRegisterProblems && canOfferPickup && finalizing && (
            <div className={styles.panel}>
              <h2>Confirmar entrega</h2>
              <form className={styles.formGrid} onSubmit={finalizeOrder}>
                <label className={styles.fullField}>
                  Descrição da entrega
                  <textarea
                    value={finalizeForm.description}
                    onChange={(e) => setFinalizeForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </label>
                <label>
                  Valor extra
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={finalizeForm.extraValue}
                    onChange={(e) => setFinalizeForm((prev) => ({ ...prev, extraValue: e.target.value }))}
                  />
                </label>
                <label className={styles.fullField}>
                  Foto do veículo finalizado
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFinalizeForm((prev) => ({ ...prev, photo: e.target.files?.[0] ?? null }))}
                  />
                </label>
                <button className={styles.actionButton} type="submit" disabled={finalizeBusy}>
                  {finalizeBusy ? "Finalizando..." : "Confirmar entrega"}
                </button>
              </form>
            </div>
          )}
        </div>

        {canViewPrices && pendingApproval && pendingApproval.estimatedValue != null && (
          <ApprovalCard
            approval={pendingApproval}
            canRespond={isCustomer}
            canViewPrices={canViewPrices}
            onRespond={(status, responseNote) => respondApproval(pendingApproval.id, status, responseNote)}
          />
        )}

        {isAdmin && pendingNeedsPrice && (
          <div className={styles.panel}>
            <h2>Precificar problema</h2>
            <form className={styles.formGrid} onSubmit={pricePendingProblem}>
              <label>
                Mão de obra
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceForm.laborValue}
                  onChange={(e) => setPriceForm((prev) => ({ ...prev, laborValue: e.target.value }))}
                  required
                />
              </label>
              <label>
                Peça utilizada
                <select value={priceForm.inventoryPartId} onChange={(e) => setPriceForm((prev) => ({ ...prev, inventoryPartId: e.target.value }))}>
                  <option value="">Nenhuma peça</option>
                  {inventoryParts.map((part) => (
                    <option key={part.id} value={part.id}>
                      {part.name} · estoque {part.stockQty} · R$ {part.unitCost.toFixed(2)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantidade
                <input
                  type="number"
                  min="1"
                  value={priceForm.quantity}
                  onChange={(e) => setPriceForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </label>
              <button className={styles.actionButton} type="submit">
                Enviar orçamento ao cliente
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Timeline e cadastro de problemas — histórico e administração, abaixo do modelo. */}
      <div className={styles.columns} id="vehicle-timeline">
        <div className={styles.panel}>
          <h2>Timeline da manutenção</h2>
          <Timeline events={order.timelineEvents} justArrivedId={justArrivedId} canViewPrices={canViewPrices} />
        </div>

        <div>
          {isStaff && canRegisterProblems && (
            <div className={styles.panel}>
              <h2>{isAdmin ? "Diagnóstico com preço" : "Novo problema diagnosticado"}</h2>
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
                {POSITION_REQUIRED_PARTS.has(problemForm.key) && (
                  <>
                    <label>
                      Eixo
                      <select value={problemForm.axle} onChange={(e) => setProblemForm((prev) => ({ ...prev, axle: e.target.value }))}>
                        <option value="dianteiro">Dianteiro</option>
                        <option value="traseiro">Traseiro</option>
                      </select>
                    </label>
                    <label>
                      Lado
                      <select value={problemForm.side} onChange={(e) => setProblemForm((prev) => ({ ...prev, side: e.target.value }))}>
                        <option value="esquerdo">Esquerdo</option>
                        <option value="direito">Direito</option>
                      </select>
                    </label>
                  </>
                )}
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
                {isAdmin && (
                  <>
                    <label>
                      Mão de obra
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={problemForm.laborValue}
                        onChange={(e) => setProblemForm((prev) => ({ ...prev, laborValue: e.target.value }))}
                      />
                    </label>
                    <label>
                      Peça utilizada
                      <select
                        value={problemForm.inventoryPartId}
                        onChange={(e) => setProblemForm((prev) => ({ ...prev, inventoryPartId: e.target.value }))}
                      >
                        <option value="">Nenhuma peça</option>
                        {inventoryParts.map((part) => (
                          <option key={part.id} value={part.id}>
                            {part.name} · estoque {part.stockQty} · R$ {part.unitCost.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Quantidade
                      <input
                        type="number"
                        min="1"
                        value={problemForm.quantity}
                        onChange={(e) => setProblemForm((prev) => ({ ...prev, quantity: e.target.value }))}
                      />
                    </label>
                  </>
                )}
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
        </div>
      </div>
    </div>
  );
}
