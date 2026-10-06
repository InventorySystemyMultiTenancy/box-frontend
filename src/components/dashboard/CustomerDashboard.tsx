"use client";

import { useCallback, useEffect, useState } from "react";
import { History, Plus, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinUserRoom } from "@/lib/socket";
import { QuoteRequest, ServiceOrder, STATUS_LABELS } from "@/lib/types";
import OrderDetail from "@/components/dashboard/OrderDetail";
import QuoteRequestStatusCard from "@/components/dashboard/QuoteRequestStatusCard";
import RequestQuoteForm from "@/components/dashboard/RequestQuoteForm";
import styles from "./dashboard.module.css";

// Em andamento = tudo que a oficina ainda não deu baixa — inclusive "Finalizado" e "Pronto
// para retirada", justamente quando o cliente mais precisa ver o carro (antes essas duas
// etapas sumiam e ele caía no formulário de novo orçamento).
function isOngoing(order: ServiceOrder) {
  return !order.archivedAt;
}

function vehicleLabel(order: ServiceOrder) {
  return `${order.vehicle.brand} ${order.vehicle.model}${order.vehicle.plate ? ` · ${order.vehicle.plate}` : ""}`;
}

export default function CustomerDashboard() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<ServiceOrder[] | null>(null);
  const [requests, setRequests] = useState<QuoteRequest[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"current" | "history">("current");

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
    socket.on("service-order:archived", loadOrders);
    return () => {
      socket.off("quote-request:update", onUpdate);
      socket.off("service-order:archived", loadOrders);
    };
  }, [token, loadOrders]);

  if (orders === null || requests === null) {
    return <div className={styles.empty}>Carregando painel...</div>;
  }

  const ongoing = orders.filter(isOngoing);
  const history = orders.filter((o) => !isOngoing(o));
  const pendingRequest = requests.find((r) => r.status === "PENDING");
  const lastRequest = requests[0];

  const quoteArea = pendingRequest ? (
    <QuoteRequestStatusCard request={pendingRequest} />
  ) : lastRequest?.status === "DECLINED" && !showForm && ongoing.length === 0 ? (
    <QuoteRequestStatusCard request={lastRequest} onRetry={() => setShowForm(true)} />
  ) : (
    <RequestQuoteForm
      onCreated={() => {
        setShowForm(false);
        loadRequests();
      }}
    />
  );

  // Histórico: lista dos serviços já encerrados; clicar abre o projeto completo (fotos,
  // timeline, valores, garantia) em modo leitura.
  if (view === "history") {
    const opened = history.find((o) => o.id === selectedId);
    return (
      <div className={styles.content}>
        <button type="button" className={styles.linkButton} onClick={() => (opened ? setSelectedId(null) : setView("current"))}>
          <ArrowLeft size={14} /> {opened ? "Voltar ao histórico" : "Voltar"}
        </button>
        {opened ? (
          <OrderDetail key={opened.id} orderId={opened.id} />
        ) : (
          <>
            <div className={styles.sectionTitle}>Serviços anteriores ({history.length})</div>
            {history.length === 0 && <p className={styles.tlSub}>Nenhum serviço concluído ainda.</p>}
            <div className={styles.panel}>
              {history.map((order) => (
                <button key={order.id} type="button" className={styles.historyRow} onClick={() => setSelectedId(order.id)}>
                  <strong>{vehicleLabel(order)}</strong>
                  <span>{order.code}</span>
                  <span>
                    {order.completedAt ? `Entregue em ${new Date(order.completedAt).toLocaleDateString("pt-BR")}` : STATUS_LABELS[order.status]}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  const current = ongoing.find((o) => o.id === selectedId) ?? ongoing[0];

  return (
    <div className={styles.content}>
      {(history.length > 0 || ongoing.length > 0) && (
        <div className={styles.customerToolbar}>
          {ongoing.length > 1 &&
            ongoing.map((order) => (
              <button
                key={order.id}
                type="button"
                className={`${styles.tab} ${order.id === current?.id ? styles.tabActive : ""}`}
                onClick={() => setSelectedId(order.id)}
              >
                {vehicleLabel(order)}
              </button>
            ))}
          <span style={{ flex: 1 }} />
          {ongoing.length > 0 && !pendingRequest && (
            <button type="button" className={styles.linkButton} onClick={() => setShowForm((v) => !v)}>
              <Plus size={14} /> {showForm ? "Fechar pedido de orçamento" : "Pedir orçamento para outro problema"}
            </button>
          )}
          {history.length > 0 && (
            <button type="button" className={styles.linkButton} onClick={() => { setSelectedId(null); setView("history"); }}>
              <History size={14} /> Meus serviços anteriores
            </button>
          )}
        </div>
      )}

      {current ? (
        <>
          {(showForm || pendingRequest) && quoteArea}
          <OrderDetail key={current.id} orderId={current.id} />
        </>
      ) : (
        quoteArea
      )}
    </div>
  );
}
