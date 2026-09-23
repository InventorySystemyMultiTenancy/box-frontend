"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinStaffRoom } from "@/lib/socket";
import { PRIORITY_BG, PRIORITY_BORDER, PRIORITY_LABELS, PRIORITY_RANK, STATUS_LABELS, STATUS_TONE, ServiceOrder, ServiceOrderStatus } from "@/lib/types";
import OrderDetail from "@/components/dashboard/OrderDetail";
import KanbanBoard from "@/components/dashboard/KanbanBoard";
import { NewProjectDialog } from "@/components/dashboard/NewProjectDialog";
import { Button } from "@/components/ui/button";
import { Plus, ClipboardList, CheckCircle2, AlertTriangle, Wrench, Car, ArrowLeft, Archive } from "lucide-react";
import styles from "./dashboard.module.css";

const DONE_STATUSES = new Set<ServiceOrderStatus>(["FINISHED", "READY_FOR_PICKUP"]);

function sortByPriority(orders: ServiceOrder[]) {
  return [...orders].sort((a, b) => PRIORITY_RANK[b.priority ?? "NORMAL"] - PRIORITY_RANK[a.priority ?? "NORMAL"]);
}

// Resumo abaixo do kanban/lista — sempre calculado a partir dos projetos em
// andamento carregados (não conta ordens arquivadas, já excluídas pela API).
function ProjectsSummary({ orders }: { orders: ServiceOrder[] }) {
  const total = orders.length;
  const done = orders.filter((o) => DONE_STATUSES.has(o.status)).length;
  const active = total - done;
  const urgent = orders.filter((o) => o.priority === "URGENT").length;
  const inRepair = orders.filter((o) => o.status === "IN_PROGRESS").length;

  const cards = [
    { icon: ClipboardList, value: active, label: "Total em andamento", wrap: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300" },
    { icon: CheckCircle2, value: done, label: "Concluídos", wrap: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300" },
    { icon: AlertTriangle, value: urgent, label: "Urgentes", wrap: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300" },
    { icon: Wrench, value: inRepair, label: "Em reparação", wrap: "bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300" },
    { icon: Car, value: total, label: "Total de projetos", wrap: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300" },
  ];

  return (
    <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
      {cards.map((c) => (
        <div key={c.label} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
          <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${c.wrap}`}>
            <c.icon className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="text-lg font-bold leading-tight">{c.value}</div>
            <div className="truncate text-xs text-muted-foreground">{c.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lista de todos os projetos (carros) em andamento — o mecânico escolhe um para gerenciar. */
export default function MechanicProjectsPanel() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get("order"));
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [showArchived, setShowArchived] = useState(false);
  const [archivedOrders, setArchivedOrders] = useState<ServiceOrder[] | null>(null);
  const [loadingArchived, setLoadingArchived] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.serviceOrders(token).then(({ orders }) => setOrders(orders as ServiceOrder[]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    joinStaffRoom(token);
    const socket = getSocket();

    function onOrderNew(payload: { order: ServiceOrder }) {
      setOrders((prev) => (prev.some((o) => o.id === payload.order.id) ? prev : [payload.order, ...prev]));
    }
    function onStatusUpdate(payload: { orderId: string; status: ServiceOrderStatus; progress: number }) {
      setOrders((prev) => prev.map((o) => (o.id === payload.orderId ? { ...o, status: payload.status, progress: payload.progress } : o)));
    }
    // Baixa dada em outra aba/usuário — some da lista/kanban de projetos em andamento
    // (o registro continua acessível normalmente por fora deste painel).
    function onOrderArchived(payload: { orderId: string }) {
      setOrders((prev) => prev.filter((o) => o.id !== payload.orderId));
    }

    socket.on("service-order:new", onOrderNew);
    socket.on("status:update", onStatusUpdate);
    socket.on("service-order:archived", onOrderArchived);
    return () => {
      socket.off("service-order:new", onOrderNew);
      socket.off("status:update", onStatusUpdate);
      socket.off("service-order:archived", onOrderArchived);
    };
  }, [token]);

  function handleStatusChanged(orderId: string, status: ServiceOrderStatus) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  }

  function handleOrderDeleted() {
    setOrders((prev) => prev.filter((o) => o.id !== selectedOrderId));
    setSelectedOrderId(null);
  }

  function handleProjectCreated(orderId: string) {
    if (token) api.serviceOrders(token).then(({ orders }) => setOrders(orders as ServiceOrder[]));
    setSelectedOrderId(orderId);
  }

  function toggleArchived() {
    const next = !showArchived;
    setShowArchived(next);
    if (next && token) {
      setLoadingArchived(true);
      api
        .serviceOrders(token, { includeArchived: true })
        .then(({ orders: all }) => {
          const list = (all as ServiceOrder[]).filter((o) => o.archivedAt || DONE_STATUSES.has(o.status));
          setArchivedOrders(list);
        })
        .finally(() => setLoadingArchived(false));
    }
  }

  const sortedActiveOrders = useMemo(() => sortByPriority(orders), [orders]);

  if (selectedOrderId) {
    return (
      <div className={`${styles.content} ${styles.projectDetailView}`}>
        <Button
          variant="outline"
          size="lg"
          className={styles.backToProjectsBtn}
          onClick={() => setSelectedOrderId(null)}
          aria-label="Voltar para Projetos em andamento"
        >
          <ArrowLeft className="size-5" />
          Voltar
        </Button>
        <OrderDetail key={selectedOrderId} orderId={selectedOrderId} scrollToTimelineOnLoad onDeleted={handleOrderDeleted} />
      </div>
    );
  }

  if (showArchived) {
    return (
      <div className={styles.content}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className={styles.sectionTitle} style={{ marginBottom: 0 }}>
            Projetos finalizados e com baixa dada
          </div>
          <Button variant="ghost" size="sm" onClick={toggleArchived}>
            <ArrowLeft className="size-4" />
            Voltar para projetos em andamento
          </Button>
        </div>

        {loadingArchived && <p className={styles.tlSub}>Carregando...</p>}
        {!loadingArchived && (archivedOrders?.length ?? 0) === 0 && (
          <p className={styles.tlSub}>Nenhum projeto finalizado ou com baixa dada ainda.</p>
        )}
        {!loadingArchived && archivedOrders && archivedOrders.length > 0 && (
          <div className={styles.ordersList}>
            {archivedOrders.map((order) => (
              <button key={order.id} className={styles.orderRow} onClick={() => setSelectedOrderId(order.id)}>
                <div className={styles.orderRowInfo}>
                  <strong>
                    {order.vehicle.brand} {order.vehicle.model} {order.vehicle.year}
                  </strong>
                  <span>{order.code}</span>
                </div>
                <span className={`${styles.badge} ${styles[`tone-${STATUS_TONE[order.status]}`]}`}>
                  <i className={styles.dot} />
                  {order.archivedAt ? "Baixa dada" : STATUS_LABELS[order.status]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.content}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className={styles.sectionTitle} style={{ marginBottom: 0 }}>
          Projetos em andamento
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {user?.role === "ADMIN" && (
            <NewProjectDialog
              onCreated={handleProjectCreated}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  Novo projeto
                </Button>
              }
            />
          )}
          <div className="inline-flex rounded-md border p-0.5 text-sm">
            <button
              type="button"
              className={`rounded px-3 py-1 ${view === "kanban" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setView("kanban")}
            >
              Kanban
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setView("list")}
            >
              Lista
            </button>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={toggleArchived}>
            <Archive className="size-4" />
            Ver finalizados
          </Button>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className={styles.tlSub}>Nenhuma ordem de serviço cadastrada ainda.</p>
      ) : view === "kanban" ? (
        <KanbanBoard
          orders={orders}
          selectedOrderId={selectedOrderId}
          onSelect={setSelectedOrderId}
          onStatusChanged={handleStatusChanged}
        />
      ) : (
        <div className={styles.ordersList}>
          {sortedActiveOrders.map((order) => {
            const priority = order.priority ?? "NORMAL";
            return (
              <button
                key={order.id}
                className={styles.orderRow}
                style={{ background: PRIORITY_BG[priority], borderLeft: `4px solid ${PRIORITY_BORDER[priority]}` }}
                onClick={() => setSelectedOrderId(order.id)}
              >
                <div className={styles.orderRowInfo}>
                  <strong>
                    {order.vehicle.brand} {order.vehicle.model} {order.vehicle.year}
                  </strong>
                  <span>{order.code}</span>
                </div>
                <div className="flex items-center gap-2">
                  {priority !== "NORMAL" && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{ background: PRIORITY_BORDER[priority] + "22", color: PRIORITY_BORDER[priority] }}
                    >
                      {PRIORITY_LABELS[priority]}
                    </span>
                  )}
                  <span className={`${styles.badge} ${styles[`tone-${STATUS_TONE[order.status]}`]}`}>
                    <i className={styles.dot} />
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {orders.length > 0 && <ProjectsSummary orders={orders} />}
    </div>
  );
}
