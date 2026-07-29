"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinOrderRoom } from "@/lib/socket";
import { ServiceOrder, ServiceOrderStatus, STATUS_LABELS, TimelineEvent, VehiclePart, Approval } from "@/lib/types";
import StatusStrip from "@/components/dashboard/StatusStrip";
import Timeline from "@/components/dashboard/Timeline";
import VehicleSchematic from "@/components/dashboard/VehicleSchematic";
import ApprovalCard from "@/components/dashboard/ApprovalCard";
import styles from "@/components/dashboard/dashboard.module.css";

export default function DashboardPage() {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !token) router.replace("/login");
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;
    api
      .serviceOrders(token)
      .then(({ orders }) => setOrder((orders as ServiceOrder[])[0] ?? null))
      .catch(() => setFetchError("Não foi possível carregar sua ordem de serviço."));
  }, [token]);

  const orderId = order?.id;

  useEffect(() => {
    if (!token || !orderId) return;
    joinOrderRoom(orderId, token);
    const socket = getSocket();

    function onStatus(payload: { orderId: string; status: ServiceOrderStatus; progress: number }) {
      setOrder((prev) => (prev && prev.id === payload.orderId ? { ...prev, status: payload.status, progress: payload.progress } : prev));
    }
    function onTimeline(payload: { event: TimelineEvent }) {
      setJustArrivedId(payload.event.id);
      setOrder((prev) => (prev ? { ...prev, timelineEvents: [...prev.timelineEvents, payload.event] } : prev));
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
      setOrder((prev) => (prev ? { ...prev, approvals: [payload.approval, ...prev.approvals] } : prev));
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
    async (approvalId: string, status: "APPROVED" | "REJECTED") => {
      if (!token || !order) return;
      await api.respondApproval(order.id, approvalId, status, token);
    },
    [token, order]
  );

  if (loading || (!order && !fetchError)) {
    return <div className={styles.empty}>Carregando painel...</div>;
  }

  const pendingApproval = order?.approvals.find((a) => a.status === "PENDING");

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.brand}>BOX.</span>
        <div className={styles.topbarRight}>
          {user && <span>{user.name}</span>}
          <button className={styles.logout} onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      <div className={styles.content}>
        {fetchError && <div className={styles.empty}>{fetchError}</div>}

        {order && (
          <>
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

            <div className={styles.columns}>
              <div className={styles.panel}>
                <h2>Timeline da manutenção</h2>
                <Timeline events={order.timelineEvents} justArrivedId={justArrivedId} />
              </div>

              <div>
                {pendingApproval && (
                  <ApprovalCard approval={pendingApproval} onRespond={(status) => respondApproval(pendingApproval.id, status)} />
                )}
                <div className={styles.panel}>
                  <h2>Modelo do veículo</h2>
                  <VehicleSchematic parts={order.parts} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
