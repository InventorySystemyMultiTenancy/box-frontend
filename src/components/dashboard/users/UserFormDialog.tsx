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
import type { Role, User } from "@/lib/types";

interface UserFormDialogProps {
  user: User;
  roles: Role[];
  trigger: React.ReactNode;
  onSaved: (updated: User) => void;
}

function buildForm(user: User) {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? "",
    password: "",
    role: user.role,
    roleId: user.roleId ?? "",
    commissionRate: user.commissionRate != null ? String(user.commissionRate * 100) : "",
  };
}

// Único lugar do sistema onde um admin edita nome/e-mail/senha de outro usuário —
// perfil, cargo e comissão já eram editáveis inline na tabela (ver MechanicUsersPanel),
// esse diálogo reúne tudo num só lugar, como já é feito pra cliente/fornecedor/caminhão.
export function UserFormDialog({ user, roles, trigger, onSaved }: UserFormDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => buildForm(user));

  function handleOpenChange(next: boolean) {
    if (next) setForm(buildForm(user));
    setOpen(next);
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.name.trim() || !form.email.trim()) return;
    setSaving(true);
    try {
      const { user: updated } = await api.updateUser(
        user.id,
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          roleId: form.roleId || null,
          commissionRate: form.role === "MECHANIC" && form.commissionRate ? Number(form.commissionRate) / 100 : null,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        },
        token
      );
      toast.success("Usuário atualizado.");
      setOpen(false);
      onSaved(updated as User);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o usuário.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="user-name">Nome *</Label>
              <Input id="user-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-email">E-mail *</Label>
              <Input id="user-email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-phone">Telefone</Label>
              <Input id="user-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="user-password">Nova senha</Label>
              <Input
                id="user-password"
                type="password"
                minLength={6}
                placeholder="Deixe em branco para manter a senha atual"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-role">Perfil</Label>
              <Select value={form.role} onValueChange={(v) => set("role", v as User["role"])}>
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOMER">Cliente</SelectItem>
                  <SelectItem value="MECHANIC">Mecânico</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="user-roleId">Cargo</Label>
              <Select value={form.roleId || "NONE"} onValueChange={(v) => set("roleId", v === "NONE" ? "" : v)}>
                <SelectTrigger id="user-roleId">
                  <SelectValue placeholder="Sem cargo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Sem cargo</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role === "MECHANIC" && (
              <div className="grid gap-1.5">
                <Label htmlFor="user-commission">Comissão (%)</Label>
                <Input
                  id="user-commission"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="ex: 10"
                  value={form.commissionRate}
                  onChange={(e) => set("commissionRate", e.target.value)}
                />
              </div>
            )}
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
