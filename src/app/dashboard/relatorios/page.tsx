"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButtons } from "@/components/ui/export-buttons";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { canSeeSection } from "@/lib/access";
import { generateFinancialReportPdf } from "@/lib/financial-report";
import { openReportWindow } from "@/lib/printable-report";
import type { DashboardReport, RevisionAlert } from "@/lib/types";

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const money = (value: number) => `R$ ${value.toFixed(2).replace(".", ",")}`;

export default function RelatoriosPage() {
  const { user, token, hasPermission, reportAccess } = useAuth();
  const router = useRouter();
  const allowed = hasPermission("reports", "view");

  // O que o cargo libera (Tela Cargos → Relatórios e alertas). O backend aplica a mesma
  // regra — aqui é só para não mostrar blocos vazios.
  const showIndicators = canSeeSection(reportAccess, "indicators");
  const showProductivity = canSeeSection(reportAccess, "productivity");
  const showRevision = canSeeSection(reportAccess, "revision");
  const showParts = canSeeSection(reportAccess, "parts");
  const showFinancial = canSeeSection(reportAccess, "financial");
  const showDashboard = showIndicators || showProductivity || showParts;

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [financialBusy, setFinancialBusy] = useState(false);

  const { data: report } = useQuery({
    queryKey: ["dashboard-report", from, to],
    queryFn: async () => (await api.dashboardReport(token!, { from, to })).report as DashboardReport,
    enabled: !!token && allowed && showDashboard,
  });

  const { data: alerts } = useQuery({
    queryKey: ["revision-alerts"],
    queryFn: async () => (await api.revisionAlerts(token!)).alerts as RevisionAlert[],
    enabled: !!token && allowed && showRevision,
  });

  if (!allowed) return null;

  async function handleFinancialPdf() {
    if (!token) return;
    // Abre a janela já no clique (depois do await o navegador bloquearia como pop-up).
    const popup = openReportWindow();
    if (!popup) {
      toast.error("O navegador bloqueou a janela do relatório. Permita pop-ups para este site e tente de novo.");
      return;
    }
    setFinancialBusy(true);
    try {
      await generateFinancialReportPdf(token, from, to, popup);
    } catch (err) {
      popup.close();
      toast.error(err instanceof ApiError ? err.message : "Não foi possível gerar o relatório financeiro.");
    } finally {
      setFinancialBusy(false);
    }
  }

  const indicatorRows = report
    ? [
        ...(report.revenue
          ? [
              { label: "Faturamento recebido", value: money(report.revenue.total) },
              { label: "Atendimentos faturados", value: String(report.revenue.count) },
              { label: "Ticket médio", value: money(report.revenue.ticketMedio) },
            ]
          : []),
        ...(report.approvalStats ? [{ label: "Taxa de aprovação (reparos)", value: `${(report.approvalStats.rate * 100).toFixed(0)}%` }] : []),
        ...(report.quoteStats ? [{ label: "Taxa de aceite (orçamentos)", value: `${(report.quoteStats.rate * 100).toFixed(0)}%` }] : []),
        ...(report.partsUsage
          ? [
              { label: "Peças usadas em projetos (qtd.)", value: String(report.partsUsage.totalQuantity) },
              { label: "Peças usadas em projetos (valor)", value: money(report.partsUsage.totalValue) },
              ...report.partsUsage.topParts.map((p) => ({ label: `Peça usada — ${p.name}`, value: `${p.quantity} un. · ${money(p.value)}` })),
            ]
          : []),
        ...(report.mechanicProductivity ?? []).map((m) => ({ label: `Itens concluídos — ${m.mechanicName}`, value: String(m.completedParts) })),
      ]
    : [];

  const nothingAllowed = !showDashboard && !showRevision && !showFinancial;
  const sectorsNote = reportAccess.sectors ? `Setores liberados para você: ${reportAccess.sectors.join(", ")}.` : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Indicadores gerenciais e alertas de revisão preventiva.</p>
        {sectorsNote && <p className="mt-1 text-xs text-muted-foreground">{sectorsNote}</p>}
      </div>

      {nothingAllowed && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Seu cargo não tem nenhum relatório liberado. Peça ao administrador para ajustar em Cargos → Relatórios e alertas.
        </p>
      )}

      {!nothingAllowed && (
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rep-from">De</Label>
            <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rep-to">Até</Label>
            <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {showFinancial && (
            <Button
              type="button"
              onClick={handleFinancialPdf}
              disabled={financialBusy || !from || !to}
              title={reportAccess.sectors ? "Despesas dos setores liberados para o seu cargo no período" : "Relatório geral do financeiro no período: resumo, DRE, despesas por setor/grupo e lançamentos"}
            >
              <FileText className="size-4" />
              {financialBusy ? "Gerando..." : reportAccess.sectors ? "PDF financeiro do(s) setor(es)" : "PDF financeiro do período"}
            </Button>
          )}
          {indicatorRows.length > 0 && (
            <ExportButtons
              title="Indicadores gerenciais"
              filename={`indicadores-${from}-a-${to}`}
              subtitle={`Período: ${new Date(`${from}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${to}T12:00:00`).toLocaleDateString("pt-BR")}.`}
              rows={indicatorRows}
              columns={[
                { header: "Indicador", value: (r) => r.label },
                { header: "Valor", value: (r) => r.value },
              ]}
            />
          )}
        </div>
      )}

      {report && (report.revenue || report.partsUsage) && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {report.revenue && <Kpi label="Faturamento" value={money(report.revenue.total)} />}
          {report.revenue && <Kpi label="Ticket médio" value={money(report.revenue.ticketMedio)} />}
          {report.approvalStats && <Kpi label="Taxa de aprovação (reparos)" value={`${(report.approvalStats.rate * 100).toFixed(0)}%`} />}
          {report.quoteStats && <Kpi label="Taxa de aceite (orçamentos)" value={`${(report.quoteStats.rate * 100).toFixed(0)}%`} />}
          {report.partsUsage && <Kpi label="Peças usadas em projetos" value={`${report.partsUsage.totalQuantity} un.`} />}
          {report.partsUsage && <Kpi label="Valor das peças usadas" value={money(report.partsUsage.totalValue)} />}
        </div>
      )}

      {report?.partsUsage && report.partsUsage.topParts.length > 0 && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="text-base">Peças mais usadas no período</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Peça</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.partsUsage.topParts.map((p) => (
                  <TableRow key={p.partId}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.quantity}</TableCell>
                    <TableCell>{money(p.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {showProductivity && (
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
        )}

        {showRevision && (
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Alertas de revisão preventiva</CardTitle>
              <ExportButtons
                title="Revisão preventiva em atraso"
                filename="revisao-preventiva"
                rows={alerts ?? []}
                columns={[
                  { header: "Veículo", value: (a) => `${a.vehicle.brand} ${a.vehicle.model}` },
                  { header: "Placa", value: (a) => a.vehicle.plate },
                  { header: "Cliente", value: (a) => a.owner.name },
                  { header: "Telefone", value: (a) => a.owner.phone },
                  { header: "Última visita", value: (a) => a.lastServiceAt, type: "date" },
                  { header: "Meses sem visita", value: (a) => a.monthsSinceLastService, type: "number" },
                ]}
              />
            </CardHeader>
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
        )}
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
