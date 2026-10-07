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
import { settlementDateParam, todayInputValue } from "@/lib/dates";
import type { AccountPayable, BankAccount, ExpenseClassifications, PayableStatus } from "@/lib/types";

const STATUS_LABELS: Record<PayableStatus, string> = { PENDING: "Pendente", PAID: "Pago", OVERDUE: "Vencido", CANCELLED: "Cancelado" };
const STATUS_VARIANTS: Record<PayableStatus, "default" | "secondary" | "outline" | "destructive"> = {
  PENDING: "outline",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "secondary",
};

type PayableView = "open" | "paid" | "cancelled" | "all";

const VIEW_LABELS: Record<PayableView, string> = {
  open: "A pagar",
  paid: "Pagas",
  cancelled: "Canceladas",
  all: "Todas",
};

const dateLabel = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function PayablesPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("finance", "manage");
  // Separação principal: a pagar (pendentes/vencidas), pagas, canceladas ou todas.
  const [view, setView] = useState<PayableView>("open");
  // Período, pelo vencimento ou pela data em que foi pago.
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateField, setDateField] = useState<"dueDate" | "paidAt">("dueDate");
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
    queryKey: ["payables", view, from, to, dateField, payeeName, invoiceNumber, sector, category, group],
    queryFn: async () =>
      (
        await api.payables(token!, {
          ...(view === "open" ? { situation: "open" as const } : view === "paid" ? { situation: "paid" as const } : view === "cancelled" ? { status: "CANCELLED" } : {}),
          from: from || undefined,
          to: to || undefined,
          dateField: from || to ? dateField : undefined,
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
      <div className="inline-flex w-fit flex-wrap rounded-md border p-0.5 text-sm">
        {(Object.keys(VIEW_LABELS) as PayableView[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded px-3 py-1 ${view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => {
              setView(key);
              // Em "Pagas" o natural é procurar pela data em que foi pago; conta em aberto
              // ainda não tem data de pagamento, então volta para o vencimento.
              if (key === "paid") setDateField("paidAt");
              if (key === "open") setDateField("dueDate");
            }}
          >
            {VIEW_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Período por</Label>
            <Select value={dateField} onValueChange={(v) => setDateField(v as "dueDate" | "paidAt")}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dueDate">Data de vencimento</SelectItem>
                <SelectItem value="paidAt">Data de pagamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label htmlFor="p-filter-from" className="text-xs text-muted-foreground">De</Label>
            <Input id="p-filter-from" type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="p-filter-to" className="text-xs text-muted-foreground">Até</Label>
            <Input id="p-filter-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => { setFrom(""); setTo(""); }}>
              Limpar período
            </Button>
          )}
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
            subtitle={
              [
                `${VIEW_LABELS[view]}.`,
                (from || to) &&
                  `${dateField === "paidAt" ? "Pagamento" : "Vencimento"}${from ? ` de ${dateLabel(`${from}T12:00:00`)}` : ""}${to ? ` até ${dateLabel(`${to}T12:00:00`)}` : ""}.`,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
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
              { header: "Pago em", value: (p) => p.paidAt, type: "date" },
              { header: "Valor pago", value: (p) => p.paidAmount, type: "money" },
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
              <TableHead>Pago em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  {view === "open" ? "Nenhuma conta a pagar em aberto." : view === "paid" ? "Nenhuma conta paga." : "Nenhuma conta encontrada."}
                </TableCell>
              </TableRow>
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
                <TableCell className="text-muted-foreground">{dateLabel(payable.dueDate)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {payable.paidAt ? (
                    <>
                      {dateLabel(payable.paidAt)}
                      {payable.paidAmount != null && payable.paidAmount !== payable.amount && (
                        <span className="block text-xs">R$ {payable.paidAmount.toFixed(2)}</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
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
  const [bankAccountId, setBankAccountId] = useState(payable.bankAccountId ?? "");
  const [paymentMethod, setPaymentMethod] = useState(payable.paymentMethod ?? "");
  // Data em que foi pago — começa em hoje, dá pra mudar (ex.: pagamento feito ontem).
  const [paidAt, setPaidAt] = useState(todayInputValue);

  function handleOpenChange(next: boolean) {
    if (next) setPaidAt(todayInputValue());
    setOpen(next);
  }

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
      await api.payPayable(
        payable.id,
        {
          paidAmount: Number(paidAmount),
          paidAt: settlementDateParam(paidAt),
          bankAccountId: bankAccountId || undefined,
          paymentMethod: paymentMethod || undefined,
        },
        token
      );
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Pagar</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pagar &ldquo;{payable.description}&rdquo;</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor={`paid-at-${payable.id}`}>Data do pagamento</Label>
            <Input id={`paid-at-${payable.id}`} type="date" required max={todayInputValue()} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>
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
