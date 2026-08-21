"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { DashboardReport, RevisionAlert } from "@/lib/types";

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function RelatoriosPage() {
  const { user, token, hasPermission } = useAuth();
  const router = useRouter();
  const allowed = hasPermission("reports", "view");

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: report } = useQuery({
    queryKey: ["dashboard-report", from, to],
    queryFn: async () => (await api.dashboardReport(token!, { from, to })).report as DashboardReport,
    enabled: !!token && allowed,
  });

  const { data: alerts } = useQuery({
    queryKey: ["revision-alerts"],
    queryFn: async () => (await api.revisionAlerts(token!)).alerts as RevisionAlert[],
    enabled: !!token && allowed,
  });

  if (!allowed) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Indicadores gerenciais e alertas de revisão preventiva.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rep-from">De</Label>
          <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rep-to">Até</Label>
          <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {report && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Faturamento" value={`R$ ${report.revenue.total.toFixed(2)}`} />
          <Kpi label="Ticket médio" value={`R$ ${report.revenue.ticketMedio.toFixed(2)}`} />
          <Kpi label="Taxa de aprovação (reparos)" value={`${(report.approvalStats.rate * 100).toFixed(0)}%`} />
          <Kpi label="Taxa de aceite (orçamentos)" value={`${(report.quoteStats.rate * 100).toFixed(0)}%`} />
          <Kpi label="Giro de estoque" value={report.turnover.turnoverRatio.toFixed(2)} />
          <Kpi label="Peças no ponto mínimo" value={String(report.lowStock)} tone={report.lowStock > 0 ? "warn" : undefined} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Produtividade por mecânico</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mecânico</TableHead>
                  <TableHead>Itens concluídos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.mechanicProductivity ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Sem dados no período.</TableCell></TableRow>
                )}
                {(report?.mechanicProductivity ?? []).map((m) => (
                  <TableRow key={m.mechanicId}>
                    <TableCell className="font-medium">{m.mechanicName}</TableCell>
                    <TableCell>{m.completedParts}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Alertas de revisão preventiva</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Sem visita há</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(alerts ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum veículo em atraso.</TableCell></TableRow>
                )}
                {(alerts ?? []).map((a) => (
                  <TableRow key={a.vehicle.id}>
                    <TableCell className="font-medium">{a.vehicle.brand} {a.vehicle.model} {a.vehicle.plate ? `(${a.vehicle.plate})` : ""}</TableCell>
                    <TableCell className="text-muted-foreground">{a.owner.name}</TableCell>
                    <TableCell>{a.monthsSinceLastService} meses</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${tone === "warn" ? "text-amber-600" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
