"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Vehicle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type VehicleForm = {
  brand: string;
  model: string;
  year: string;
  plate: string;
  mileage: string;
  color: string;
  version: string;
  engine: string;
  fuelType: string;
  chassi: string;
  renavam: string;
};

function toForm(vehicle: Vehicle): VehicleForm {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    year: String(vehicle.year),
    plate: vehicle.plate ?? "",
    mileage: String(vehicle.mileage ?? 0),
    color: vehicle.color ?? "",
    version: vehicle.version ?? "",
    engine: vehicle.engine ?? "",
    fuelType: vehicle.fuelType ?? "",
    chassi: vehicle.chassi ?? "",
    renavam: vehicle.renavam ?? "",
  };
}

const OPTIONAL_FIELDS: { key: keyof VehicleForm; label: string }[] = [
  { key: "color", label: "Cor" },
  { key: "version", label: "Versão" },
  { key: "engine", label: "Motor" },
  { key: "fuelType", label: "Combustível" },
  { key: "chassi", label: "Chassi" },
  { key: "renavam", label: "Renavam" },
];

/**
 * Corrige os dados do veículo de um projeto (placa esquecida/errada, modelo, ano, km...).
 * Vale para o veículo em si — outros projetos do mesmo carro passam a mostrar os dados novos.
 */
export function EditVehicleDialog({ vehicle, onSaved }: { vehicle: Vehicle; onSaved: (vehicle: Vehicle) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<VehicleForm>(() => toForm(vehicle));

  function handleOpenChange(next: boolean) {
    if (next) setForm(toForm(vehicle));
    setOpen(next);
  }

  function set(key: keyof VehicleForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const year = Number(form.year);
    if (!form.brand.trim() || !form.model.trim() || !Number.isInteger(year) || year < 1950 || year > 2100) {
      toast.error("Informe marca, modelo e um ano válido.");
      return;
    }
    setBusy(true);
    try {
      const { vehicle: updated } = await api.updateVehicle(
        vehicle.id,
        {
          brand: form.brand.trim(),
          model: form.model.trim(),
          year,
          plate: form.plate.trim().toUpperCase(),
          mileage: Math.max(0, Math.floor(Number(form.mileage) || 0)),
          ...Object.fromEntries(OPTIONAL_FIELDS.map(({ key }) => [key, form[key].trim()])),
        },
        token
      );
      onSaved(updated as Vehicle);
      toast.success("Dados do veículo atualizados.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o veículo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Editar veículo
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar veículo</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="grid min-h-0 grid-cols-1 gap-3 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ev-brand">Marca *</Label>
              <Input id="ev-brand" required value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-model">Modelo *</Label>
              <Input id="ev-model" required value={form.model} onChange={(e) => set("model", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-year">Ano *</Label>
              <Input id="ev-year" type="number" min="1950" max="2100" required value={form.year} onChange={(e) => set("year", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-plate">Placa</Label>
              <Input id="ev-plate" value={form.plate} onChange={(e) => set("plate", e.target.value)} placeholder="ABC1D23" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ev-mileage">Quilometragem</Label>
              <Input id="ev-mileage" type="number" min="0" value={form.mileage} onChange={(e) => set("mileage", e.target.value)} />
            </div>
            {OPTIONAL_FIELDS.map(({ key, label }) => (
              <div key={key} className="grid gap-1.5">
                <Label htmlFor={`ev-${key}`}>{label}</Label>
                <Input id={`ev-${key}`} value={form[key]} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </div>
          <DialogFooter className="border-t pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
