"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Bay, Client, ClientDetail, User } from "@/lib/types";

interface AppointmentFormDialogProps {
  trigger: React.ReactNode;
  onSaved: () => void;
  defaultStartAt?: string;
}

function toLocalInputValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentFormDialog({ trigger, onSaved, defaultStartAt }: AppointmentFormDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [mechanicId, setMechanicId] = useState("");
  const [bayId, setBayId] = useState("");
  const [startAt, setStartAt] = useState(toLocalInputValue(defaultStartAt));
  const [durationMin, setDurationMin] = useState("60");
  const [notes, setNotes] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => (await api.clients(token!, { pageSize: 100 })).items as Client[],
    enabled: !!token && open,
  });

  const { data: clientDetail } = useQuery({
    queryKey: ["client-detail", clientId],
    queryFn: async () => (await api.client(clientId, token!)).client as ClientDetail,
    enabled: !!token && !!clientId,
  });

  const { data: mechanics } = useQuery({
    queryKey: ["mechanics"],
    queryFn: async () => ((await api.users(token!)).users as User[]).filter((u) => u.role === "MECHANIC"),
    enabled: !!token && open,
  });

  const { data: bays } = useQuery({
    queryKey: ["bays"],
    queryFn: async () => (await api.bays(token!)).bays as Bay[],
    enabled: !!token && open,
  });

  function reset() {
    setTitle("");
    setClientId("");
    setVehicleId("");
    setMechanicId("");
    setBayId("");
    setStartAt(toLocalInputValue(defaultStartAt));
    setDurationMin("60");
    setNotes("");
  }

  function handleOpenChange(next: boolean) {
    if (next) reset();
    setOpen(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !title.trim() || !startAt) return;
    setSaving(true);
    try {
      await api.createAppointment(
        {
          title,
          clientId: clientId || undefined,
          vehicleId: vehicleId || undefined,
          mechanicId: mechanicId || undefined,
          bayId: bayId || undefined,
          startAt: new Date(startAt).toISOString(),
          estimatedDurationMin: Number(durationMin) || 60,
          notes: notes || undefined,
        },
        token
      );
      toast.success("Agendamento criado.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar o agendamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo agendamento</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="ap-title">Título *</Label>
            <Input id="ap-title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Revisão preventiva" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Cliente</Label>
              <Select
                value={clientId || "NONE"}
                onValueChange={(v) => {
                  setClientId(v === "NONE" ? "" : v);
                  setVehicleId("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Veículo</Label>
              <Select value={vehicleId || "NONE"} onValueChange={(v) => setVehicleId(v === "NONE" ? "" : v)} disabled={!clientId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  {(clientDetail?.vehicles ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} {v.plate ? `(${v.plate})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Mecânico</Label>
              <Select value={mechanicId || "NONE"} onValueChange={(v) => setMechanicId(v === "NONE" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  {(mechanics ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Box/Elevador</Label>
              <Select value={bayId || "NONE"} onValueChange={(v) => setBayId(v === "NONE" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  {(bays ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ap-start">Início *</Label>
              <Input id="ap-start" type="datetime-local" required value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ap-duration">Duração (min)</Label>
              <Input id="ap-duration" type="number" min="5" step="5" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ap-notes">Observações</Label>
            <Input id="ap-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar agendamento"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
