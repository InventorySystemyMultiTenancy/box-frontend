"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { BankAccount } from "@/lib/types";

export default function BankAccountsPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("finance", "manage");

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await api.bankAccounts(token!)).accounts as BankAccount[],
    enabled: !!token,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
  }

  async function handleArchive(account: BankAccount) {
    if (!token || !confirm(`Arquivar a conta "${account.name}"?`)) return;
    try {
      await api.archiveBankAccount(account.id, token);
      toast.success("Conta arquivada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível arquivar a conta.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        {canManage && <BankAccountFormDialog onSaved={refetch} trigger={<Button size="sm"><Plus className="size-4" />Nova conta</Button>} />}
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead>Saldo inicial</TableHead>
              <TableHead>Saldo atual</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            )}
            {!isLoading && (accounts ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma conta bancária cadastrada.</TableCell>
              </TableRow>
            )}
            {(accounts ?? []).map((account) => (
              <TableRow key={account.id}>
                <TableCell className="font-medium">{account.name}</TableCell>
                <TableCell className="text-muted-foreground">{account.bank || "—"}</TableCell>
                <TableCell>R$ {account.initialBalance.toFixed(2)}</TableCell>
                <TableCell className={account.currentBalance < 0 ? "text-destructive" : ""}>
                  R$ {account.currentBalance.toFixed(2)}
                </TableCell>
                <TableCell>
                  {canManage && (
                    <Trash2
                      className="size-4 cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => handleArchive(account)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function BankAccountFormDialog({ trigger, onSaved }: { trigger: React.ReactNode; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", bank: "", agency: "", accountNumber: "", initialBalance: "0" });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.name.trim()) return;
    setSaving(true);
    try {
      await api.createBankAccount(
        { name: form.name, bank: form.bank || undefined, agency: form.agency || undefined, accountNumber: form.accountNumber || undefined, initialBalance: Number(form.initialBalance) || 0 },
        token
      );
      toast.success("Conta bancária criada.");
      setOpen(false);
      setForm({ name: "", bank: "", agency: "", accountNumber: "", initialBalance: "0" });
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova conta bancária</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="bank-name">Nome *</Label>
            <Input id="bank-name" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Caixa principal" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bank-bank">Banco</Label>
            <Input id="bank-bank" value={form.bank} onChange={(e) => set("bank", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="bank-agency">Agência</Label>
              <Input id="bank-agency" value={form.agency} onChange={(e) => set("agency", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bank-account">Conta</Label>
              <Input id="bank-account" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="bank-initial">Saldo inicial</Label>
            <Input id="bank-initial" type="number" step="0.01" value={form.initialBalance} onChange={(e) => set("initialBalance", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Criar conta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
