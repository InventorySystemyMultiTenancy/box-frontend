"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Fuel, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { RecognizedFuelPump, Truck } from "@/lib/types";

export function RefuelingDialog({ truck, onSaved }: { truck: Truck; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reading, setReading] = useState(false);
  const [currentKm, setCurrentKm] = useState("");
  const [liters, setLiters] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [pricePerLiter, setPricePerLiter] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  function reset() {
    setCurrentKm("");
    setLiters("");
    setAmountPaid("");
    setPricePerLiter("");
    setNotes("");
    setPhoto(null);
  }

  // Foto da bomba é obrigatória — assim que escolhida, a IA já tenta ler valor
  // pago, litros e preço por litro do visor.
  async function handlePhoto(file: File | null) {
    setPhoto(file);
    if (!file || !token) return;
    setReading(true);
    try {
      const { recognized } = await api.recognizeFuelPump(file, token);
      const data = recognized as RecognizedFuelPump;
      if (data.amountPaid != null) setAmountPaid(String(data.amountPaid));
      if (data.liters != null) setLiters(String(data.liters));
      if (data.pricePerLiter != null) setPricePerLiter(String(data.pricePerLiter));
      if (data.amountPaid != null || data.liters != null) {
        toast.success("Bomba lida pela IA — confira os valores antes de salvar.");
      } else {
        toast.info("Não consegui ler o visor — preencha manualmente.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível analisar a foto da bomba.");
    } finally {
      setReading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !currentKm || !liters || !amountPaid || !photo) {
      toast.error("A foto da bomba é obrigatória.");
      return;
    }
    setSaving(true);
    try {
      await api.createTruckRefueling(
        truck.id,
        {
          currentKm: Number(currentKm),
          liters: Number(liters),
          amountPaid: Number(amountPaid),
          pricePerLiter: pricePerLiter ? Number(pricePerLiter) : undefined,
          notes: notes || undefined,
          photo,
        },
        token
      );
      toast.success(`Abastecimento do caminhão ${truck.plate} registrado.`);
      setOpen(false);
      reset();
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar o abastecimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Fuel className="size-4" />
          Abastecer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar abastecimento — {truck.plate}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="refuel-photo" className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-muted-foreground" />
                Foto da bomba de combustível *
              </Label>
              <Input
                id="refuel-photo"
                type="file"
                accept="image/*"
                capture="environment"
                required
                onChange={(e) => handlePhoto(e.target.files?.[0] ?? null)}
              />
              {reading && <span className="text-xs text-muted-foreground">Lendo bomba com IA...</span>}
              {photo && !reading && <span className="text-xs text-muted-foreground">{photo.name}</span>}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="refuel-km">Km atual *</Label>
              <Input id="refuel-km" type="number" min="0" required value={currentKm} onChange={(e) => setCurrentKm(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="refuel-liters">Litros *</Label>
              <Input id="refuel-liters" type="number" min="0" step="0.01" required value={liters} onChange={(e) => setLiters(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="refuel-amount">Valor pago (R$) *</Label>
              <Input id="refuel-amount" type="number" min="0" step="0.01" required value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="refuel-price">Preço por litro (R$)</Label>
              <Input id="refuel-price" type="number" min="0" step="0.01" value={pricePerLiter} onChange={(e) => setPricePerLiter(e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="refuel-notes">Observações</Label>
              <Input id="refuel-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || reading}>
              {saving ? "Salvando..." : "Salvar abastecimento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
