"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinStaffRoom } from "@/lib/socket";
import { STATUS_LABELS, STATUS_TONE, ServiceOrder, ServiceOrderStatus } from "@/lib/types";
import OrderDetail from "@/components/dashboard/OrderDetail";
import styles from "./dashboard.module.css";

/** Lista de todos os projetos (carros) em andamento — o mecânico escolhe um para gerenciar. */
export default function MechanicProjectsPanel() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

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

    socket.on("service-order:new", onOrderNew);
    socket.on("status:update", onStatusUpdate);
    return () => {
      socket.off("service-order:new", onOrderNew);
      socket.off("status:update", onStatusUpdate);
    };
  }, [token]);

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>Projetos em andamento</div>
      {orders.length === 0 ? (
        <p className={styles.tlSub}>Nenhuma ordem de serviço cadastrada ainda.</p>
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
