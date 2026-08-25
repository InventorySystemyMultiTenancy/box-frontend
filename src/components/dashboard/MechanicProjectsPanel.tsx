"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinStaffRoom } from "@/lib/socket";
import { STATUS_LABELS, STATUS_TONE, ServiceOrder, ServiceOrderStatus } from "@/lib/types";
import OrderDetail from "@/components/dashboard/OrderDetail";
import KanbanBoard from "@/components/dashboard/KanbanBoard";
import { NewProjectDialog } from "@/components/dashboard/NewProjectDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import styles from "./dashboard.module.css";

/** Lista de todos os projetos (carros) em andamento — o mecânico escolhe um para gerenciar. */
export default function MechanicProjectsPanel() {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(searchParams.get("order"));
  const [view, setView] = useState<"kanban" | "list">("kanban");

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

  function handleProjectCreated(orderId: string) {
    if (token) api.serviceOrders(token).then(({ orders }) => setOrders(orders as ServiceOrder[]));
    setSelectedOrderId(orderId);
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
          {orders.map((order) => (
            <button
              key={order.id}
              className={`${styles.orderRow} ${order.id === selectedOrderId ? styles.orderRowActive : ""}`}
              onClick={() => setSelectedOrderId(order.id)}
            >
              <div className={styles.orderRowInfo}>
                <strong>
                  {order.vehicle.brand} {order.vehicle.model} {order.vehicle.year}
                </strong>
                <span>{order.code}</span>
              </div>
              <span className={`${styles.badge} ${styles[`tone-${STATUS_TONE[order.status]}`]}`}>
                <i className={styles.dot} />
                {STATUS_LABELS[order.status]}
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedOrderId && (
        <div className={styles.detailWrap}>
          <OrderDetail key={selectedOrderId} orderId={selectedOrderId} />
        </div>
      )}
    </div>
  );
}
