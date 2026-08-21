"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function FinanceiroPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("resumo");
  const allowed = user?.role === "ADMIN" || hasPermission("finance", "view");

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
            {t.label}
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
