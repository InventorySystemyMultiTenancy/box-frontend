"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, API_URL } from "@/lib/api";
import { getSocket, joinOrderRoom } from "@/lib/socket";
import { ACTIVE_SERVICE_ORDER_STATUSES, Approval, BankAccount, InventoryPart, PART_STATUS_LABELS, ServiceOrder, ServiceOrderStatus, STATUS_LABELS, TimelineEvent, VehiclePart } from "@/lib/types";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { FINISHED_ORDER_WHATSAPP, finishedOrderMessage, statusUpdateMessage } from "@/lib/whatsapp-messages";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { printHtml } from "@/lib/printable-report";
import { POSITION_REQUIRED_PARTS, positionText as formatPosition } from "@/lib/part-position";
import { SignaturePad, SignaturePadHandle } from "@/components/ui/signature-pad";
import { toast } from "sonner";
import StatusStrip from "@/components/dashboard/StatusStrip";
import Timeline from "@/components/dashboard/Timeline";
import VehicleSchematic from "@/components/dashboard/VehicleSchematic";
import { ShareLinkDialog } from "@/components/dashboard/ShareLinkDialog";
import OrderAssigneesPanel from "@/components/dashboard/OrderAssigneesPanel";
import DamagePhotosPanel from "@/components/dashboard/DamagePhotosPanel";
import ServicePartsPanel from "@/components/dashboard/ServicePartsPanel";
import ProjectValuesPanel from "@/components/dashboard/ProjectValuesPanel";
import { projectValues } from "@/lib/order-values";
import { EditVehicleDialog } from "@/components/dashboard/EditVehicleDialog";
import { EditSsNumberDialog } from "@/components/dashboard/EditSsNumberDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { X } from "lucide-react";
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
function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

