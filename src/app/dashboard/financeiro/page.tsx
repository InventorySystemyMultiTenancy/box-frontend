"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SettlementSummary } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import AdminFinancePanel from "@/components/dashboard/AdminFinancePanel";
import BankAccountsPanel from "@/components/dashboard/finance/BankAccountsPanel";
import PayablesPanel from "@/components/dashboard/finance/PayablesPanel";
import ReceivablesPanel from "@/components/dashboard/finance/ReceivablesPanel";
import CashFlowPanel from "@/components/dashboard/finance/CashFlowPanel";
import InvoicesPanel from "@/components/dashboard/finance/InvoicesPanel";

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "payables", label: "Contas a pagar" },
  { key: "receivables", label: "Contas a receber" },
  { key: "banks", label: "Contas bancárias" },
  { key: "cashflow", label: "Fluxo de caixa" },
  { key: "invoices", label: "Notas fiscais" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type DueState = "overdue" | "pending" | null;

/** Vermelho se há conta vencida; laranja se há pendente (sem nenhuma vencida). */
function dueState(summary: SettlementSummary | undefined): DueState {
  if (!summary) return null;
  if (summary.overdue.count > 0) return "overdue";
  return summary.open.count > summary.overdue.count ? "pending" : null;
}

function DueDot({ state }: { state: DueState }) {
  if (!state) return null;
  const label = state === "overdue" ? "Há contas vencidas" : "Há contas pendentes";
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`inline-block size-2.5 rounded-full ${state === "overdue" ? "animate-alert-blink bg-red-600" : "bg-orange-500"}`}
    />
  );
}

export default function FinanceiroPage() {
  const { user, token, hasPermission } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("resumo");
  const allowed = user?.role === "ADMIN" || hasPermission("finance", "view");

  // Bolinha nas abas Contas a pagar/receber: vermelha com algo vencido, laranja com pendente.
  // Mesmos totais do topo de cada aba (sem filtros) — atualizam junto quando algo muda lá.
  const { data: payablesSummary } = useQuery({
    queryKey: ["payables", "summary", {}],
    queryFn: async () => (await api.payablesSummary(token!, {})).summary,
    enabled: !!token && allowed,
    refetchInterval: 5 * 60 * 1000,
  });
  const { data: receivablesSummary } = useQuery({
    queryKey: ["receivables", "summary"],
    queryFn: async () => (await api.receivablesSummary(token!)).summary,
    enabled: !!token && allowed,
    refetchInterval: 5 * 60 * 1000,
  });
  const tabDue: Partial<Record<TabKey, DueState>> = {
    payables: dueState(payablesSummary),
    receivables: dueState(receivablesSummary),
  };

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  if (!allowed) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Contas a pagar/receber, contas bancárias, fluxo de caixa e notas fiscais.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              {t.label}
              <DueDot state={tabDue[t.key] ?? null} />
            </span>
          </button>
        ))}
      </div>

      {tab === "resumo" && <AdminFinancePanel />}
      {tab === "payables" && <PayablesPanel />}
      {tab === "receivables" && <ReceivablesPanel />}
      {tab === "banks" && <BankAccountsPanel />}
      {tab === "cashflow" && <CashFlowPanel />}
      {tab === "invoices" && <InvoicesPanel />}
    </main>
  );
}
