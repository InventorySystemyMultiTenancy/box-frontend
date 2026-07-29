"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { getSocket, joinOrderRoom } from "@/lib/socket";
import { Approval, ServiceOrder, ServiceOrderStatus, STATUS_LABELS, TimelineEvent, VehiclePart } from "@/lib/types";
import StatusStrip from "@/components/dashboard/StatusStrip";
import Timeline from "@/components/dashboard/Timeline";
import VehicleSchematic from "@/components/dashboard/VehicleSchematic";
import ApprovalCard from "@/components/dashboard/ApprovalCard";
import styles from "@/components/dashboard/dashboard.module.css";

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

export default function DashboardPage() {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [justArrivedId, setJustArrivedId] = useState<string | null>(null);
  const [problemForm, setProblemForm] = useState({
    key: "motor",
    name: "Motor",
    description: "",
    wearLevel: "",
    estimatedValue: "",
    files: [] as File[],
  });
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "CUSTOMER" as "CUSTOMER" | "MECHANIC",
  });
  const [problemMessage, setProblemMessage] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [problemBusy, setProblemBusy] = useState(false);
  const [userBusy, setUserBusy] = useState(false);

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

  const isStaff = user?.role === "MECHANIC" || user?.role === "ADMIN";

  async function createProblem(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !order) return;
    setProblemBusy(true);
    setProblemMessage(null);
    try {
      const result = await api.createProblem(order.id, problemForm, token);
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
      setProblemForm((prev) => ({ ...prev, description: "", wearLevel: "", estimatedValue: "", files: [] }));
      setProblemMessage("Problema identificado cadastrado.");
    } catch {
      setProblemMessage("Não foi possível cadastrar o problema.");
    } finally {
      setProblemBusy(false);
    }
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
                  <ApprovalCard
                    approval={pendingApproval}
                    onRespond={(status, responseNote) => respondApproval(pendingApproval.id, status, responseNote)}
                  />
                )}

                {isStaff && (
                  <div className={styles.panel}>
                    <h2>Novo problema identificado</h2>
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
                      <label>
                        Valor estimado
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={problemForm.estimatedValue}
                          onChange={(e) => setProblemForm((prev) => ({ ...prev, estimatedValue: e.target.value }))}
                        />
                      </label>
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

                <div className={styles.panel}>
                  <h2>Modelo do veículo</h2>
                  <VehicleSchematic
                    parts={order.parts}
                    approvals={order.approvals}
                    canRespond={user?.role === "CUSTOMER"}
                    onRespondApproval={respondApproval}
                  />
                </div>

                {isStaff && (
                  <div className={styles.panel}>
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
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
