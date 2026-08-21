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
import type { AccountReceivable, BankAccount, Client, ReceivableStatus } from "@/lib/types";

const STATUS_LABELS: Record<ReceivableStatus, string> = { PENDING: "Pendente", RECEIVED: "Recebido", OVERDUE: "Vencido", CANCELLED: "Cancelado" };
const STATUS_VARIANTS: Record<ReceivableStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  RECEIVED: "default",
  OVERDUE: "destructive",
  CANCELLED: "secondary",
};

export default function ReceivablesPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("finance", "manage");
  const [status, setStatus] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["receivables", status],
    queryFn: async () => (await api.receivables(token!, { status: status || undefined, pageSize: 50 })).items as AccountReceivable[],
    enabled: !!token,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["receivables"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
  }

  async function handleCancel(receivable: AccountReceivable) {
    if (!token || !confirm(`Cancelar "${receivable.description}"?`)) return;
    try {
      await api.cancelReceivable(receivable.id, token);
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
        {canManage && <ReceivableFormDialog onSaved={refetch} trigger={<Button size="sm"><Plus className="size-4" />Nova conta a receber</Button>} />}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Cliente</TableHead>
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
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma conta a receber.</TableCell></TableRow>
            )}
            {(data ?? []).map((receivable) => (
              <TableRow key={receivable.id}>
                <TableCell className="font-medium">
                  {receivable.description}
                  {receivable.installmentTotal && receivable.installmentTotal > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({receivable.installmentNumber}/{receivable.installmentTotal})
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{receivable.client?.name || "—"}</TableCell>
                <TableCell className="text-muted-foreground">{receivable.category}</TableCell>
                <TableCell>R$ {receivable.amount.toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(receivable.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANTS[receivable.status]}>{STATUS_LABELS[receivable.status]}</Badge></TableCell>
                <TableCell>
                  {canManage && (receivable.status === "PENDING" || receivable.status === "OVERDUE") && (
                    <div className="flex justify-end gap-2">
                      <ReceiveDialog receivable={receivable} onSaved={refetch} />
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(receivable)}>
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

function ReceivableFormDialog({ trigger, onSaved }: { trigger: React.ReactNode; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ description: "", category: "", clientId: "", amount: "", dueDate: "", installments: "1", notes: "" });

  const { data: clients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => (await api.clients(token!, { pageSize: 100 })).items as Client[],
    enabled: !!token && open,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await api.createReceivables(
        {
          description: form.description,
          category: form.category,
          clientId: form.clientId || undefined,
          amount: Number(form.amount),
          dueDate: form.dueDate,
          installments: Number(form.installments) || 1,
          notes: form.notes || undefined,
        },
        token
      );
      toast.success("Conta a receber criada.");
      setOpen(false);
      setForm({ description: "", category: "", clientId: "", amount: "", dueDate: "", installments: "1", notes: "" });
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
          <DialogTitle>Nova conta a receber</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="r-description">Descrição *</Label>
            <Input id="r-description" required value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="r-category">Categoria *</Label>
              <Input id="r-category" required value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="SERVIÇO" />
            </div>
            <div className="grid gap-1.5">
              <Label>Cliente</Label>
              <Select value={form.clientId || "NONE"} onValueChange={(v) => set("clientId", v === "NONE" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  {(clients ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="r-amount">Valor *</Label>
              <Input id="r-amount" type="number" min="0" step="0.01" required value={form.amount} onChange={(e) => set("amount", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r-due">Vencimento *</Label>
              <Input id="r-due" type="date" required value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="r-installments">Parcelas</Label>
              <Input id="r-installments" type="number" min="1" max="60" value={form.installments} onChange={(e) => set("installments", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="r-notes">Observações</Label>
            <Input id="r-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReceiveDialog({ receivable, onSaved }: { receivable: AccountReceivable; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState(String(receivable.amount));
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
      await api.receiveReceivable(receivable.id, { receivedAmount: Number(receivedAmount), bankAccountId: bankAccountId || undefined, paymentMethod: paymentMethod || undefined }, token);
      toast.success("Recebimento confirmado.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível confirmar o recebimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Receber</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Receber &ldquo;{receivable.description}&rdquo;</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Valor recebido</Label>
            <Input type="number" min="0" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} />
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
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Confirmar recebimento"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
