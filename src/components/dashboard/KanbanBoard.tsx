"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Car,
  Stethoscope,
  ClipboardCheck,
  Clock,
  PackageSearch,
  PackageCheck,
  Wrench,
  Gauge,
  Droplets,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

interface StatusTheme {
  icon: LucideIcon;
  border: string;
  iconWrap: string;
  badge: string;
  empty: string;
}

// Um ícone e uma cor por etapa — cartão branco com faixa colorida no topo (em vez do
// fundo inteiro pintado), ícone da etapa num chip colorido no cabeçalho da coluna e
// como avatar de cada card, e o mesmo tom usado no badge de contagem e no estado vazio.
const STATUS_THEME: Record<ServiceOrderStatus, StatusTheme> = {
  SCHEDULED: {
    icon: Calendar,
    border: "border-t-slate-400",
    iconWrap: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    empty: "text-slate-200 dark:text-slate-800",
  },
  RECEIVED: {
    icon: Car,
    border: "border-t-sky-500",
    iconWrap: "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-300",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    empty: "text-sky-200 dark:text-sky-900",
  },
  AWAITING_DIAGNOSIS: {
    icon: Stethoscope,
    border: "border-t-cyan-500",
    iconWrap: "bg-cyan-100 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-300",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
    empty: "text-cyan-200 dark:text-cyan-900",
  },
  DIAGNOSIS_DONE: {
    icon: ClipboardCheck,
    border: "border-t-teal-500",
    iconWrap: "bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-300",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
    empty: "text-teal-200 dark:text-teal-900",
  },
  AWAITING_APPROVAL: {
    icon: Clock,
    border: "border-t-amber-500",
    iconWrap: "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    empty: "text-amber-200 dark:text-amber-900",
  },
  PARTS_REQUESTED: {
    icon: PackageSearch,
    border: "border-t-orange-500",
    iconWrap: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    empty: "text-orange-200 dark:text-orange-900",
  },
  PARTS_RECEIVED: {
    icon: PackageCheck,
    border: "border-t-yellow-500",
    iconWrap: "bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-300",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    empty: "text-yellow-200 dark:text-yellow-900",
  },
  IN_PROGRESS: {
    icon: Wrench,
    border: "border-t-blue-500",
    iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    empty: "text-blue-200 dark:text-blue-900",
  },
  TESTING: {
    icon: Gauge,
    border: "border-t-indigo-500",
    iconWrap: "bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
    empty: "text-indigo-200 dark:text-indigo-900",
  },
  WASHING: {
    icon: Droplets,
    border: "border-t-purple-500",
    iconWrap: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
    empty: "text-purple-200 dark:text-purple-900",
  },
  FINISHED: {
    icon: CheckCircle2,
    border: "border-t-emerald-500",
    iconWrap: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    empty: "text-emerald-200 dark:text-emerald-900",
  },
  READY_FOR_PICKUP: {
    icon: CheckCircle2,
    border: "border-t-green-500",
    iconWrap: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-300",
    badge: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    empty: "text-green-200 dark:text-green-900",
  },
};

// Distância mínima (px) antes de um toque/clique virar arraste — evita competir
// com o tap que abre a ficha do veículo.
const DRAG_THRESHOLD = 8;

