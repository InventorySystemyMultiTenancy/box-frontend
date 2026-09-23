"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Appointment, AppointmentStatus, AppointmentType } from "@/lib/types";
import { openPrintableReport, escapeHtml } from "@/lib/printable-report";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

const TYPE_LABELS: Record<AppointmentType, string> = {
  SERVICE: "Serviço",
  PICKUP: "Retirada",
  DROPOFF: "Entrega",
};

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/** Relatório de agendamentos concluídos (ou de qualquer status) num período —
 * reaproveita o mesmo GET /appointments já usado na agenda do dia. */
export default function AgendaReportPanel() {
  const { token } = useAuth();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<string>("DONE");
  const [type, setType] = useState<string>("");

  const { data: appointments } = useQuery({
    queryKey: ["appointments-report", from, to, status, type],
    queryFn: async () =>
      (
        await api.appointments(token!, {
          from: `${from}T00:00:00.000Z`,
          to: `${to}T23:59:59.999Z`,
          status: status || undefined,
          type: type || undefined,
        })
      ).appointments as Appointment[],
    enabled: !!token,
  });

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of appointments ?? []) map.set(a.type, (map.get(a.type) ?? 0) + 1);
    return map;
  }, [appointments]);

  function generatePdf() {
    const rows = (appointments ?? [])
      .map(
        (a) => `
          <tr>
            <td>${new Date(a.startAt).toLocaleString("pt-BR")}</td>
            <td>${escapeHtml(TYPE_LABELS[a.type])}</td>
            <td>${escapeHtml(a.title)}</td>
            <td>${escapeHtml(a.client?.name ?? "—")}</td>
            <td>${escapeHtml(a.mechanic?.name ?? a.driver?.name ?? "—")}</td>
            <td>${STATUS_LABELS[a.status]}</td>
          </tr>
        `
      )
      .join("");
    openPrintableReport(
      "Relatório de agenda",
      `
        <h1>Relatório de agenda</h1>
        <div class="muted">Período: ${new Date(from).toLocaleDateString("pt-BR")} a ${new Date(to).toLocaleDateString("pt-BR")} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Título</th><th>Cliente</th><th>Responsável</th><th>Status</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">Nenhum agendamento no período.</td></tr>'}</tbody>
        </table>
        <div class="total">Total: ${appointments?.length ?? 0} agendamento(s)</div>
      `
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rep-from">De</Label>
          <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rep-to">Até</Label>
          <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {(Object.entries(STATUS_LABELS) as [AppointmentStatus, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Tipo</Label>
          <Select value={type || "ALL"} onValueChange={(v) => setType(v === "ALL" ? "" : v)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {(Object.entries(TYPE_LABELS) as [AppointmentType, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="outline" onClick={generatePdf} disabled={!appointments}>
          Gerar PDF
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Total</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{appointments?.length ?? 0}</CardContent></Card>
        {(Object.entries(TYPE_LABELS) as [AppointmentType, string][]).map(([key, label]) => (
          <Card key={key}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle></CardHeader>
            <CardContent className="text-2xl font-bold">{byType.get(key) ?? 0}</CardContent>
          </Card>
        ))}
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(appointments ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum agendamento no período.</TableCell></TableRow>
            )}
            {(appointments ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell>{new Date(a.startAt).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{TYPE_LABELS[a.type]}</TableCell>
                <TableCell>{a.title}</TableCell>
                <TableCell className="text-muted-foreground">{a.client?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{a.mechanic?.name ?? a.driver?.name ?? "—"}</TableCell>
                <TableCell>{STATUS_LABELS[a.status]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
