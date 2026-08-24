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
import type { Truck, User } from "@/lib/types";

interface TruckFormDialogProps {
  truck?: Truck;
  trigger: React.ReactNode;
  onSaved: () => void;
}

const EMPTY_FORM = { plate: "", brand: "", model: "", year: "", notes: "" };

export function TruckFormDialog({ truck, trigger, onSaved }: TruckFormDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");

  const { data: employees } = useQuery({
    queryKey: ["staff-users"],
    queryFn: async () => ((await api.users(token!)).users as User[]).filter((u) => u.role === "MECHANIC" || u.role === "ADMIN"),
    enabled: !!token && open,
  });

  function buildForm(source?: Truck): typeof EMPTY_FORM {
    return {
      plate: source?.plate ?? "",
      brand: source?.brand ?? "",
      model: source?.model ?? "",
      year: source?.year ? String(source.year) : "",
      notes: source?.notes ?? "",
    };
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(buildForm(truck));
      setAssignedEmployeeId(truck?.assignedEmployeeId ?? "");
    }
    setOpen(next);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.plate.trim()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        plate: form.plate,
        brand: form.brand || undefined,
        model: form.model || undefined,
        year: form.year ? Number(form.year) : undefined,
        notes: form.notes || undefined,
        assignedEmployeeId: assignedEmployeeId || null,
      };
      if (truck) {
        await api.updateTruck(truck.id, payload, token);
        toast.success("Caminhão atualizado.");
      } else {
        await api.createTruck(payload, token);
        toast.success("Caminhão cadastrado.");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o caminhão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{truck ? "Editar caminhão" : "Novo caminhão"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="plate">Placa *</Label>
              <Input id="plate" required value={form.plate} onChange={(e) => set("plate", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="year">Ano</Label>
              <Input id="year" type="number" value={form.year} onChange={(e) => set("year", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="brand">Marca</Label>
              <Input id="brand" value={form.brand} onChange={(e) => set("brand", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" value={form.model} onChange={(e) => set("model", e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label>Funcionário responsável</Label>
              <Select value={assignedEmployeeId || "NONE"} onValueChange={(v) => setAssignedEmployeeId(v === "NONE" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Nenhum</SelectItem>
                  {(employees ?? []).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Input id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
