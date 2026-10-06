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
import { ExportButtons } from "@/components/ui/export-buttons";
import { SuggestInput } from "@/components/ui/suggest-input";
import { PayableFormDialog } from "@/components/dashboard/finance/PayableFormDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { AccountPayable, BankAccount, ExpenseClassifications, PayableStatus } from "@/lib/types";

const STATUS_LABELS: Record<PayableStatus, string> = { PENDING: "Pendente", PAID: "Pago", OVERDUE: "Vencido", CANCELLED: "Cancelado" };
const STATUS_VARIANTS: Record<PayableStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "secondary",
};

// A partir de "YYYY-MM" devolve o primeiro e o último dia do mês (para os
// parâmetros from/to que a listagem já aceita) — "" quando nenhum mês escolhido.
function monthRange(month: string): { from?: string; to?: string } {
  if (!month) return {};
  const [year, mo] = month.split("-").map(Number);
  const from = new Date(Date.UTC(year, mo - 1, 1));
  const to = new Date(Date.UTC(year, mo, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function PayablesPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("finance", "manage");
  const [status, setStatus] = useState<string>("");
  const [month, setMonth] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  // Despesas separadas por setor (origem) e por categoria/grupo.
  const [sector, setSector] = useState("");
  const [category, setCategory] = useState("");
  const [group, setGroup] = useState("");

  const { data: classifications } = useQuery({
    queryKey: ["expense-classifications"],
    queryFn: async () => (await api.expenseClassifications(token!)) as ExpenseClassifications,
    enabled: !!token,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["payables", status, month, payeeName, invoiceNumber, sector, category, group],
    queryFn: async () =>
      (
        await api.payables(token!, {
          status: status || undefined,
          ...monthRange(month),
          payeeName: payeeName.trim() || undefined,
          invoiceNumber: invoiceNumber.trim() || undefined,
          sector: sector.trim() || undefined,
          category: category.trim() || undefined,
          group: group.trim() || undefined,
          pageSize: 100,
        })
      ).items as AccountPayable[],
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="p-filter-month" className="text-xs text-muted-foreground">Mês de vencimento</Label>
            <Input id="p-filter-month" type="month" className="w-40" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="p-filter-name" className="text-xs text-muted-foreground">Nome</Label>
            <Input
              id="p-filter-name"
              placeholder="Fornecedor/beneficiário"
              className="w-48"
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="p-filter-invoice" className="text-xs text-muted-foreground">Nº da nota</Label>
            <Input
              id="p-filter-invoice"
              placeholder="Número da nota fiscal"
              className="w-40"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="p-filter-sector" className="text-xs text-muted-foreground">Setor</Label>
            <SuggestInput id="p-filter-sector" className="w-40" options={classifications?.sectors ?? []} placeholder="Todos" value={sector} onChange={(e) => setSector(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="p-filter-category" className="text-xs text-muted-foreground">Categoria</Label>
            <SuggestInput id="p-filter-category" className="w-44" options={classifications?.categories ?? []} placeholder="Todas" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="p-filter-group" className="text-xs text-muted-foreground">Grupo</Label>
            <SuggestInput id="p-filter-group" className="w-44" options={classifications?.groups ?? []} placeholder="Todos" value={group} onChange={(e) => setGroup(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            title="Contas a pagar"
            filename="contas-a-pagar"
            subtitle={[status && `Status: ${STATUS_LABELS[status as PayableStatus]}.`, month && `Vencimento em ${month.split("-").reverse().join("/")}.`].filter(Boolean).join(" ") || undefined}
            rows={data ?? []}
            columns={[
              { header: "Descrição", value: (p) => (p.installmentTotal && p.installmentTotal > 1 ? `${p.description} (${p.installmentNumber}/${p.installmentTotal})` : p.description) },
              { header: "Fornecedor/Beneficiário", value: (p) => p.payeeName },
              { header: "Categoria", value: (p) => p.category },
              { header: "Grupo", value: (p) => p.expenseGroup },
              { header: "Descr. despesa", value: (p) => p.expenseDescription },
              { header: "Setor", value: (p) => p.expenseSector },
              { header: "Nota fiscal", value: (p) => p.invoiceNumber ?? p.invoice?.number },
              { header: "Vencimento", value: (p) => p.dueDate, type: "date" },
              { header: "Status", value: (p) => STATUS_LABELS[p.status as PayableStatus] ?? p.status },
              { header: "Forma", value: (p) => p.paymentMethod },
              { header: "Valor", value: (p) => p.amount, type: "money" },
              { header: "Pago", value: (p) => p.paidAmount, type: "money" },
            ]}
          />
          {canManage && <PayableFormDialog onSaved={refetch} trigger={<Button size="sm"><Plus className="size-4" />Nova conta a pagar</Button>} />}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor/Beneficiário</TableHead>
              <TableHead>Categoria / grupo</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma conta a pagar.</TableCell></TableRow>
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
                  {(payable.invoiceNumber || payable.invoice?.number) && (
                    <span className="block text-xs text-muted-foreground">
                      Nota {payable.invoiceNumber || payable.invoice?.number}
                      {payable.documentNumber ? ` · dupl. ${payable.documentNumber}` : ""}
                    </span>
                  )}
                  {payable.createdBy && <span className="block text-xs text-muted-foreground">Lançado por {payable.createdBy.name}</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{payable.payeeName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {payable.category}
                  {(payable.expenseGroup || payable.expenseDescription) && (
                    <span className="block text-xs">{[payable.expenseGroup, payable.expenseDescription].filter(Boolean).join(" › ")}</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{payable.expenseSector ?? "—"}</TableCell>
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
