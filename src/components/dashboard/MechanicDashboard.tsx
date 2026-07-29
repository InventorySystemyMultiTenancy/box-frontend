"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinStaffRoom } from "@/lib/socket";
import { QuoteRequest, STATUS_LABELS, STATUS_TONE, ServiceOrder, ServiceOrderStatus } from "@/lib/types";
import OrderDetail from "@/components/dashboard/OrderDetail";
import QuoteRequestQueueCard from "@/components/dashboard/QuoteRequestQueueCard";
import styles from "./dashboard.module.css";

export default function MechanicDashboard() {
  const { token } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<QuoteRequest[]>([]);
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", phone: "", role: "CUSTOMER" as "CUSTOMER" | "MECHANIC" });
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userBusy, setUserBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.quoteRequests(token, "PENDING").then(({ requests }) => setPendingRequests(requests as QuoteRequest[]));
    api.serviceOrders(token).then(({ orders }) => setOrders(orders as ServiceOrder[]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    joinStaffRoom(token);
    const socket = getSocket();

    function onRequestNew(payload: { request: QuoteRequest }) {
      setPendingRequests((prev) => (prev.some((r) => r.id === payload.request.id) ? prev : [payload.request, ...prev]));
    }
    function onRequestUpdate(payload: { request: QuoteRequest }) {
      setPendingRequests((prev) => (payload.request.status === "PENDING" ? prev : prev.filter((r) => r.id !== payload.request.id)));
    }
    function onOrderNew(payload: { order: ServiceOrder }) {
      setOrders((prev) => (prev.some((o) => o.id === payload.order.id) ? prev : [payload.order, ...prev]));
    }
    function onStatusUpdate(payload: { orderId: string; status: ServiceOrderStatus; progress: number }) {
      setOrders((prev) => prev.map((o) => (o.id === payload.orderId ? { ...o, status: payload.status, progress: payload.progress } : o)));
    }

    socket.on("quote-request:new", onRequestNew);
    socket.on("quote-request:update", onRequestUpdate);
    socket.on("service-order:new", onOrderNew);
    socket.on("status:update", onStatusUpdate);
    return () => {
      socket.off("quote-request:new", onRequestNew);
      socket.off("quote-request:update", onRequestUpdate);
      socket.off("service-order:new", onOrderNew);
      socket.off("status:update", onStatusUpdate);
    };
  }, [token]);

  async function acceptRequest(request: QuoteRequest, scheduledAt: string, initialValue?: number) {
    if (!token) return;
    const { request: updated } = await api.acceptQuoteRequest(request.id, { scheduledAt, initialValue }, token);
    setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
    const withOrder = updated as QuoteRequest;
    if (withOrder.serviceOrder) {
      api.serviceOrder(withOrder.serviceOrder.id, token).then(({ order }) => {
        setOrders((prev) => [order as ServiceOrder, ...prev]);
      });
    }
  }

  async function declineRequest(request: QuoteRequest, reason?: string) {
    if (!token) return;
    await api.declineQuoteRequest(request.id, { declineReason: reason }, token);
    setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setUserBusy(true);
    setUserMessage(null);
    try {
      const { user: created } = await api.createUser({ ...userForm, phone: userForm.phone || undefined }, token);
      setUserForm({ name: "", email: "", password: "", phone: "", role: "CUSTOMER" });
      setUserMessage(`${created.name} criado como ${created.role === "MECHANIC" ? "mecânico" : "cliente"}.`);
    } catch {
      setUserMessage("Não foi possível criar o usuário.");
    } finally {
      setUserBusy(false);
    }
  }

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>Solicitações de orçamento pendentes</div>
      {pendingRequests.length === 0 ? (
        <p className={styles.tlSub}>Nenhuma solicitação aguardando resposta.</p>
      ) : (
        <div className={styles.queueGrid}>
          {pendingRequests.map((request) => (
            <QuoteRequestQueueCard
              key={request.id}
              request={request}
              onAccept={(scheduledAt, initialValue) => acceptRequest(request, scheduledAt, initialValue)}
              onDecline={(reason) => declineRequest(request, reason)}
            />
          ))}
        </div>
      )}

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

      <div className={styles.panel} style={{ marginTop: "2.2rem" }}>
        <h2>Criar usuário</h2>
        <form className={styles.formGrid} onSubmit={createUser}>
          <label>
            Nome
            <input value={userForm.name} onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={userForm.email}
              onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              minLength={6}
              value={userForm.password}
              onChange={(e) => setUserForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </label>
          <label>
            Telefone
            <input value={userForm.phone} onChange={(e) => setUserForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </label>
          <label className={styles.fullField}>
            Perfil
            <select
              value={userForm.role}
              onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value as "CUSTOMER" | "MECHANIC" }))}
            >
              <option value="CUSTOMER">Cliente</option>
              <option value="MECHANIC">Mecânico</option>
            </select>
          </label>
          {userMessage && <div className={styles.formMessage}>{userMessage}</div>}
          <button className={styles.actionButton} type="submit" disabled={userBusy}>
            {userBusy ? "Criando..." : "Criar usuário"}
          </button>
        </form>
      </div>
    </div>
  );
}
