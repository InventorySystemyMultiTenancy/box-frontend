"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Fuel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoCaptureField } from "@/components/ui/photo-capture-field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { compressImage } from "@/lib/image-compress";
import type { RecognizedFuelPump, RecognizedTruckPanel, Truck } from "@/lib/types";

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
  // Foto do painel (opcional): a IA lê o hodômetro e preenche a km; fica salva no histórico.
  const [panelPhoto, setPanelPhoto] = useState<File | null>(null);
  const [readingPanel, setReadingPanel] = useState(false);

  function reset() {
    setCurrentKm("");
    setLiters("");
    setAmountPaid("");
    setPricePerLiter("");
    setNotes("");
    setPhoto(null);
    setPanelPhoto(null);
  }

  async function handlePanelPhoto(file: File | null) {
    if (!file) {
      setPanelPhoto(null);
      return;
    }
    const compressed = await compressImage(file);
    setPanelPhoto(compressed);
    if (!token) return;
    setReadingPanel(true);
    try {
      const { recognized } = await api.recognizeTruckPanel(compressed, token);
      const data = recognized as RecognizedTruckPanel;
      if (data.km != null) {
        setCurrentKm(String(data.km));
        toast.success(`Painel lido pela IA: ${data.km.toLocaleString("pt-BR")} km — confira antes de salvar.`);
      } else {
        toast.info("Não consegui ler o hodômetro — preencha a km manualmente.");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível analisar a foto do painel.");
    } finally {
      setReadingPanel(false);
    }
  }

  // Foto da bomba é obrigatória — assim que escolhida, a IA já tenta ler valor
  // pago, litros e preço por litro do visor.
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
      const { recognized } = await api.recognizeFuelPump(compressed, token);
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
    if (!token) return;
    if (!photo) {
      toast.error("Tire a foto da bomba antes de continuar.");
      return;
    }
    if (!currentKm) {
      toast.error("Informe a km atual.");
      return;
    }
    if (!liters) {
      toast.error("Informe os litros abastecidos.");
      return;
    }
    if (!amountPaid) {
      toast.error("Informe o valor pago.");
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
          panelPhoto,
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
        <Button size="lg" variant="outline" className="w-full sm:w-auto">
          <Fuel className="size-4" />
          Abastecer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar abastecimento — {truck.plate}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PhotoCaptureField
              id="refuel-photo"
              label="Foto da bomba de combustível *"
              file={photo}
              onChange={handlePhoto}
              busy={reading}
              busyLabel="Lendo bomba com IA..."
            />
            <PhotoCaptureField
              id="refuel-panel-photo"
              label="Foto do painel (km)"
              file={panelPhoto}
              onChange={handlePanelPhoto}
              busy={readingPanel}
              busyLabel="Lendo painel com IA..."
            />
            <div className="grid gap-1.5">
              <Label htmlFor="refuel-km">Km atual *</Label>
              <Input id="refuel-km" type="number" inputMode="numeric" min="0" value={currentKm} onChange={(e) => setCurrentKm(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="refuel-liters">Litros *</Label>
              <Input id="refuel-liters" type="number" inputMode="decimal" min="0" step="0.01" value={liters} onChange={(e) => setLiters(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="refuel-amount">Valor pago (R$) *</Label>
              <Input id="refuel-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="refuel-price">Preço por litro (R$)</Label>
              <Input id="refuel-price" type="number" inputMode="decimal" min="0" step="0.01" value={pricePerLiter} onChange={(e) => setPricePerLiter(e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="refuel-notes">Observações</Label>
              <Input id="refuel-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={saving || reading || readingPanel}>
              {saving ? "Salvando..." : "Salvar abastecimento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