// Acima disso a coluna vira um resumo clicável em vez de listar todos os cards —
// evita que uma etapa cheia vire uma lista enorme dominando a tela toda.
const COMPACT_THRESHOLD = 2;

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
  const [expandedStatus, setExpandedStatus] = useState<ServiceOrderStatus | null>(null);
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
        {columns.map(({ status, orders: colOrders }) => {
          const theme = STATUS_THEME[status];
          const ColumnIcon = theme.icon;
          return (
            <div
              key={status}
              ref={(el) => {
                columnRefs.current.set(status, el);
              }}
              data-status={status}
              className={`flex min-w-0 flex-col rounded-lg border border-t-4 bg-card shadow-sm ${theme.border} ${
                dragOverStatus === status ? "ring-2 ring-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${theme.iconWrap}`}>
                    <ColumnIcon className="size-3.5" />
                  </span>
                  <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground">{STATUS_LABELS[status]}</span>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${theme.badge}`}>{colOrders.length}</span>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {colOrders.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 px-2 py-8 text-center">
                    <ColumnIcon className={`size-9 ${theme.empty}`} />
                    <p className="text-xs text-muted-foreground">Nenhum veículo</p>
                  </div>
                )}
                {colOrders.length > COMPACT_THRESHOLD ? (
                  <button
                    type="button"
                    onClick={() => setExpandedStatus(status)}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed p-4 text-center transition-colors hover:bg-muted/40"
                  >
                    <span className={`flex size-9 items-center justify-center rounded-full ${theme.iconWrap}`}>
                      <ColumnIcon className="size-4" />
                    </span>
                    <span className="text-sm font-semibold">{colOrders.length} veículos</span>
                    <span className="text-xs text-muted-foreground">Toque para ver a lista</span>
                  </button>
                ) : (
                  colOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      status={status}
                      theme={theme}
                      selected={order.id === selectedOrderId}
                      dragging={draggingId === order.id}
                      onPointerDown={(e) => handlePointerDown(e, order.id)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerCancel}
                      onSelect={() => onSelect(order.id)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Etapas com mais de duas OS abrem aqui a lista completa, em vez de lotar a
          coluna — tocar num item seleciona a OS e fecha a lista. */}
      <Dialog open={expandedStatus !== null} onOpenChange={(open) => !open && setExpandedStatus(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          {expandedStatus && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className={`flex size-7 items-center justify-center rounded-full ${STATUS_THEME[expandedStatus].iconWrap}`}>
                    {(() => {
                      const Icon = STATUS_THEME[expandedStatus].icon;
                      return <Icon className="size-3.5" />;
                    })()}
                  </span>
                  {STATUS_LABELS[expandedStatus]}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-2">
                {(columns.find((c) => c.status === expandedStatus)?.orders ?? []).map((order) => {
                  const days = daysSince(order.updatedAt);
                  const theme = STATUS_THEME[expandedStatus];
                  return (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => {
                        onSelect(order.id);
                        setExpandedStatus(null);
                      }}
                      className={`rounded-md border bg-background p-2.5 text-left text-sm shadow-sm hover:border-primary/50 ${
                        order.id === selectedOrderId ? "border-primary ring-1 ring-primary" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${theme.iconWrap}`}>
                          <Car className="size-3.5" />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {order.vehicle.brand} {order.vehicle.model}
                        </span>
                        {order.priority && order.priority !== "NORMAL" && (
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_CLASSES[order.priority]}`}>
                            {PRIORITY_LABELS[order.priority]}
                          </span>
                        )}
                      </div>
                      {order.vehicle.owner && <div className="mt-1 truncate text-xs text-muted-foreground">{order.vehicle.owner.name}</div>}
                      <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                        {order.code} {order.vehicle.plate ? `· ${order.vehicle.plate}` : ""}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
                        <span className={`rounded-full px-1.5 py-0.5 ${TONE_CLASSES[STATUS_TONE[expandedStatus]]}`}>
                          {days != null ? `${days}d nesta etapa` : "—"}
                        </span>
                        {order.technician && <span className="truncate">{order.technician.name}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface OrderCardProps {
  order: ServiceOrder;
  status: ServiceOrderStatus;
  theme: StatusTheme;
  selected: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  onSelect: () => void;
}

// Card arrastável de uma OS dentro da coluna — só é renderizado quando a coluna tem
// poucas OS (COMPACT_THRESHOLD ou menos); acima disso a coluna vira um resumo e a
// mesma informação aparece nas linhas (não arrastáveis) do diálogo expandido.
function OrderCard({ order, status, theme, selected, dragging, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onSelect }: OrderCardProps) {
  const days = daysSince(order.updatedAt);
  return (
    <div
      role="button"
      tabIndex={0}
      data-order-id={order.id}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{ touchAction: "none" }}
      className={`cursor-grab select-none rounded-md border bg-background p-2.5 text-left text-sm shadow-sm transition-opacity hover:border-primary/50 active:cursor-grabbing ${
        selected ? "border-primary ring-1 ring-primary" : ""
      } ${dragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${theme.iconWrap}`}>
          <Car className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate font-medium">
          {order.vehicle.brand} {order.vehicle.model}
        </span>
        {order.priority && order.priority !== "NORMAL" && (
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_CLASSES[order.priority]}`}>
            {PRIORITY_LABELS[order.priority]}
          </span>
        )}
      </div>
      {order.vehicle.owner && <div className="mt-1 truncate text-xs text-muted-foreground">{order.vehicle.owner.name}</div>}
      <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
        {order.code} {order.vehicle.plate ? `· ${order.vehicle.plate}` : ""}
      </div>
      {order.insuranceCompany && (
        <div className="mt-1 truncate text-xs text-muted-foreground">{order.insuranceCompany.tradeName ?? order.insuranceCompany.legalName}</div>
      )}
      <div className="mt-1.5 flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
        <span className={`rounded-full px-1.5 py-0.5 ${TONE_CLASSES[STATUS_TONE[status]]}`}>{days != null ? `${days}d nesta etapa` : "—"}</span>
        {order.technician && <span className="truncate">{order.technician.name}</span>}
      </div>
    </div>
  );
}