function emptyFinalizeForm() {
  return {
    description: "",
    extraValue: "",
    photo: null as File | null,
    paymentMethod: "PIX",
    installments: "1",
    // Prazo opcional: sem prazo, a conta a receber já aparece vencida até alguém definir.
    firstDueDate: "",
    bankAccountId: "",
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function OrderDetail({
  orderId,
  scrollToTimelineOnLoad = false,
  onDeleted,
}: {
  orderId: string;
  scrollToTimelineOnLoad?: boolean;
  onDeleted?: () => void;
}) {
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
    axle: "dianteiro",
    side: "esquerdo",
    files: [] as File[],
  });
  const [priceForm, setPriceForm] = useState({ laborValue: "", inventoryPartId: "", quantity: "1" });
  // Peças do problema novo — várias de uma vez, cada uma com quantidade (removíveis).
  const [problemUsages, setProblemUsages] = useState([{ inventoryPartId: "", quantity: "1" }]);
  const [inventoryParts, setInventoryParts] = useState<InventoryPart[]>([]);
  const [newPartOpen, setNewPartOpen] = useState(false);
  const [newPartForm, setNewPartForm] = useState({ name: "", unitCost: "" });
  const [newPartBusy, setNewPartBusy] = useState(false);
  const [newPartError, setNewPartError] = useState<string | null>(null);
  const [problemMessage, setProblemMessage] = useState<string | null>(null);
  const [problemBusy, setProblemBusy] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [finalizeForm, setFinalizeForm] = useState(emptyFinalizeForm);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const deliverySignatureRef = useRef<SignaturePadHandle>(null);
  // Link usado na mensagem de WhatsApp: o público de acompanhamento (sem login) quando a
  // OS tem um ativo; senão o painel do cliente.
  const [shareToken, setShareToken] = useState<string | null>(null);
  // Acabou de avançar etapa/entregar — destaca o "Avisar cliente" pra não esquecer.
  const [notifyPrompt, setNotifyPrompt] = useState(false);
  const [advancePhoto, setAdvancePhoto] = useState<File | null>(null);
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [advanceMessage, setAdvanceMessage] = useState<string | null>(null);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!token || !isAdmin) return;
    api.bankAccounts(token).then(({ accounts }) => setBankAccounts(accounts as BankAccount[])).catch(() => {});
  }, [token, isAdmin]);

  useEffect(() => {
    if (!token || !isStaff) return;
    api
      .getShareLink(orderId, token)
      .then(({ link }) => setShareToken(link?.token ?? null))
      .catch(() => {});
  }, [token, isStaff, orderId]);

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
    const positionText = requiresPosition ? formatPosition(problemForm.axle, problemForm.side) : "";
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
          ...(requiresPosition ? { axle: problemForm.axle, side: problemForm.side } : {}),
          partUsages: problemUsages
            .filter((u) => u.inventoryPartId)
            .map((u) => ({ inventoryPartId: u.inventoryPartId, quantity: Math.max(1, Math.floor(Number(u.quantity) || 1)) })),
        },
        token
      );
      const part = result.part as VehiclePart;
      const approval = result.approval as Approval;
      const event = result.event as TimelineEvent;
      setOrder((prev) => {
        if (!prev) return prev;
        const partExists = prev.parts.some((p) => p.id === part.id);
        const nextOrderStatus: ServiceOrderStatus = isAdmin ? "IN_PROGRESS" : "DIAGNOSIS_DONE";
        return {
          ...prev,
          status: nextOrderStatus,
          progress: isAdmin ? 65 : 25,
          parts: partExists ? prev.parts.map((p) => (p.id === part.id ? part : p)) : [...prev.parts, part],
          approvals: prev.approvals.some((a) => a.id === approval.id) ? prev.approvals : [approval, ...prev.approvals],
          timelineEvents: prev.timelineEvents.some((t) => t.id === event.id) ? prev.timelineEvents : [...prev.timelineEvents, event],
        };
      });
      setJustArrivedId(event.id);
      setProblemForm((prev) => ({ ...prev, description: "", wearLevel: "", laborValue: "", files: [] }));
      setProblemUsages([{ inventoryPartId: "", quantity: "1" }]);
      setProblemMessage("Problema identificado cadastrado.");
    } catch {
      setProblemMessage("Não foi possível cadastrar o problema.");
    } finally {
      setProblemBusy(false);
    }
  }

  // Só a chamada de API + atualização da lista local — compartilhada entre o formulário
  // de "novo problema" abaixo e o schematic do veículo (VehicleSchematic.onCreatePart),
  // que também deixa cadastrar peça nova direto de "adicionar peça"/"detalhes", sem
  // precisar ir até a aba Peças e voltar.
  async function createInventoryPartRequest(data: { name: string; unitCost: string }): Promise<InventoryPart> {
    if (!token) throw new Error("Não autenticado.");
    const result = await api.saveInventoryPart({ name: data.name.trim(), unitCost: data.unitCost || "0" }, token);
    const part = result.part as InventoryPart;
    setInventoryParts((prev) => [...prev, part]);
    return part;
  }

  async function createInventoryPart() {
    if (!newPartForm.name.trim()) {
      setNewPartError("Informe o nome da peça.");
      return;
    }
    setNewPartBusy(true);
    setNewPartError(null);
    try {
      const part = await createInventoryPartRequest(newPartForm);
      // Peça recém-cadastrada entra na lista (na linha vazia, se houver).
      setProblemUsages((prev) => {
        const empty = prev.findIndex((u) => !u.inventoryPartId);
        if (empty >= 0) return prev.map((u, i) => (i === empty ? { ...u, inventoryPartId: part.id } : u));
        return [...prev, { inventoryPartId: part.id, quantity: "1" }];
      });
      setNewPartForm({ name: "", unitCost: "" });
      setNewPartOpen(false);
    } catch {
      setNewPartError("Não foi possível cadastrar a peça.");
    } finally {
      setNewPartBusy(false);
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
      if (nextStatus === "FINISHED" && isAdmin) toast.success("Projeto finalizado — o valor já está pendente em Financeiro > Contas a receber.");
      setAdvancePhoto(null);
      setNotifyPrompt(true);
    } catch {
      setAdvanceMessage("Não foi possível avançar a etapa.");
    } finally {
      setAdvanceBusy(false);
    }
  }

  // Botão "Finalizar projeto" (dentro da box de avançar etapa) — valida no clique em
  // vez de simplesmente ficar desabilitado, para o mecânico/admin saber por que não
  // pode finalizar ainda.
  function handleFinalizeClick() {
    if (blockedForPickup) {
      setAdvanceMessage(
        `Ainda há ${unresolvedParts.length} problema${unresolvedParts.length > 1 ? "s" : ""} não resolvido${unresolvedParts.length > 1 ? "s" : ""} — resolva antes de finalizar.`
      );
      return;
    }
    if (!hasResolvedProblem) {
      setAdvanceMessage("Nenhum problema identificado e resolvido ainda — registre e conclua ao menos um para finalizar.");
      return;
    }
    setAdvanceMessage(null);
    setFinalizing(true);
  }

  async function resolvePart(partId: string) {
    if (!token || !order) return;
    let result;
    try {
      result = await api.resolvePart(order.id, partId, token);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível marcar o problema como resolvido.");
      return;
    }
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
    // Aba do WhatsApp aberta já no clique (antes de qualquer await) — aberta depois da
    // resposta do servidor, o navegador bloqueia como pop-up. Recebe o link no fim.
    const whatsAppWindow = window.open("", "_blank");
    setFinalizeBusy(true);
    setFinalizeError(null);
    try {
      const signature = await deliverySignatureRef.current?.toBlob();
      const result = await api.finalizeOrder(
        order.id,
        {
          description: finalizeForm.description || undefined,
          extraValue: finalizeForm.extraValue || undefined,
          photo: finalizeForm.photo,
          signature,
          paymentMethod: finalizeForm.paymentMethod || undefined,
          installments: Number(finalizeForm.installments) || 1,
          firstDueDate: finalizeForm.firstDueDate ? new Date(`${finalizeForm.firstDueDate}T12:00:00`).toISOString() : undefined,
          bankAccountId: finalizeForm.bankAccountId || undefined,
        },
        token
      );
      setOrder(result.order as ServiceOrder);
      setFinalizing(false);
      setFinalizeForm(emptyFinalizeForm());
      setNotifyPrompt(true);
      toast.success("Entrega confirmada — a cobrança está pendente em Financeiro > Contas a receber.");

      // PDF de finalização vai para o WhatsApp da oficina, com a mensagem já pronta.
      const link = buildWhatsAppLink(FINISHED_ORDER_WHATSAPP, finishedOrderMessage(order.vehicle, result.reportUrl ? mediaUrl(result.reportUrl) : null));
      if (!result.reportUrl) toast.error("Não foi possível gerar o PDF do serviço — a mensagem vai sem o arquivo.");
      if (link && whatsAppWindow && !whatsAppWindow.closed) whatsAppWindow.location.href = link;
      else if (link) toast.info("O navegador bloqueou a abertura do WhatsApp — use o botão \"Enviar PDF no WhatsApp\".");
    } catch (err) {
      whatsAppWindow?.close();
      setFinalizeError(err instanceof ApiError ? err.message : "Não foi possível confirmar a entrega.");
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

  function handleDeleteDialogChange(open: boolean) {
    setDeleteOpen(open);
    if (!open) {
      setDeleteConfirmed(false);
      setDeleteCode("");
      setDeleteError(null);
    }
  }

  // Exclusão definitiva do projeto — diferente de "dar baixa" (que só encerra e
  // mantém o histórico). O backend recusa se já houver rastro financeiro; aqui a
  // confirmação dupla é: 1) o admin clica em "Continuar" cientre do aviso, 2) precisa
  // digitar o código exato da OS para liberar o botão final de exclusão.
  async function deleteOrder() {
    if (!token || !order) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.deleteServiceOrder(order.id, token);
      setDeleteOpen(false);
      onDeleted?.();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Não foi possível excluir o projeto.");
    } finally {
      setDeleteBusy(false);
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

  // "Peças do serviço": muda o valor de uma peça; o servidor recalcula os totais do problema.
  const updatePartUsage = useCallback(
    async (approvalId: string, usageId: string, data: { unitCost: number; quantity: number }) => {
      if (!token || !order) return;
      const result = await api.updatePartUsage(order.id, approvalId, usageId, data, token);
      const approval = result.approval as Approval;
      const event = result.event as TimelineEvent;
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              approvals: prev.approvals.map((a) => (a.id === approval.id ? approval : a)),
              timelineEvents: prev.timelineEvents.some((t) => t.id === event.id) ? prev.timelineEvents : [...prev.timelineEvents, event],
            }
          : prev
      );
    },
    [token, order]
  );

  // "Valores do projeto": muda a mão de obra; o servidor recalcula o total do problema.
  const updateProblemLabor = useCallback(
    async (approvalId: string, laborValue: number) => {
      if (!token || !order) return;
      const result = await api.updateProblemLabor(order.id, approvalId, laborValue, token);
      const approval = result.approval as Approval;
      const event = result.event as TimelineEvent;
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              approvals: prev.approvals.map((a) => (a.id === approval.id ? approval : a)),
              timelineEvents: prev.timelineEvents.some((t) => t.id === event.id) ? prev.timelineEvents : [...prev.timelineEvents, event],
            }
          : prev
      );
    },
    [token, order]
  );

  const priceProblem = useCallback(
    async (
      approvalId: string,
      data: { name?: string; description?: string; axle?: string | null; side?: string | null; laborValue: number; partUsages: { inventoryPartId: string; quantity: number }[] }
    ) => {
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

    // O PDF reflete o projeto como ele está agora, não só o que já foi concluído — todo
    // problema/valor/peça cadastrado entra assim que é registrado, sem esperar a baixa.
    // "Serviços realizados" continua restrito ao que de fato já tem peça com status DONE;
    // já a lista de valores mostra todas as aprovações lançadas, e o total soma todas menos
    // as recusadas pelo cliente (mesma conta do quadro "Valores do projeto").
    const completedParts = order.parts.filter((part) => part.status === "DONE");
    const values = projectValues(order);
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
    const rows = order.approvals
      .map((approval) => {
        const part = approval.partId ? order.parts.find((p) => p.id === approval.partId) : undefined;
        const statusLabel =
          approval.status === "REJECTED"
            ? "Recusado (não soma)"
            : part
              ? PART_STATUS_LABELS[part.status]
              : approval.status === "APPROVED"
                ? "Aprovado"
                : "Pendente";
        const parts = approval.partUsages?.length
          ? approval.partUsages.map((usage) => `${usage.quantity}x ${usage.inventoryPart.name}`).join(", ")
          : "Sem peça vinculada";
        return `
          <tr>
            <td>${escapeHtml(approval.description)}</td>
            <td>${escapeHtml(statusLabel)}</td>
            <td>${escapeHtml(parts)}</td>
            <td>${formatCurrency(approval.laborValue ?? 0)}</td>
            <td>${formatCurrency(approval.partsValue ?? 0)}</td>
            <td>${formatCurrency(approval.estimatedValue ?? 0)}</td>
          </tr>
        `;
      })
      .join("");
    const completedList = completedParts
      .map((part) => {
        const by = part.responsible?.name ? ` (concluído por ${escapeHtml(part.responsible.name)})` : "";
        return `<li>${escapeHtml(part.name)} - ${escapeHtml(part.note ?? "Serviço concluído")}${by}</li>`;
      })
      .join("");
    const printedAt = new Date().toLocaleString("pt-BR");
    const vehicle = `${order.vehicle.brand} ${order.vehicle.model} ${order.vehicle.year}`;
    // Na mesma aba (diálogo de impressão / salvar como PDF) — ver printHtml.
    printHtml(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório ${escapeHtml(order.code)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: 32px; }
            .brand { margin-bottom: 18px; }
            .brand img { height: 40px; }
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
          <div class="brand"><img src="${window.location.origin}/reblind-logo-transparent.png" alt="Reblind" /></div>
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
                <th>Status</th>
                <th>Peças usadas</th>
                <th>Mão de obra</th>
                <th>Valor peças</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="6">Nenhum valor de serviço registrado.</td></tr>'}</tbody>
          </table>
          ${
            values.rows.length
              ? `<div class="muted" style="margin-top: 8px; text-align: right;">Mão de obra: ${formatCurrency(values.laborTotal)} · Peças: ${formatCurrency(values.partsTotal)}</div>`
              : ""
          }
          ${
            values.estimate
              ? `<div class="muted" style="margin-top: 4px; text-align: right;">Valor estimado na abertura: ${formatCurrency(values.estimate)}</div>`
              : ""
          }
          ${
            values.extra
              ? `<div class="muted" style="margin-top: 4px; text-align: right;">Valor extra na entrega: ${formatCurrency(values.extra)}</div>`
              : ""
          }
          <div class="total">Valor final: ${formatCurrency(values.total)}</div>
        </body>
      </html>
    `);
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
  // Finalizado (ou com baixa): pode ser excluído mesmo com nota/comissão/contas (backend).
  const isFinishedOrder = Boolean(order.archivedAt) || order.status === "FINISHED" || isReady;
  const canRegisterProblems = !["SCHEDULED", "READY_FOR_PICKUP", "FINISHED"].includes(order.status);
  // Diferente de canRegisterProblems: o painel de finalização precisa continuar visível
  // em FINISHED, já que é exatamente esse status que precede "pronto para retirada" —
  // só SCHEDULED (veículo nem chegou) e READY_FOR_PICKUP (já finalizado) ficam de fora.
  const canFinalize = !["SCHEDULED", "READY_FOR_PICKUP"].includes(order.status);
  const pendingNeedsPrice = pendingApproval && pendingApproval.estimatedValue == null;

  // Próxima etapa da sequência — usa só as etapas ativas (sem AWAITING_APPROVAL/
  // PARTS_REQUESTED/PARTS_RECEIVED/WASHING, retiradas do fluxo) e para no FINISHED,
  // já que ir para "pronto para retirada" exige o fluxo de finalização (peças
  // concluídas), não um simples avanço.
  const activeStatusIndex = ACTIVE_SERVICE_ORDER_STATUSES.indexOf(order.status as (typeof ACTIVE_SERVICE_ORDER_STATUSES)[number]);
  const nextStatus: ServiceOrderStatus | null =
    activeStatusIndex >= 0 && activeStatusIndex < ACTIVE_SERVICE_ORDER_STATUSES.length - 2
      ? ACTIVE_SERVICE_ORDER_STATUSES[activeStatusIndex + 1]
      : null;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const trackingUrl = shareToken ? `${origin}/acompanhar/${shareToken}` : `${origin}/dashboard`;
  const whatsAppLink = isStaff && order.vehicle.owner ? buildWhatsAppLink(order.vehicle.owner.phone, statusUpdateMessage(order, trackingUrl)) : null;

  // Prévia da cobrança na entrega — mesma regra do backend (orderBillingTotal): problemas
  // com o componente concluído, exceto os reprovados, + valor extra; sem nenhum, o estimado.
  const doneWork = order.approvals
    .filter((a) => a.status !== "REJECTED" && order.parts.find((p) => p.id === a.partId)?.status === "DONE")
    .reduce((sum, a) => sum + (a.estimatedValue ?? 0), 0);
  const billingPreview = (doneWork || order.estimatedMin || 0) + (Number(finalizeForm.extraValue) || 0);
  const installmentsCount = Math.max(1, Number(finalizeForm.installments) || 1);
  const signatures = order.media.filter((m) => m.signatureKind);
  // PDF gerado na finalização (mídia mais recente primeiro) — reenvio manual pelo WhatsApp.
  const finishedPdf = order.media.find((m) => m.type === "DOCUMENT" && m.label === "PDF de finalização do serviço");
  const finishedPdfWhatsAppLink = finishedPdf
    ? buildWhatsAppLink(FINISHED_ORDER_WHATSAPP, finishedOrderMessage(order.vehicle, mediaUrl(finishedPdf.url)))
    : null;

  return (
    <div>
      <div className={styles.orderHeader}>
        <div>
          <h1>
            {order.vehicle.brand} {order.vehicle.model} {order.vehicle.year}
            {order.vehicle.engine ? ` · ${order.vehicle.engine}` : ""}
            {order.vehicle.plate ? ` · ${order.vehicle.plate}` : ""}
          </h1>
          <div className={styles.meta}>
            {order.code}
            {order.ssNumber ? ` · SS ${order.ssNumber}` : ""} · KM {order.vehicle.mileage.toLocaleString("pt-BR")}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isStaff && (
            <EditVehicleDialog
              vehicle={order.vehicle}
              // Mantém o dono já carregado (a rota de veículo não devolve o owner).
              onSaved={(vehicle) => setOrder((prev) => (prev ? { ...prev, vehicle: { ...prev.vehicle, ...vehicle, owner: prev.vehicle.owner } } : prev))}
            />
          )}
          {isStaff && (
            <EditSsNumberDialog orderId={order.id} ssNumber={order.ssNumber} onSaved={(ssNumber) => setOrder((prev) => (prev ? { ...prev, ssNumber } : prev))} />
          )}
          {isStaff && <ShareLinkDialog orderId={order.id} />}
          <span className={styles.live}>
            <i /> ATUALIZANDO AO VIVO
          </span>
        </div>
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
          {finishedPdfWhatsAppLink && (
            <a className={styles.btnApprove} href={finishedPdfWhatsAppLink} target="_blank" rel="noreferrer">
              Enviar PDF no WhatsApp
            </a>
          )}
          {isReady && !order.archivedAt && (
            <button className={styles.btnApprove} type="button" disabled={archiveBusy} onClick={archiveOrder}>
              {archiveBusy ? "Dando baixa..." : "Dar baixa no projeto"}
            </button>
          )}
          <Dialog open={deleteOpen} onOpenChange={handleDeleteDialogChange}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm" type="button">
                Excluir projeto
              </Button>
            </DialogTrigger>
            <DialogContent>
              {!deleteConfirmed ? (
                <>
                  <DialogHeader>
                    <DialogTitle>Excluir projeto {order.code}?</DialogTitle>
                    <DialogDescription>
                      {isFinishedOrder
                        ? "Isso apaga definitivamente o projeto e tudo ligado a ele: timeline, problemas, fotos, mensagens, notas fiscais, comissões, contas a receber e lançamentos financeiros. Não pode ser desfeito."
                        : "Isso apaga definitivamente a timeline, os problemas, aprovações, fotos e mensagens deste projeto. Não pode ser desfeito. Se o projeto em andamento já tem nota fiscal, comissão ou lançamento financeiro, a exclusão será recusada — use \"Dar baixa\" e exclua depois de finalizado."}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" onClick={() => setDeleteConfirmed(true)}>
                      Continuar
                    </Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Confirme digitando o código da OS</DialogTitle>
                    <DialogDescription>
                      Para confirmar, digite <strong>{order.code}</strong> abaixo. Esta é a última chance de
                      cancelar.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    value={deleteCode}
                    onChange={(e) => setDeleteCode(e.target.value)}
                    placeholder={order.code}
                    autoFocus
                  />
                  {deleteError && <div className={styles.formMessage}>{deleteError}</div>}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" disabled={deleteBusy || deleteCode !== order.code} onClick={deleteOrder}>
                      {deleteBusy ? "Excluindo..." : "Excluir definitivamente"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
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

      {isStaff && (
        <OrderAssigneesPanel
          orderId={order.id}
          assignees={order.assignees ?? []}
          isAdmin={isAdmin}
          onChange={(assignees) => setOrder((prev) => (prev ? { ...prev, assignees } : prev))}
        />
      )}

      {/* Checklist de entrada: visível em qualquer etapa, não só depois de finalizado. */}
      <DamagePhotosPanel
        orderId={order.id}
        photos={order.media.filter((m) => m.isDamagePhoto)}
        canAdd={isStaff && !isReady}
        onUploaded={(photos) => setOrder((prev) => (prev ? { ...prev, media: [...prev.media.filter((m) => !m.isDamagePhoto), ...photos] } : prev))}
      />

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

      <div className={styles.masonry} id="vehicle-timeline">
        <div className={styles.masonryCol}>
          {/* Modelo do veículo com acompanhamento dos problemas — em destaque, sempre no topo. */}
          <div className={`${styles.panel} ${isReady ? styles.panelReady : ""}`}>
            <h2>Modelo do veículo</h2>
            {isReady && <div className={styles.readyBanner}>Veículo pronto e em ótimo estado — pode retirar!</div>}
            {signatures.length > 0 && (
              <div style={{ marginBottom: "0.8rem" }}>
                <div className={styles.tlSub} style={{ marginBottom: "0.4rem" }}>
                  Assinaturas do cliente
                </div>
                <div className={styles.mediaGrid}>
                  {signatures.map((media) => (
                    <a key={media.id} href={mediaUrl(media.url)} target="_blank" rel="noreferrer" title={media.label ?? "Assinatura"}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={mediaUrl(media.url)} alt={media.label ?? "Assinatura"} style={{ background: "#fff", objectFit: "contain" }} />
                      <span className={styles.tlSub}>{media.signatureKind === "CHECKIN" ? "Entrada" : "Retirada"}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
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
              onCreatePart={isAdmin ? createInventoryPartRequest : undefined}
              onGeneratePdf={isAdmin ? generateServicePdf : undefined}
            />
            {canViewPrices && (
              <ProjectValuesPanel
                approvals={order.approvals}
                parts={order.parts}
                estimatedMin={order.estimatedMin}
                deliveryExtraValue={order.deliveryExtraValue}
                onUpdateLabor={isAdmin ? updateProblemLabor : undefined}
              />
            )}
            {isStaff && (
              <ServicePartsPanel
                approvals={order.approvals}
                parts={order.parts}
                canViewPrices={canViewPrices}
                canEdit={isAdmin}
                onUpdateUsage={updatePartUsage}
              />
            )}
            {isAdmin && isStaff && canFinalize && canOfferPickup && finalizing && (
              <div className={styles.panel}>
                <div className={styles.panelHeadRow}>
                  <h2>Confirmar entrega</h2>
                  <button
                    type="button"
                    className={styles.panelCloseBtn}
                    aria-label="Fechar formulário de finalização"
                    onClick={() => setFinalizing(false)}
                  >
                    <X className="size-4" />
                  </button>
                </div>
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

                  {/* Cobrança — vira conta a receber (Financeiro). A receita só entra no
                      resumo/fluxo de caixa quando for de fato recebida. */}
                  <div className={styles.fullField} style={{ fontWeight: 600, marginTop: "0.4rem" }}>
                    Cobrança: {formatCurrency(billingPreview)}
                    {installmentsCount > 1 && ` em ${installmentsCount}x de ${formatCurrency(billingPreview / installmentsCount)}`}
                  </div>
                  <label>
                    Forma de pagamento
                    <select
                      value={finalizeForm.paymentMethod}
                      onChange={(e) =>
                        setFinalizeForm((prev) => ({ ...prev, paymentMethod: e.target.value }))
                      }
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Parcelas
                    <select value={finalizeForm.installments} onChange={(e) => setFinalizeForm((prev) => ({ ...prev, installments: e.target.value }))}>
                      {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((n) => (
                        <option key={n} value={n}>
                          {n === "1" ? "À vista" : `${n}x`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {installmentsCount > 1 ? "Prazo da 1ª parcela" : "Prazo (opcional)"}
                    <input
                      type="date"
                      value={finalizeForm.firstDueDate}
                      onChange={(e) => setFinalizeForm((prev) => ({ ...prev, firstDueDate: e.target.value }))}
                    />
                  </label>
                  {bankAccounts.length > 0 && (
                    <label>
                      Conta de destino
                      <select value={finalizeForm.bankAccountId} onChange={(e) => setFinalizeForm((prev) => ({ ...prev, bankAccountId: e.target.value }))}>
                        <option value="">Não informar</option>
                        {bankAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className={`${styles.fullField} ${styles.tlSub}`}>
                    A cobrança fica pendente em Financeiro &gt; Contas a receber — marque como recebida lá (com a data e o
                    valor real, podendo dar desconto).
                  </div>

                  <div className={styles.fullField}>
                    <SignaturePad ref={deliverySignatureRef} label="Assinatura do cliente na retirada (opcional)" />
                  </div>

                  {finalizeError && <div className={`${styles.formMessage} ${styles.fullField}`}>{finalizeError}</div>}
                  <button className={styles.actionButton} type="submit" disabled={finalizeBusy}>
                    {finalizeBusy ? "Finalizando..." : "Confirmar entrega"}
                  </button>
                </form>
              </div>
            )}
          </div>

          {isStaff && (nextStatus || whatsAppLink || canFinalize) && (
            <div className={`${styles.panel} ${styles.approval}`}>
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
              {notifyPrompt && whatsAppLink && (
                <div className={styles.readyBanner} style={{ marginBottom: "0.8rem" }}>
                  Etapa atualizada para &quot;{STATUS_LABELS[order.status]}&quot;. Avise o cliente pelo WhatsApp — a mensagem já vai pronta.
                </div>
              )}
              <div className={styles.approvalActions}>
                {nextStatus && (
                  <button className={styles.btnApprove} disabled={advanceBusy} onClick={() => advanceStage(nextStatus)}>
                    {advanceBusy ? "Avançando..." : `Avançar para "${STATUS_LABELS[nextStatus]}"`}
                  </button>
                )}
                {canFinalize &&
                  (isAdmin ? (
                    <button className={styles.btnApprove} disabled={finalizing} onClick={handleFinalizeClick}>
                      {finalizing ? "Preencha a entrega abaixo, junto ao modelo do veículo" : "Finalizar projeto"}
                    </button>
                  ) : (
                    <button className={styles.btnApprove} type="button" disabled>
                      Aguardando admin liberar retirada
                    </button>
                  ))}
                {whatsAppLink ? (
                  <a className={styles.btnApprove} href={whatsAppLink} target="_blank" rel="noreferrer" onClick={() => setNotifyPrompt(false)}>
                    Avisar cliente (WhatsApp)
                  </a>
                ) : (
                  <span className={styles.tlSub}>Cliente sem telefone cadastrado.</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.masonryCol}>
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
                        <option value="ambos">Ambos os lados</option>
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
                    {/* Várias peças no mesmo problema — cada linha com quantidade e "×" para tirar. */}
                    <div className={styles.fullField} style={{ display: "grid", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}>
                        Peças utilizadas
                      </span>
                      {problemUsages.map((usage, index) => (
                        <div key={index} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                          <select
                            aria-label={`Peça ${index + 1}`}
                            style={{ flex: "1 1 12rem", minWidth: 0 }}
                            value={usage.inventoryPartId}
                            onChange={(e) =>
                              setProblemUsages((prev) => prev.map((u, i) => (i === index ? { ...u, inventoryPartId: e.target.value } : u)))
                            }
                          >
                            <option value="">Nenhuma peça</option>
                            {inventoryParts.filter((part) => part.active).map((part) => (
                              <option key={part.id} value={part.id}>
                                {part.name} · R$ {part.unitCost.toFixed(2)}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            aria-label={`Quantidade da peça ${index + 1}`}
                            style={{ width: "4.5rem" }}
                            value={usage.quantity}
                            onChange={(e) => setProblemUsages((prev) => prev.map((u, i) => (i === index ? { ...u, quantity: e.target.value } : u)))}
                          />
                          <button
                            type="button"
                            className={styles.btnReject}
                            aria-label={`Remover peça ${index + 1}`}
                            onClick={() =>
                              setProblemUsages((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : [{ inventoryPartId: "", quantity: "1" }]))
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className={styles.linkButton}
                        style={{ justifySelf: "start" }}
                        onClick={() => setProblemUsages((prev) => [...prev, { inventoryPartId: "", quantity: "1" }])}
                      >
                        + Adicionar outra peça
                      </button>
                    </div>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => {
                        setNewPartError(null);
                        setNewPartOpen((prev) => !prev);
                      }}
                    >
                      {newPartOpen ? "Cancelar peça nova" : "+ Peça não está na lista? Cadastrar nova"}
                    </button>
                    {newPartOpen && (
                      <div className={styles.inlineSubform}>
                        <label>
                          Nome da peça
                          <input
                            value={newPartForm.name}
                            onChange={(e) => setNewPartForm((prev) => ({ ...prev, name: e.target.value }))}
                          />
                        </label>
                        <label>
                          Preço (R$)
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={newPartForm.unitCost}
                            onChange={(e) => setNewPartForm((prev) => ({ ...prev, unitCost: e.target.value }))}
                          />
                        </label>
                        {newPartError && <div className={styles.formMessage}>{newPartError}</div>}
                        <button
                          type="button"
                          className={styles.actionButton}
                          disabled={newPartBusy}
                          onClick={createInventoryPart}
                        >
                          {newPartBusy ? "Salvando..." : "Salvar peça"}
                        </button>
                      </div>
                    )}
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
                    {inventoryParts.filter((part) => part.active).map((part) => (
                      <option key={part.id} value={part.id}>
                        {part.name} · R$ {part.unitCost.toFixed(2)}
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

          <div className={styles.panel}>
            <h2>Timeline da manutenção</h2>
            <Timeline events={order.timelineEvents} justArrivedId={justArrivedId} canViewPrices={canViewPrices} />
          </div>
        </div>
      </div>

    </div>
  );
}
