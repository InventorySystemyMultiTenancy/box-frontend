"use client";

import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { SettlementSummary } from "@/lib/types";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const contas = (n: number) => `${n} conta${n === 1 ? "" : "s"}`;

/**
 * Totais do topo de Contas a pagar / Contas a receber: em aberto (com a parte vencida
 * destacada) e já pago/recebido. Seguem os filtros da tela (período, nome...), menos a aba
 * de situação — então os dois números aparecem sempre lado a lado.
 */
export function SettlementSummaryCards({
  summary,
  kind,
  filtered,
}: {
  summary: SettlementSummary | undefined;
  kind: "payable" | "receivable";
  filtered: boolean;
}) {
  const openLabel = kind === "payable" ? "Em aberto a pagar" : "Em aberto a receber";
  const settledLabel = kind === "payable" ? "Total já pago" : "Total já recebido";

  return (
    <div className="grid gap-1">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="size-4" />
            {openLabel}
          </div>
          <div className="mt-1 text-xl font-bold">{summary ? brl(summary.open.total) : "—"}</div>
          <div className="text-xs text-muted-foreground">{summary ? contas(summary.open.count) : ""}</div>
        </div>
        <div className={`rounded-lg border bg-card p-3 shadow-sm ${summary && summary.overdue.count > 0 ? "border-destructive/50" : ""}`}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className={`size-4 ${summary && summary.overdue.count > 0 ? "text-destructive" : ""}`} />
            Vencido (dentro do em aberto)
          </div>
          <div className={`mt-1 text-xl font-bold ${summary && summary.overdue.count > 0 ? "text-destructive" : ""}`}>
            {summary ? brl(summary.overdue.total) : "—"}
          </div>
          <div className="text-xs text-muted-foreground">{summary ? contas(summary.overdue.count) : ""}</div>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" />
            {settledLabel}
          </div>
          <div className="mt-1 text-xl font-bold">{summary ? brl(summary.settled.total) : "—"}</div>
          <div className="text-xs text-muted-foreground">{summary ? contas(summary.settled.count) : ""}</div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered ? "Totais de acordo com os filtros abaixo." : "Totais gerais (sem filtro)."} Contas canceladas não entram.
      </p>
    </div>
  );
}
