"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppointmentFormDialog } from "@/components/dashboard/agenda/AppointmentFormDialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { todayInputValue } from "@/lib/dates";
import type { Appointment, AppointmentStatus, AppointmentType } from "@/lib/types";

// Agenda geral: todos os agendamentos (serviço na oficina, retiradas e entregas) num
// período De/Até, agrupados por dia — substitui a antiga "Agenda do dia" (um dia só).

const TYPE_LABELS: Record<AppointmentType, string> = {
  SERVICE: "Serviço",
  PICKUP: "Retirada",
  DROPOFF: "Entrega",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em andamento",
  DONE: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
};

const STATUS_VARIANTS: Record<AppointmentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  SCHEDULED: "outline",
  CONFIRMED: "outline",
  IN_PROGRESS: "default",
  DONE: "default",
  CANCELLED: "secondary",
  NO_SHOW: "destructive",
};

const NEXT_STATUS: Partial<Record<AppointmentStatus, { label: string; status: AppointmentStatus }>> = {
  SCHEDULED: { label: "Confirmar", status: "CONFIRMED" },
  CONFIRMED: { label: "Iniciar", status: "IN_PROGRESS" },
  IN_PROGRESS: { label: "Concluir", status: "DONE" },
};

const OPEN_STATUSES: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "IN_PROGRESS"];

type SituationFilter = "open" | "closed" | "all";

function addDays(isoDate: string, days: number) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function monthBounds(isoDate: string) {
  const [y, m] = isoDate.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(y, m, 0).getDate();
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(last)}` };
}

// Chave do dia no fuso local (um agendamento às 22h fica no dia certo, não no seguinte).
function localDayKey(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default function GeneralAgendaPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("agenda", "manage");
  const today = todayInputValue();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(() => addDays(today, 6));
  const [type, setType] = useState<AppointmentType | "ALL">("ALL");
  const [situation, setSituation] = useState<SituationFilter>("all");

  // Início do dia "De" e fim do dia "Até", no fuso local.
  const rangeStart = from ? new Date(`${from}T00:00:00`).toISOString() : undefined;
  const rangeEnd = to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined;
  const invalidRange = Boolean(from && to && from > to);

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["appointments", rangeStart, rangeEnd, type],
    queryFn: async () =>
      (await api.appointments(token!, { from: rangeStart, to: rangeEnd, type: type === "ALL" ? undefined : type })).appointments as Appointment[],
    enabled: !!token && !!from && !!to && !invalidRange,
  });

  const visible = useMemo(
    () =>
      (appointments ?? []).filter((a) =>
        situation === "open" ? OPEN_STATUSES.includes(a.status) : situation === "closed" ? !OPEN_STATUSES.includes(a.status) : true
      ),
    [appointments, situation]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of visible) {
      const key = localDayKey(appt.startAt);
      map.set(key, [...(map.get(key) ?? []), appt]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queryClient.invalidateQueries({ queryKey: ["driver-schedule"] });
  }

  function setPreset(preset: "today" | "week" | "month") {
    if (preset === "today") {
      setFrom(today);
      setTo(today);
    } else if (preset === "week") {
      setFrom(today);
      setTo(addDays(today, 6));
    } else {
      const m = monthBounds(today);
      setFrom(m.from);
      setTo(m.to);
    }
  }

  async function changeStatus(appt: Appointment, status: AppointmentStatus) {
    if (!token) return;
    try {
      await api.setAppointmentStatus(appt.id, status, token);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar o status.");
    }
  }

  async function deleteAppointment(appt: Appointment) {
    if (!token || !confirm(`Excluir o agendamento "${appt.title}"?`)) return;
    try {
      await api.deleteAppointment(appt.id, token);
      toast.success("Agendamento excluído.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o agendamento.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="agenda-from">De</Label>
            <Input id="agenda-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="agenda-to">Até</Label>
            <Input id="agenda-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-40" />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as AppointmentType | "ALL")}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {(Object.keys(TYPE_LABELS) as AppointmentType[]).map((t) => (
                  <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Situação</Label>
            <Select value={situation} onValueChange={(v) => setSituation(v as SituationFilter)}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="open">Em aberto</SelectItem>
                <SelectItem value="closed">Concluídos/cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setPreset("today")}>Hoje</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPreset("week")}>Próximos 7 dias</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setPreset("month")}>Este mês</Button>
          {canManage && (
            <AppointmentFormDialog
              onSaved={refetch}
              defaultStartAt={`${from || today}T09:00:00`}
              trigger={<Button size="sm" className="w-full sm:w-auto"><Plus className="size-4" />Novo agendamento</Button>}
            />
          )}
        </div>
      </div>

      {invalidRange && <p className="text-sm text-destructive">A data inicial é depois da data final.</p>}
      {!invalidRange && isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!invalidRange && !isLoading && byDay.length === 0 && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum agendamento no período.</p>
      )}
      {!invalidRange && visible.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {visible.length} agendamento{visible.length === 1 ? "" : "s"} em {byDay.length} dia{byDay.length === 1 ? "" : "s"}.
        </p>
      )}

      <div className="grid gap-4">
        {byDay.map(([day, list]) => (
          <div key={day} className="min-w-0 rounded-lg border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-2 text-sm font-medium">
              <span className="capitalize">
                {new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
              </span>
              {day === today && <Badge variant="outline">Hoje</Badge>}
            </div>
            <div className="divide-y">
              {list.map((appt) => (
                <div key={appt.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {new Date(appt.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — {appt.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Badge variant="secondary" className="mr-1 align-middle">{TYPE_LABELS[appt.type]}</Badge>
                      {appt.client?.name ?? "Sem cliente"} ·{" "}
                      {appt.type !== "SERVICE"
                        ? appt.driver?.name ?? "Sem motorista"
                        : `${appt.mechanic?.name ?? "Sem mecânico"} · ${appt.bay?.name ?? "Sem box definido"}`}{" "}
                      · {appt.estimatedDurationMin} min
                      {appt.vehicle ? ` · ${appt.vehicle.brand} ${appt.vehicle.model}${appt.vehicle.plate ? ` (${appt.vehicle.plate})` : ""}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANTS[appt.status]}>{STATUS_LABELS[appt.status]}</Badge>
                    {canManage && OPEN_STATUSES.includes(appt.status) && (
                      <>
                        {NEXT_STATUS[appt.status] && (
                          <Button size="sm" variant="outline" onClick={() => changeStatus(appt, NEXT_STATUS[appt.status]!.status)}>
                            {NEXT_STATUS[appt.status]!.label}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => changeStatus(appt, "NO_SHOW")}>
                          Não compareceu
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => changeStatus(appt, "CANCELLED")}>
                          Cancelar
                        </Button>
                      </>
                    )}
                    {canManage && (
                      <>
                        <AppointmentFormDialog
                          appointment={appt}
                          onSaved={refetch}
                          trigger={
                            <Button size="sm" variant="outline">
                              <Edit3 className="size-4" />
                              Editar
                            </Button>
                          }
                        />
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteAppointment(appt)}>
                          <Trash2 className="size-4" />
                          Excluir
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
