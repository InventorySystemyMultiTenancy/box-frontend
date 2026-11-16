"use client";

import { useState } from "react";
import { UserPen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { VehicleOwner } from "@/lib/types";
import { isPlaceholderEmail } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type ClientForm = { name: string; phone: string; whatsapp: string; email: string; cpfCnpj: string };

function toForm(owner: VehicleOwner): ClientForm {
  const email = owner.client?.email ?? owner.email ?? "";
  return {
    name: owner.client?.name ?? owner.name,
    phone: owner.client?.phone ?? owner.phone ?? "",
    whatsapp: owner.client?.whatsapp ?? "",
    email: isPlaceholderEmail(email) ? "" : email,
    cpfCnpj: owner.client?.cpfCnpj ?? "",
  };
}

const FIELDS: { key: keyof ClientForm; label: string; type?: string; placeholder?: string }[] = [
  { key: "name", label: "Nome *" },
  { key: "phone", label: "Telefone", type: "tel", placeholder: "(11) 90000-0000" },
  { key: "whatsapp", label: "WhatsApp", type: "tel", placeholder: "(11) 90000-0000" },
  { key: "email", label: "E-mail", type: "email" },
  { key: "cpfCnpj", label: "CPF/CNPJ" },
];

/**
 * Edita, de dentro do projeto, os dados do cliente dono do veículo. Vale para o cliente em
 * si — outros projetos/veículos dele passam a mostrar os dados novos.
 */
export function EditClientDialog({ orderId, owner, onSaved }: { orderId: string; owner: VehicleOwner; onSaved: (owner: VehicleOwner) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ClientForm>(() => toForm(owner));

  function handleOpenChange(next: boolean) {
    if (next) setForm(toForm(owner));
    setOpen(next);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (form.name.trim().length < 2) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    setBusy(true);
    try {
      const { owner: updated } = await api.updateOrderClient(
        orderId,
        {
          name: form.name.trim(),
          phone: form.phone.trim(),
          whatsapp: form.whatsapp.trim(),
          email: form.email.trim(),
          cpfCnpj: form.cpfCnpj.trim(),
        },
        token
      );
      onSaved(updated);
      toast.success("Dados do cliente atualizados.");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o cliente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPen className="size-4" />
          Editar cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map(({ key, label, type, placeholder }) => (
              <div key={key} className={`grid gap-1.5 ${key === "name" ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={`ec-${key}`}>{label}</Label>
                <Input
                  id={`ec-${key}`}
                  type={type ?? "text"}
                  required={key === "name"}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Os dados valem para o cliente em todos os veículos e projetos dele. O e-mail também é o login do portal do cliente.
          </p>
          <DialogFooter>
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
