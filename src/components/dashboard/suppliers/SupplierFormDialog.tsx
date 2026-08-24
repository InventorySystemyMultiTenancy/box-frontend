"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Supplier } from "@/lib/types";

interface SupplierFormDialogProps {
  supplier?: Supplier;
  trigger: React.ReactNode;
  onSaved: () => void;
}

const EMPTY_FORM = {
  name: "",
  cpfCnpj: "",
  contactName: "",
  phone: "",
  whatsapp: "",
  email: "",
  addressLine: "",
  city: "",
  state: "",
  notes: "",
};

export function SupplierFormDialog({ supplier, trigger, onSaved }: SupplierFormDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function buildForm(source?: Supplier): typeof EMPTY_FORM {
    return {
      name: source?.name ?? "",
      cpfCnpj: source?.cpfCnpj ?? "",
      contactName: source?.contactName ?? "",
      phone: source?.phone ?? "",
      whatsapp: source?.whatsapp ?? "",
      email: source?.email ?? "",
      addressLine: source?.addressLine ?? "",
      city: source?.city ?? "",
      state: source?.state ?? "",
      notes: source?.notes ?? "",
    };
  }

  function handleOpenChange(next: boolean) {
    if (next) setForm(buildForm(supplier));
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
      if (supplier) {
        await api.updateSupplier(supplier.id, payload, token);
        toast.success("Fornecedor atualizado.");
      } else {
        await api.createSupplier(payload, token);
        toast.success("Fornecedor cadastrado.");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o fornecedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="name">Nome/Razão social *</Label>
              <Input id="name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cpfCnpj">CNPJ/CPF</Label>
              <Input id="cpfCnpj" value={form.cpfCnpj} onChange={(e) => set("cpfCnpj", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contactName">Contato</Label>
              <Input id="contactName" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
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
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="addressLine">Endereço</Label>
              <Input id="addressLine" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
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
