"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/lib/types";

interface ClientFormDialogProps {
  client?: Client;
  trigger: React.ReactNode;
  onSaved: () => void;
}

const EMPTY_FORM = {
  name: "",
  cpfCnpj: "",
  rg: "",
  birthDate: "",
  phone: "",
  whatsapp: "",
  email: "",
  addressLine: "",
  zipCode: "",
  city: "",
  state: "",
  company: "",
  clientType: "INDIVIDUAL" as "INDIVIDUAL" | "COMPANY",
  notes: "",
  internalNotes: "",
};

export function ClientFormDialog({ client, trigger, onSaved }: ClientFormDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function buildForm(source?: Client): typeof EMPTY_FORM {
    return {
      name: source?.name ?? "",
      cpfCnpj: source?.cpfCnpj ?? "",
      rg: source?.rg ?? "",
      birthDate: source?.birthDate ? source.birthDate.slice(0, 10) : "",
      phone: source?.phone ?? "",
      whatsapp: source?.whatsapp ?? "",
      email: source?.email ?? "",
      addressLine: source?.addressLine ?? "",
      zipCode: source?.zipCode ?? "",
      city: source?.city ?? "",
      state: source?.state ?? "",
      company: source?.company ?? "",
      clientType: source?.clientType ?? "INDIVIDUAL",
      notes: source?.notes ?? "",
      internalNotes: source?.internalNotes ?? "",
    };
  }

  function handleOpenChange(next: boolean) {
    if (next) setForm(buildForm(client));
    setOpen(next);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      if (client) {
        await api.updateClient(client.id, payload, token);
        toast.success("Cliente atualizado.");
      } else {
        await api.createClient(payload, token);
        toast.success("Cliente cadastrado.");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="clientType">Tipo</Label>
              <Select value={form.clientType} onValueChange={(v) => set("clientType", v as "INDIVIDUAL" | "COMPANY")}>
                <SelectTrigger id="clientType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDUAL">Pessoa física</SelectItem>
                  <SelectItem value="COMPANY">Empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="company">Empresa</Label>
              <Input id="company" value={form.company} onChange={(e) => set("company", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
              <Input id="cpfCnpj" value={form.cpfCnpj} onChange={(e) => set("cpfCnpj", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rg">RG</Label>
              <Input id="rg" value={form.rg} onChange={(e) => set("rg", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="birthDate">Nascimento</Label>
              <Input id="birthDate" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="addressLine">Endereço</Label>
              <Input id="addressLine" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="zipCode">CEP</Label>
              <Input id="zipCode" value={form.zipCode} onChange={(e) => set("zipCode", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="notes">Observação (visível ao cliente)</Label>
              <Input id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="internalNotes">Observação interna</Label>
              <Input id="internalNotes" value={form.internalNotes} onChange={(e) => set("internalNotes", e.target.value)} />
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
