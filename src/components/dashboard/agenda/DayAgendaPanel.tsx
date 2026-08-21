"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AppointmentFormDialog } from "@/components/dashboard/agenda/AppointmentFormDialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Appointment, AppointmentStatus } from "@/lib/types";

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

export default function DayAgendaPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("agenda", "manage");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const from = `${date}T00:00:00.000Z`;
  const to = `${date}T23:59:59.999Z`;

  const { data: appointments, isLoading } = useQuery({
    queryKey: ["appointments", date],
    queryFn: async () => (await api.appointments(token!, { from, to })).appointments as Appointment[],
    enabled: !!token,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appt of appointments ?? []) {
      const key = appt.bay?.name ?? "Sem box definido";
      const list = map.get(key) ?? [];
      list.push(appt);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.startAt.localeCompare(b.startAt));
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [appointments]);

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["appointments"] });
  }

  async function advance(appt: Appointment) {
    const next = NEXT_STATUS[appt.status];
    if (!token || !next) return;
    try {
      await api.setAppointmentStatus(appt.id, next.status, token);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar o status.");
    }
  }

  async function cancel(appt: Appointment, status: "CANCELLED" | "NO_SHOW") {
    if (!token) return;
    try {
      await api.setAppointmentStatus(appt.id, status, token);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar o status.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="agenda-date">Dia</Label>
          <Input id="agenda-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        {canManage && (
          <AppointmentFormDialog
            onSaved={refetch}
            defaultStartAt={`${date}T09:00:00`}
            trigger={<Button size="sm"><Plus className="size-4" />Novo agendamento</Button>}
          />
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && grouped.length === 0 && <p className="text-sm text-muted-foreground">Nenhum agendamento neste dia.</p>}

      <div className="grid gap-4">
        {grouped.map(([bayName, list]) => (
          <div key={bayName} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-2 text-sm font-medium">{bayName}</div>
            <div className="divide-y">
              {list.map((appt) => (
                <div key={appt.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <p className="font-medium">
                      {new Date(appt.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — {appt.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {appt.client?.name ?? "Sem cliente"} · {appt.mechanic?.name ?? "Sem mecânico"} · {appt.estimatedDurationMin} min
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANTS[appt.status]}>{STATUS_LABELS[appt.status]}</Badge>
                    {canManage && OPEN_STATUSES.includes(appt.status) && (
                      <>
                        {NEXT_STATUS[appt.status] && (
                          <Button size="sm" variant="outline" onClick={() => advance(appt)}>
                            {NEXT_STATUS[appt.status]!.label}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => cancel(appt, "NO_SHOW")}>
                          Não compareceu
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancel(appt, "CANCELLED")}>
                          Cancelar
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
