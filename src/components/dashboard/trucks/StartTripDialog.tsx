"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { RecognizedTruckPanel, Truck } from "@/lib/types";

export function StartTripDialog({ truck, onSaved }: { truck: Truck; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [startKm, setStartKm] = useState("");
  const [startFuelLevel, setStartFuelLevel] = useState("");
  const [startCondition, setStartCondition] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  function reset() {
    setStartKm("");
    setStartFuelLevel("");
    setStartCondition("");
    setPhoto(null);
  }

  // Foto do painel é obrigatória — assim que escolhida, já manda pra IA ler o
  // hodômetro (e o marcador de combustível, se der) e pré-preenche os campos.
  async function handlePhoto(file: File | null) {
    setPhoto(file);
    if (!file || !token) return;
    setReading(true);
    try {
      const { recognized } = await api.recognizeTruckPanel(file, token);
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
    if (!token || !startKm || !startFuelLevel.trim() || !photo) {
      toast.error("A foto do painel do caminhão é obrigatória.");
      return;
    }
    setSaving(true);
    try {
      await api.startTruckTrip(
        truck.id,
        { startKm: Number(startKm), startFuelLevel, startCondition: startCondition || undefined, photo },
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
        <Button size="sm">Iniciar pilotagem</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar pilotagem — {truck.plate}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="start-photo" className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-muted-foreground" />
                Foto do painel do caminhão *
              </Label>
              <Input id="start-photo" type="file" accept="image/*" capture="environment" required onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)} />
              {reading && <span className="text-xs text-muted-foreground">Lendo painel com IA...</span>}
              {photo && !reading && <span className="text-xs text-muted-foreground">{photo.name}</span>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="start-km">Km atual *</Label>
              <Input id="start-km" type="number" min="0" required value={startKm} onChange={(e) => setStartKm(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="start-fuel">Combustível *</Label>
              <Input id="start-fuel" placeholder="Ex.: 3/4" required value={startFuelLevel} onChange={(e) => setStartFuelLevel(e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="start-condition">Estado do caminhão</Label>
              <Input id="start-condition" placeholder="Ex.: sem avarias visíveis" value={startCondition} onChange={(e) => setStartCondition(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || reading}>
              {saving ? "Iniciando..." : "Iniciar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
