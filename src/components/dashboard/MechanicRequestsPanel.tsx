"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinStaffRoom } from "@/lib/socket";
import { QuoteRequest } from "@/lib/types";
import QuoteRequestQueueCard from "@/components/dashboard/QuoteRequestQueueCard";
import styles from "./dashboard.module.css";

/** Fila de solicitações de orçamento — o mecânico aceita (agenda) ou recusa. */
export default function MechanicRequestsPanel() {
  const { token } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<QuoteRequest[]>([]);

  useEffect(() => {
    if (!token) return;
    api.quoteRequests(token, "PENDING").then(({ requests }) => setPendingRequests(requests as QuoteRequest[]));
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

    socket.on("quote-request:new", onRequestNew);
    socket.on("quote-request:update", onRequestUpdate);
    return () => {
      socket.off("quote-request:new", onRequestNew);
      socket.off("quote-request:update", onRequestUpdate);
    };
  }, [token]);

  async function acceptRequest(request: QuoteRequest, scheduledAt: string, initialValue?: number) {
    if (!token) return;
    await api.acceptQuoteRequest(request.id, { scheduledAt, initialValue }, token);
    setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
  }

  async function declineRequest(request: QuoteRequest, reason?: string) {
    if (!token) return;
    await api.declineQuoteRequest(request.id, { declineReason: reason }, token);
    setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
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
    </div>
  );
}
