"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { InsuranceCompany } from "@/lib/types";

interface InsuranceCompanyFormDialogProps {
  company?: InsuranceCompany;
  trigger: React.ReactNode;
  onSaved: () => void;
}

const EMPTY_FORM = {
  legalName: "",
  tradeName: "",
  cnpj: "",
  addressLine: "",
  city: "",
  state: "",
  phone: "",
  email: "",
  contactName: "",
  notes: "",
};

export function InsuranceCompanyFormDialog({ company, trigger, onSaved }: InsuranceCompanyFormDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [accredited, setAccredited] = useState(false);

  function buildForm(source?: InsuranceCompany): typeof EMPTY_FORM {
    return {
      legalName: source?.legalName ?? "",
      tradeName: source?.tradeName ?? "",
      cnpj: source?.cnpj ?? "",
      addressLine: source?.addressLine ?? "",
      city: source?.city ?? "",
      state: source?.state ?? "",
      phone: source?.phone ?? "",
      email: source?.email ?? "",
      contactName: source?.contactName ?? "",
      notes: source?.notes ?? "",
    };
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(buildForm(company));
      setAccredited(company?.accredited ?? false);
    }
    setOpen(next);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.legalName.trim()) return;
    setSaving(true);
    try {
      const payload = { ...Object.fromEntries(Object.entries(form).filter(([, v]) => v !== "")), accredited };
      if (company) {
        await api.updateInsuranceCompany(company.id, payload, token);
        toast.success("Seguradora atualizada.");
      } else {
        await api.createInsuranceCompany(payload, token);
        toast.success("Seguradora cadastrada.");
      }
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a seguradora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{company ? "Editar seguradora" : "Nova seguradora"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="legalName">Razão social *</Label>
              <Input id="legalName" required value={form.legalName} onChange={(e) => set("legalName", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tradeName">Nome fantasia</Label>
              <Input id="tradeName" value={form.tradeName} onChange={(e) => set("tradeName", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="contactName">Contato responsável</Label>
              <Input id="contactName" value={form.contactName} onChange={(e) => set("contactName", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
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
            <div className="col-span-2 flex items-center gap-2">
              <Checkbox id="accredited" checked={accredited} onCheckedChange={(v) => setAccredited(v === true)} />
              <Label htmlFor="accredited" className="font-normal">Seguradora credenciada</Label>
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
