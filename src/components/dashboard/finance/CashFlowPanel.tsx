"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { CashFlow, DRE } from "@/lib/types";

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function CashFlowPanel() {
  const { token } = useAuth();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: cashFlow } = useQuery({
    queryKey: ["cash-flow", from, to],
    queryFn: async () => (await api.cashFlow(token!, { from, to })).cashFlow as CashFlow,
    enabled: !!token,
  });

  const { data: dre } = useQuery({
    queryKey: ["dre", from, to],
    queryFn: async () => (await api.dre(token!, { from, to })).dre as DRE,
    enabled: !!token,
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cf-from">De</Label>
          <Input id="cf-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-to">Até</Label>
          <Input id="cf-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {cashFlow && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Saldo inicial" value={cashFlow.initialBalance} />
          <StatCard label="Entradas" value={cashFlow.totalIn} tone="ok" />
          <StatCard label="Saídas" value={cashFlow.totalOut} tone="crit" />
          <StatCard label="Saldo final" value={cashFlow.finalBalance} />
        </div>
      )}

      {cashFlow && cashFlow.timeline.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Fluxo de caixa diário</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Entradas</TableHead>
                  <TableHead>Saídas</TableHead>
                  <TableHead>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashFlow.timeline.map((point) => (
                  <TableRow key={point.date}>
                    <TableCell>{new Date(point.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-emerald-600">R$ {point.in.toFixed(2)}</TableCell>
                    <TableCell className="text-destructive">R$ {point.out.toFixed(2)}</TableCell>
                    <TableCell className="font-medium">R$ {point.balance.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {dre && (
        <Card>
          <CardHeader><CardTitle className="text-base">DRE simplificado</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Receitas por categoria</p>
              {dre.revenueByCategory.length === 0 && <p className="text-sm text-muted-foreground">Sem receitas no período.</p>}
              {dre.revenueByCategory.map((r) => (
                <div key={r.category} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.category}</span>
                  <span>R$ {r.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Despesas por categoria</p>
              {dre.expensesByCategory.length === 0 && <p className="text-sm text-muted-foreground">Sem despesas no período.</p>}
              {dre.expensesByCategory.map((r) => (
                <div key={r.category} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.category}</span>
                  <span>R$ {r.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="col-span-full flex justify-between border-t pt-3 text-sm font-semibold">
              <span>Resultado líquido</span>
              <span className={dre.netResult < 0 ? "text-destructive" : "text-emerald-600"}>R$ {dre.netResult.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "crit" }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${tone === "ok" ? "text-emerald-600" : tone === "crit" ? "text-destructive" : "text-foreground"}`}>
        R$ {value.toFixed(2)}
      </p>
    </div>
  );
}
