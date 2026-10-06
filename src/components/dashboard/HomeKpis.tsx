"use client";

import { useQuery } from "@tanstack/react-query";
import { Banknote, CalendarCheck, Receipt, Timer, AlertCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ServiceOrderStatus, STATUS_LABELS } from "@/lib/types";

interface HomeKpisData {
  monthRevenue: number;
  deliveredCount: number;
  deliveredBilled: number;
  averageTicket: number;
  averageRepairDays: number;
  activeOrders: number;
  byStatus: { status: ServiceOrderStatus; count: number }[];
  receivableOpen: number;
  receivableOverdue: number;
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Indicadores do mês no topo da aba Projetos — só para admin (valores financeiros). */
export function HomeKpis() {
  const { token } = useAuth();
  const { data } = useQuery({
    queryKey: ["home-kpis"],
    queryFn: async () => (await api.homeKpis(token!)).kpis as HomeKpisData,
    enabled: !!token,
    refetchInterval: 5 * 60 * 1000,
  });

  if (!data) return null;
  const monthName = new Date().toLocaleDateString("pt-BR", { month: "long" });

  const cards = [
    { icon: Banknote, label: `Recebido em ${monthName}`, value: brl(data.monthRevenue), hint: "Contas a receber baixadas no mês" },
    { icon: CalendarCheck, label: "Veículos entregues no mês", value: String(data.deliveredCount), hint: `Faturado: ${brl(data.deliveredBilled)}` },
    { icon: Receipt, label: "Ticket médio", value: brl(data.averageTicket), hint: "Por veículo entregue no mês" },
    {
      icon: Timer,
      label: "Tempo médio de reparo",
      value: data.averageRepairDays > 0 ? `${data.averageRepairDays.toFixed(1).replace(".", ",")} dias` : "—",
      hint: "Da entrada à entrega, no mês",
    },
    {
      icon: AlertCircle,
      label: "A receber",
      value: brl(data.receivableOpen),
      hint: data.receivableOverdue > 0 ? `${brl(data.receivableOverdue)} vencido` : "Nada vencido",
      alert: data.receivableOverdue > 0,
    },
  ];

  return (
    <div className="mb-4 grid gap-3">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <c.icon className="size-4" />
              <span className="truncate">{c.label}</span>
            </div>
            <div className="mt-1 text-lg font-bold leading-tight">{c.value}</div>
            <div className={`text-xs ${c.alert ? "font-semibold text-destructive" : "text-muted-foreground"}`}>{c.hint}</div>
          </div>
        ))}
      </div>
      {data.byStatus.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{data.activeOrders} em andamento:</span>
          {data.byStatus.map((s) => (
            <span key={s.status} className="rounded-full border bg-card px-2.5 py-0.5">
              {STATUS_LABELS[s.status] ?? s.status} · <strong>{s.count}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
