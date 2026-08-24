"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Truck, TruckTrip } from "@/lib/types";

export function FinishTripDialog({ truck, trip, onSaved }: { truck: Truck; trip: TruckTrip; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [endKm, setEndKm] = useState("");
  const [endFuelLevel, setEndFuelLevel] = useState("");
  const [endCondition, setEndCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !endKm || !endFuelLevel.trim() || !photo) {
      toast.error("A foto de devolução é obrigatória.");
      return;
    }
    setSaving(true);
    try {
      await api.finishTruckTrip(
        truck.id,
        trip.id,
        { endKm: Number(endKm), endFuelLevel, endCondition: endCondition || undefined, notes: notes || undefined, photo },
        token
      );
      toast.success(`Caminhão ${truck.plate} devolvido.`);
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível finalizar a pilotagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Finalizar pilotagem</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Devolver caminhão — {truck.plate}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="end-km">Km na devolução *</Label>
              <Input id="end-km" type="number" min={trip.startKm} required value={endKm} onChange={(e) => setEndKm(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="end-fuel">Combustível na devolução *</Label>
              <Input id="end-fuel" placeholder="Ex.: 1/2" required value={endFuelLevel} onChange={(e) => setEndFuelLevel(e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="end-condition">Estado do caminhão</Label>
              <Input id="end-condition" value={endCondition} onChange={(e) => setEndCondition(e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="end-notes">Observações</Label>
              <Input id="end-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="end-photo">Foto da devolução (dos veículos entregues no caminhão) *</Label>
              <Input id="end-photo" type="file" accept="image/*" required onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
              {photo && <span className="text-xs text-muted-foreground">{photo.name}</span>}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Devolvendo..." : "Confirmar devolução"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
