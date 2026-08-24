"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { AccountPayable, BankAccount, PayableStatus } from "@/lib/types";

const STATUS_LABELS: Record<PayableStatus, string> = { PENDING: "Pendente", PAID: "Pago", OVERDUE: "Vencido", CANCELLED: "Cancelado" };
const STATUS_VARIANTS: Record<PayableStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "secondary",
};

export default function PayablesPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("finance", "manage");
  const [status, setStatus] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["payables", status],
    queryFn: async () => (await api.payables(token!, { status: status || undefined, pageSize: 50 })).items as AccountPayable[],
    enabled: !!token,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["payables"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
  }

  async function handleCancel(payable: AccountPayable) {
    if (!token || !confirm(`Cancelar "${payable.description}"?`)) return;
    try {
      await api.cancelPayable(payable.id, token);
      toast.success("Conta cancelada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível cancelar.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage && <PayableFormDialog onSaved={refetch} trigger={<Button size="sm"><Plus className="size-4" />Nova conta a pagar</Button>} />}
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor/Beneficiário</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma conta a pagar.</TableCell></TableRow>
            )}
            {(data ?? []).map((payable) => (
              <TableRow key={payable.id}>
                <TableCell className="font-medium">
                  {payable.description}
                  {payable.installmentTotal && payable.installmentTotal > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({payable.installmentNumber}/{payable.installmentTotal})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{payable.payeeName}</TableCell>
                <TableCell className="text-muted-foreground">{payable.category}</TableCell>
                <TableCell>R$ {payable.amount.toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(payable.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANTS[payable.status]}>{STATUS_LABELS[payable.status]}</Badge></TableCell>
                <TableCell>
                  {canManage && (payable.status === "PENDING" || payable.status === "OVERDUE") && (
                    <div className="flex justify-end gap-2">
                      <PayDialog payable={payable} onSaved={refetch} />
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(payable)}>
                        Cancelar
                      </Button>
                    </div>
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

function PayableFormDialog({ trigger, onSaved }: { trigger: React.ReactNode; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ description: "", category: "", payeeName: "", amount: "", dueDate: "", installments: "1", notes: "" });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await api.createPayables(
        {
          description: form.description,
          category: form.category,
          payeeName: form.payeeName,
          amount: Number(form.amount),
          dueDate: form.dueDate,
          installments: Number(form.installments) || 1,
          notes: form.notes || undefined,
        },
        token
      );
      toast.success("Conta a pagar criada.");
      setOpen(false);
      setForm({ description: "", category: "", payeeName: "", amount: "", dueDate: "", installments: "1", notes: "" });
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conta a pagar</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="p-description">Descrição *</Label>
            <Input id="p-description" required value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="p-category">Categoria *</Label>
              <Input id="p-category" required value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="ALUGUEL" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-payee">Beneficiário *</Label>
              <Input id="p-payee" required value={form.payeeName} onChange={(e) => set("payeeName", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-amount">Valor *</Label>
              <Input id="p-amount" type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-due">Vencimento *</Label>
              <Input id="p-due" type="date" required value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-installments">Parcelas</Label>
              <Input id="p-installments" type="number" min="1" max="60" value={form.installments} onChange={(e) => set("installments", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="p-notes">Observações</Label>
            <Input id="p-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ payable, onSaved }: { payable: AccountPayable; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [paidAmount, setPaidAmount] = useState(String(payable.amount));
  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await api.bankAccounts(token!)).accounts as BankAccount[],
    enabled: !!token && open,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await api.payPayable(payable.id, { paidAmount: Number(paidAmount), bankAccountId: bankAccountId || undefined, paymentMethod: paymentMethod || undefined }, token);
      toast.success("Conta baixada como paga.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar o pagamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Pagar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pagar &ldquo;{payable.description}&rdquo;</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Valor pago</Label>
            <Input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Conta bancária</Label>
            <Select value={bankAccountId || "NONE"} onValueChange={(v) => setBankAccountId(v === "NONE" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">—</SelectItem>
                {(accounts ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Forma de pagamento</Label>
            <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="PIX" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Confirmar pagamento"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
