"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Truck } from "@/lib/types";

export function StartTripDialog({ truck, onSaved }: { truck: Truck; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !startKm || !startFuelLevel.trim()) return;
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
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="start-photo">Foto (opcional)</Label>
              <Input id="start-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Iniciando..." : "Iniciar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
