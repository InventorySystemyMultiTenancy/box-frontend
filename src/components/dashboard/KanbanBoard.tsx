"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  SERVICE_ORDER_STATUSES,
  STATUS_LABELS,
  STATUS_TONE,
  PRIORITY_LABELS,
  ServiceOrder,
  ServiceOrderStatus,
} from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const TONE_CLASSES: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  ok: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

const PRIORITY_CLASSES: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-muted text-muted-foreground",
  HIGH: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  URGENT: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

// Distância mínima (px) antes de um toque/clique virar arraste — evita competir
// com o tap que abre a ficha do veículo.
const DRAG_THRESHOLD = 8;

function daysSince(iso?: string) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

interface KanbanBoardProps {
  orders: ServiceOrder[];
  selectedOrderId: string | null;
  onSelect: (orderId: string) => void;
  onStatusChanged: (orderId: string, status: ServiceOrderStatus) => void;
}

interface DragState {
  pointerId: number;
  orderId: string;
  startX: number;
  startY: number;
  dragging: boolean;
}

export default function KanbanBoard({ orders, selectedOrderId, onSelect, onStatusChanged }: KanbanBoardProps) {
  const { token } = useAuth();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<ServiceOrderStatus | null>(null);
  const columnRefs = useRef(new Map<ServiceOrderStatus, HTMLDivElement | null>());
  const dragState = useRef<DragState | null>(null);

  const columns = useMemo(() => {
    const byStatus = new Map<ServiceOrderStatus, ServiceOrder[]>();
    for (const status of SERVICE_ORDER_STATUSES) byStatus.set(status, []);
    for (const order of orders) {
      const list = byStatus.get(order.status);
      if (list) list.push(order);
    }
    return SERVICE_ORDER_STATUSES.map((status) => ({ status, orders: byStatus.get(status) ?? [] }));
  }, [orders]);

  function statusAtPoint(x: number, y: number): ServiceOrderStatus | null {
    for (const [status, el] of columnRefs.current) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return status;
    }
    return null;
  }

  async function commitDrop(orderId: string, status: ServiceOrderStatus) {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === status || !token) return;

    if (status === "READY_FOR_PICKUP") {
      toast.error("Para marcar como pronto para retirada, finalize a OS na ficha do veículo.");
      return;
    }

    try {
      await api.updateOrderStatus(orderId, status, token);
      onStatusChanged(orderId, status);
      toast.success(`${order.code} movido para "${STATUS_LABELS[status]}".`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível mover a ordem de serviço.");
    }
  }

  // Pointer Events unificam mouse, toque e caneta — o mesmo código arrasta com o
  // dedo no celular e com o mouse no computador, sem depender do HTML5 Drag and
  // Drop nativo (que não funciona em telas de toque).
  function handlePointerDown(e: React.PointerEvent, orderId: string) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragState.current = { pointerId: e.pointerId, orderId, startX: e.clientX, startY: e.clientY, dragging: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Alguns navegadores/eventos sintéticos recusam a captura — o arraste ainda
      // funciona via os listeners normais, só perde a garantia de eventos fora do card.
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const state = dragState.current;
    if (!state || state.pointerId !== e.pointerId) return;

    if (!state.dragging) {
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      state.dragging = true;
      setDraggingId(state.orderId);
    }

    e.preventDefault();
    setDragOverStatus(statusAtPoint(e.clientX, e.clientY));
  }

  function handlePointerUp(e: React.PointerEvent) {
    const state = dragState.current;
    dragState.current = null;
    if (!state || state.pointerId !== e.pointerId) return;

    if (!state.dragging) {
      onSelect(state.orderId);
    } else {
      const target = statusAtPoint(e.clientX, e.clientY);
      if (target) commitDrop(state.orderId, target);
    }
    setDraggingId(null);
    setDragOverStatus(null);
  }

  function handlePointerCancel(e: React.PointerEvent) {
    if (dragState.current?.pointerId !== e.pointerId) return;
    dragState.current = null;
    setDraggingId(null);
    setDragOverStatus(null);
  }

  return (
    <div className="min-w-0">
      {/* Grid responsivo: quantas colunas couberem (mín. 240px cada) por linha; o que
          não couber quebra para a linha de baixo — nunca precisa rolar para o lado. */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {columns.map(({ status, orders: colOrders }) => (
          <div
            key={status}
            ref={(el) => {
              columnRefs.current.set(status, el);
            }}
            data-status={status}
            className={`flex min-w-0 flex-col rounded-lg border bg-muted/30 ${dragOverStatus === status ? "ring-2 ring-primary" : ""}`}
          >
            <div className="flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{STATUS_LABELS[status]}</span>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium">{colOrders.length}</span>
            </div>
            <div className="flex flex-col gap-2 p-2">
              {colOrders.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhum veículo</p>}
              {colOrders.map((order) => {
                const days = daysSince(order.updatedAt);
                return (
                  <div
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    data-order-id={order.id}
                    onPointerDown={(e) => handlePointerDown(e, order.id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerCancel}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(order.id);
                      }
                    }}
                    style={{ touchAction: "none" }}
                    className={`cursor-grab select-none rounded-md border bg-card p-2.5 text-left text-sm shadow-sm transition-opacity hover:border-primary/50 active:cursor-grabbing ${
                      order.id === selectedOrderId ? "border-primary ring-1 ring-primary" : ""
                    } ${draggingId === order.id ? "opacity-40" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {order.vehicle.brand} {order.vehicle.model}
                      </span>
                      {order.priority && order.priority !== "NORMAL" && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_CLASSES[order.priority]}`}>
                          {PRIORITY_LABELS[order.priority]}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {order.code} {order.vehicle.plate ? `· ${order.vehicle.plate}` : ""}
                    </div>
                    {order.insuranceCompany && (
                      <div className="mt-1 text-xs text-muted-foreground">{order.insuranceCompany.tradeName ?? order.insuranceCompany.legalName}</div>
                    )}
                    <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className={`rounded-full px-1.5 py-0.5 ${TONE_CLASSES[STATUS_TONE[status]]}`}>{days != null ? `${days}d nesta etapa` : "—"}</span>
                      {order.technician && <span>{order.technician.name}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
