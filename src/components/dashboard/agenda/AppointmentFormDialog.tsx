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
import type { Appointment, AppointmentType, Bay, Client, ClientDetail, User, Vehicle } from "@/lib/types";

interface AppointmentFormDialogProps {
  trigger: React.ReactNode;
  onSaved: () => void;
  defaultStartAt?: string;
  appointment?: Appointment;
}

const TYPE_LABELS: Record<AppointmentType, string> = {
  SERVICE: "Serviço na oficina",
  PICKUP: "Retirada do veículo",
  DROPOFF: "Entrega do veículo",
};

const EMPTY_NEW_VEHICLE = { brand: "", model: "", year: "", plate: "", mileage: "0" };

function toLocalInputValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentFormDialog({ trigger, onSaved, defaultStartAt, appointment }: AppointmentFormDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<AppointmentType>("SERVICE");
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [vehicleMode, setVehicleMode] = useState<"existing" | "new">("existing");
  const [vehicleId, setVehicleId] = useState("");
  const [newVehicle, setNewVehicle] = useState(EMPTY_NEW_VEHICLE);
  const [mechanicId, setMechanicId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [bayId, setBayId] = useState("");
  const [startAt, setStartAt] = useState(toLocalInputValue(defaultStartAt));
  const [durationMin, setDurationMin] = useState("60");
  const [notes, setNotes] = useState("");
  // Tarefa de motorista: locais das colunas "retirada" e "entrega" da planilha.
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");

  const isPickupOrDropoff = type !== "SERVICE";

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
    setType(appointment?.type ?? "SERVICE");
    setTitle(appointment?.title ?? "");
    setClientId(appointment?.clientId ?? "");
    setVehicleMode("existing");
    setVehicleId(appointment?.vehicleId ?? "");
    setNewVehicle(EMPTY_NEW_VEHICLE);
    setMechanicId(appointment?.mechanicId ?? "");
    setDriverId(appointment?.driverId ?? "");
    setBayId(appointment?.bayId ?? "");
    setStartAt(toLocalInputValue(appointment?.startAt ?? defaultStartAt));
    setDurationMin(String(appointment?.estimatedDurationMin ?? 60));
    setNotes(appointment?.notes ?? "");
    setPickupLocation(appointment?.pickupLocation ?? "");
    setDropoffLocation(appointment?.dropoffLocation ?? "");
  }

  function handleOpenChange(next: boolean) {
    if (next) reset();
    setOpen(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !title.trim() || !startAt) return;
    if (isPickupOrDropoff && !driverId) {
      toast.error("Selecione o motorista responsável.");
      return;
    }
    if (vehicleMode === "new" && (!newVehicle.brand.trim() || !newVehicle.model.trim() || !newVehicle.year)) {
      toast.error("Informe marca, modelo e ano do veículo.");
      return;
    }

    setSaving(true);
    try {
      let finalVehicleId = vehicleId || undefined;
      if (vehicleMode === "new") {
        const ownerId = clients?.find((c) => c.id === clientId)?.userId ?? undefined;
        const { vehicle } = await api.createVehicle(
          {
            brand: newVehicle.brand,
            model: newVehicle.model,
            year: Number(newVehicle.year),
            plate: newVehicle.plate || undefined,
            mileage: Number(newVehicle.mileage) || 0,
            ownerId,
          },
          token
        );
        finalVehicleId = (vehicle as Vehicle).id;
      }

      const payload = {
        title,
        type,
        clientId: clientId || undefined,
        vehicleId: finalVehicleId,
        mechanicId: !isPickupOrDropoff ? mechanicId || undefined : undefined,
        driverId: isPickupOrDropoff ? driverId || undefined : undefined,
        bayId: !isPickupOrDropoff ? bayId || undefined : undefined,
        startAt: new Date(startAt).toISOString(),
        estimatedDurationMin: Number(durationMin) || 60,
        notes: notes || undefined,
        pickupLocation: isPickupOrDropoff ? pickupLocation || undefined : undefined,
        dropoffLocation: isPickupOrDropoff ? dropoffLocation || undefined : undefined,
      };

      if (appointment) {
        await api.updateAppointment(appointment.id, payload, token);
        toast.success("Agendamento atualizado.");
      } else {
        await api.createAppointment(payload, token);
        toast.success("Agendamento criado.");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : appointment
            ? "Não foi possível atualizar o agendamento."
            : "Não foi possível criar o agendamento."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain pr-1">
            <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as AppointmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.entries(TYPE_LABELS) as [AppointmentType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ap-title">Título *</Label>
            <Input
              id="ap-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isPickupOrDropoff ? "Buscar carro na casa do cliente" : "Revisão preventiva"}
            />
          </div>

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

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Veículo</Label>
              <div className="inline-flex rounded-md border p-0.5 text-xs">
                <button
                  type="button"
                  className={`rounded px-2 py-0.5 ${vehicleMode === "existing" ? "bg-primary text-primary-foreground" : ""}`}
                  onClick={() => setVehicleMode("existing")}
                >
                  Já cadastrado
                </button>
                <button
                  type="button"
                  className={`rounded px-2 py-0.5 ${vehicleMode === "new" ? "bg-primary text-primary-foreground" : ""}`}
                  onClick={() => setVehicleMode("new")}
                >
                  Novo veículo
                </button>
              </div>
            </div>
            {vehicleMode === "existing" ? (
              <Select value={vehicleId || "NONE"} onValueChange={(v) => setVehicleId(v === "NONE" ? "" : v)} disabled={!clientId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  {(clientDetail?.vehicles ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} {v.plate ? `(${v.plate})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Marca *" value={newVehicle.brand} onChange={(e) => setNewVehicle((p) => ({ ...p, brand: e.target.value }))} />
                <Input placeholder="Modelo *" value={newVehicle.model} onChange={(e) => setNewVehicle((p) => ({ ...p, model: e.target.value }))} />
                <Input placeholder="Ano *" type="number" value={newVehicle.year} onChange={(e) => setNewVehicle((p) => ({ ...p, year: e.target.value }))} />
                <Input placeholder="Placa" value={newVehicle.plate} onChange={(e) => setNewVehicle((p) => ({ ...p, plate: e.target.value }))} />
              </div>
            )}
          </div>

          {isPickupOrDropoff && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ap-pickup">Retirada (onde buscar)</Label>
                <Input id="ap-pickup" value={pickupLocation} onChange={(e) => setPickupLocation(e.target.value)} placeholder="Ex.: Rua X, 123 — casa do cliente" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ap-dropoff">Entrega (onde deixar)</Label>
                <Input id="ap-dropoff" value={dropoffLocation} onChange={(e) => setDropoffLocation(e.target.value)} placeholder="Ex.: Oficina Reblind" />
              </div>
            </div>
          )}

          {isPickupOrDropoff ? (
            <div className="grid gap-1.5">
              <Label>Motorista *</Label>
              <Select value={driverId || "NONE"} onValueChange={(v) => setDriverId(v === "NONE" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  {(mechanics ?? []).map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          </div>
          <DialogFooter className="border-t pt-3">
            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>{saving ? "Salvando..." : appointment ? "Salvar agendamento" : "Criar agendamento"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
