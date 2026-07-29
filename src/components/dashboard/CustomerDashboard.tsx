"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinUserRoom } from "@/lib/socket";
import { QuoteRequest, ServiceOrder } from "@/lib/types";
import OrderDetail from "@/components/dashboard/OrderDetail";
import QuoteRequestStatusCard from "@/components/dashboard/QuoteRequestStatusCard";
import RequestQuoteForm from "@/components/dashboard/RequestQuoteForm";
import styles from "./dashboard.module.css";

const ACTIVE_ORDER_STATUSES_EXCLUDED = ["FINISHED", "READY_FOR_PICKUP"];

export default function CustomerDashboard() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[] | null>(null);
  const [requests, setRequests] = useState<QuoteRequest[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadOrders = useCallback(() => {
    if (!token) return;
    api.serviceOrders(token).then(({ orders }) => setOrders(orders as ServiceOrder[]));
  }, [token]);

  const loadRequests = useCallback(() => {
    if (!token) return;
    api.quoteRequests(token).then(({ requests }) => setRequests(requests as QuoteRequest[]));
  }, [token]);

  useEffect(() => {
    loadOrders();
    loadRequests();
  }, [loadOrders, loadRequests]);

  useEffect(() => {
    if (!token) return;
    joinUserRoom(token);
    const socket = getSocket();

    function onUpdate(payload: { request: QuoteRequest }) {
      setRequests((prev) => {
        if (!prev) return [payload.request];
        const exists = prev.some((r) => r.id === payload.request.id);
        return exists ? prev.map((r) => (r.id === payload.request.id ? payload.request : r)) : [payload.request, ...prev];
      });
      if (payload.request.status === "ACCEPTED") loadOrders();
    }

    socket.on("quote-request:update", onUpdate);
    return () => {
      socket.off("quote-request:update", onUpdate);
    };
  }, [token, loadOrders]);

  if (orders === null || requests === null) {
    return <div className={styles.empty}>Carregando painel...</div>;
  }

  const activeOrder = orders.find((o) => !ACTIVE_ORDER_STATUSES_EXCLUDED.includes(o.status));
  const pendingRequest = requests.find((r) => r.status === "PENDING");
  const lastRequest = requests[0];

  if (activeOrder) {
    return (
      <div className={styles.content}>
        <OrderDetail key={activeOrder.id} orderId={activeOrder.id} />
      </div>
    );
  }

  return (
    <div className={styles.content}>
      {pendingRequest ? (
        <QuoteRequestStatusCard request={pendingRequest} />
      ) : lastRequest?.status === "DECLINED" && !showForm ? (
        <QuoteRequestStatusCard request={lastRequest} onRetry={() => setShowForm(true)} />
      ) : (
        <RequestQuoteForm
          onCreated={() => {
            setShowForm(false);
            loadRequests();
          }}
        />
      )}
    </div>
  );
}
