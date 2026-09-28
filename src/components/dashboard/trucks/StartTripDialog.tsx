"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoCaptureField } from "@/components/ui/photo-capture-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { compressImage } from "@/lib/image-compress";
import { FUEL_LEVEL_OPTIONS } from "@/lib/truck-constants";
import type { Appointment, RecognizedTruckPanel, Truck } from "@/lib/types";

export function StartTripDialog({ truck, onSaved }: { truck: Truck; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [startKm, setStartKm] = useState("");
  const [startFuelLevel, setStartFuelLevel] = useState("");
  const [startCondition, setStartCondition] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [appointmentId, setAppointmentId] = useState("");

  const { data: myPickups } = useQuery({
    queryKey: ["my-pickups-today"],
    queryFn: async () => (await api.myPickupsToday(token!)).appointments as Appointment[],
    enabled: !!token && open,
  });

  function reset() {
    setStartKm("");
    setStartFuelLevel("");
    setStartCondition("");
    setPhoto(null);
    setAppointmentId("");
  }

  // Foto do painel é obrigatória — assim que escolhida, já manda pra IA ler o
  // hodômetro (e o marcador de combustível, se der) e pré-preenche os campos.
  async function handlePhoto(file: File | null) {
    if (!file) {
      setPhoto(null);
      return;
    }
    const compressed = await compressImage(file);
    setPhoto(compressed);
    if (!token) return;
    setReading(true);
    try {
      const { recognized } = await api.recognizeTruckPanel(compressed, token);
      const data = recognized as RecognizedTruckPanel;
      if (data.km != null) setStartKm(String(data.km));
      if (data.fuelLevel) setStartFuelLevel(data.fuelLevel);
      if (data.km != null) {
        toast.success("Painel lido pela IA — confira a km antes de iniciar.");
      } else {
        toast.info("Não consegui ler a km na foto — preencha manualmente.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível analisar a foto do painel.");
    } finally {
      setReading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!photo) {
      toast.error("Tire a foto do painel antes de continuar.");
      return;
    }
    if (!startKm) {
      toast.error("Informe a km atual.");
      return;
    }
    if (!startFuelLevel) {
      toast.error("Selecione o nível de combustível.");
      return;
    }
    setSaving(true);
    try {
      await api.startTruckTrip(
        truck.id,
        { startKm: Number(startKm), startFuelLevel, startCondition: startCondition || undefined, photo, appointmentId: appointmentId || undefined },
        token
      );
      toast.success(`Pilotagem do caminhão ${truck.plate} iniciada.`);
      setOpen(false);
      reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível iniciar a pilotagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="w-full sm:w-auto">Iniciar pilotagem</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar pilotagem — {truck.plate}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PhotoCaptureField
              id="start-photo"
              label="Foto do painel do caminhão *"
              file={photo}
              onChange={handlePhoto}
              busy={reading}
              busyLabel="Lendo painel com IA..."
            />
            <div className="grid gap-1.5">
              <Label htmlFor="start-km">Km atual *</Label>
              <Input
                id="start-km"
                type="number"
                inputMode="numeric"
                min="0"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="start-fuel">Combustível *</Label>
              <Select value={startFuelLevel} onValueChange={setStartFuelLevel}>
                <SelectTrigger id="start-fuel">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_LEVEL_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="start-condition">Estado do caminhão</Label>
              <Input id="start-condition" placeholder="Ex.: sem avarias visíveis" value={startCondition} onChange={(e) => setStartCondition(e.target.value)} />
            </div>
            {myPickups && myPickups.length > 0 && (
              <div className="col-span-2 grid gap-1.5">
                <Label>Vincular a um agendamento de hoje (opcional)</Label>
                <Select value={appointmentId || "NONE"} onValueChange={(v) => setAppointmentId(v === "NONE" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    {myPickups.map((appt) => (
                      <SelectItem key={appt.id} value={appt.id}>
                        {new Date(appt.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — {appt.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={saving || reading}>
              {saving ? "Iniciando..." : "Iniciar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
