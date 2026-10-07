"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { ExportColumn, exportCsv } from "@/lib/export";
import { escapeHtml, openPrintableReport } from "@/lib/printable-report";
import type { Appointment } from "@/lib/types";

// Planilha "Agendamento diário" dos motoristas — mesmas colunas da planilha que a oficina
// usava: motorista, data, cliente, horário, retirada, entrega, modelo do veículo, placa ou
// chassi, e observação. Na Agenda (quem tem acesso) mostra todos os motoristas ou um; na
// aba Caminhões o motorista vê só os dele (o servidor garante isso).

function isoDate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDays(base: string, days: number) {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

// Coluna retirada/entrega: o local informado; sem local, marca "X" na coluna do tipo.
function pickupCell(a: Appointment) {
  return a.pickupLocation || (a.type === "PICKUP" ? "X" : "");
}
function dropoffCell(a: Appointment) {
  return a.dropoffLocation || (a.type === "DROPOFF" ? "X" : "");
}
function vehicleModel(a: Appointment) {
  return a.vehicle ? `${a.vehicle.brand} ${a.vehicle.model}` : "";
}
function plateOrChassi(a: Appointment) {
  return a.vehicle?.plate || a.vehicle?.chassi || "";
}
function observation(a: Appointment) {
  return [a.title, a.notes].filter(Boolean).join(" — ");
}

const COLUMNS: ExportColumn<Appointment>[] = [
  { header: "Motorista", value: (a) => a.driver?.name },
  { header: "Data", value: (a) => dateLabel(a.startAt) },
  { header: "Cliente", value: (a) => a.client?.name },
  { header: "Horário", value: (a) => timeLabel(a.startAt) },
  { header: "Retirada", value: pickupCell },
  { header: "Entrega", value: dropoffCell },
  { header: "Modelo veíc.", value: vehicleModel },
  { header: "Placa ou chassi", value: plateOrChassi },
  { header: "Observação", value: observation },
];

export function DriverSchedulePanel({ title = "Agendamento diário dos motoristas" }: { title?: string }) {
  const { token } = useAuth();
  const today = isoDate(new Date());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 6));
  const [driverId, setDriverId] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["driver-schedule", from, to, driverId],
    queryFn: async () => {
      const res = await api.driverSchedule(token!, { from, to, driverId: driverId || undefined });
      return { appointments: res.appointments as Appointment[], scope: res.scope };
    },
    enabled: !!token && !!from && !!to,
  });
  const appointments = useMemo(() => data?.appointments ?? [], [data]);
  const canPickDriver = data?.scope === "all";

  const { data: team } = useQuery({
    queryKey: ["team"],
    queryFn: async () => (await api.team()).team,
    enabled: canPickDriver,
  });

  // Agrupado por dia — cada dia é uma "folha" da planilha de agendamento diário.
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = isoDate(new Date(a.startAt));
      map.set(key, [...(map.get(key) ?? []), a]);
    }
    return [...map.entries()];
  }, [appointments]);

  const driverName = canPickDriver ? team?.find((m) => m.id === driverId)?.name : undefined;
  const fileBase = `agendamento-motoristas-${from}-a-${to}`;

  function printPdf() {
    const days = byDay
      .map(([day, rows]) => {
        const body = rows
          .map(
            (a) => `<tr>${[a.driver?.name ?? "", dateLabel(a.startAt), a.client?.name ?? "", timeLabel(a.startAt), pickupCell(a), dropoffCell(a), vehicleModel(a), plateOrChassi(a)]
              .map((v) => `<td>${escapeHtml(v)}</td>`)
              .join("")}</tr>`
          )
          .join("");
        const notes = rows
          .filter((a) => observation(a))
          .map((a) => `<li><strong>${escapeHtml(timeLabel(a.startAt))}${a.driver ? ` · ${escapeHtml(a.driver.name)}` : ""}:</strong> ${escapeHtml(observation(a))}</li>`)
          .join("");
        return `
          <div style="page-break-inside: avoid; margin-bottom: 28px">
            <h2 style="text-align:center">Agendamento diário — ${new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}</h2>
            <table>
              <thead><tr><th>Motorista</th><th>Data</th><th>Cliente</th><th>Horário</th><th>Retirada</th><th>Entrega</th><th>Modelo veíc.</th><th>Placa ou chassi</th></tr></thead>
              <tbody>${body}</tbody>
            </table>
            <div class="box" style="margin-top:8px; min-height:60px"><strong>Observação</strong>${notes ? `<ul style="margin:6px 0 0 18px">${notes}</ul>` : ""}</div>
          </div>`;
      })
      .join("");
    openPrintableReport(
      "Agendamento diário",
      `<h1>Agendamento diário${driverName ? ` — ${escapeHtml(driverName)}` : ""}</h1>
       <div class="muted">Período: ${dateLabel(`${from}T12:00:00`)} a ${dateLabel(`${to}T12:00:00`)} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
       ${days || "<p>Nenhum agendamento no período.</p>"}`
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            Retiradas e entregas de veículos {canPickDriver ? "de todos os motoristas" : "agendadas para você"}. Crie novas pela Agenda (tipo &quot;Retirada&quot; ou &quot;Entrega&quot;).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="ds-from" className="text-xs text-muted-foreground">De</Label>
            <Input id="ds-from" type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="ds-to" className="text-xs text-muted-foreground">Até</Label>
            <Input id="ds-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {canPickDriver && (
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Motorista</Label>
              <Select value={driverId || "ALL"} onValueChange={(v) => setDriverId(v === "ALL" ? "" : v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  {(team ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button type="button" variant="outline" size="sm" disabled={appointments.length === 0} onClick={() => exportCsv(fileBase, COLUMNS, appointments)}>
            <FileSpreadsheet className="size-4" />
            Planilha (Excel)
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={appointments.length === 0} onClick={printPdf}>
            <FileText className="size-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && appointments.length === 0 && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma retirada ou entrega agendada no período.</p>
      )}

      {byDay.map(([day, rows]) => (
        <div key={day} className="min-w-0 rounded-lg border bg-card">
          <div className="border-b px-3 py-2 text-center text-sm font-semibold">
            Agendamento diário — {new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motorista</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Horário</TableHead>
                  <TableHead>Retirada</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Modelo veíc.</TableHead>
                  <TableHead>Placa ou chassi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id} className={a.status === "DONE" ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{a.driver?.name ?? "—"}</TableCell>
                    <TableCell>{dateLabel(a.startAt)}</TableCell>
                    <TableCell>{a.client?.name ?? "—"}</TableCell>
                    <TableCell>{timeLabel(a.startAt)}</TableCell>
                    <TableCell>{pickupCell(a) || "—"}</TableCell>
                    <TableCell>{dropoffCell(a) || "—"}</TableCell>
                    <TableCell>{vehicleModel(a) || "—"}</TableCell>
                    <TableCell>{plateOrChassi(a) || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rows.some((a) => observation(a)) && (
            <div className="border-t px-3 py-2 text-sm">
              <span className="font-medium">Observação</span>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {rows
                  .filter((a) => observation(a))
                  .map((a) => (
                    <li key={a.id}>
                      {timeLabel(a.startAt)}
                      {a.driver ? ` · ${a.driver.name}` : ""}: {observation(a)}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
