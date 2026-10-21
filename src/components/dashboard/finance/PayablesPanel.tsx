"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButtons } from "@/components/ui/export-buttons";
import { PayableFormDialog } from "@/components/dashboard/finance/PayableFormDialog";
import { PayManyDialog } from "@/components/dashboard/finance/PayManyDialog";
import { SettlementSummaryCards } from "@/components/dashboard/finance/SettlementSummaryCards";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { settlementDateParam, todayInputValue, toLocalDateInput } from "@/lib/dates";
import type { AccountPayable, BankAccount, PayableStatus } from "@/lib/types";

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

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateLabel = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
// Data de emissão é gravada só como data (meia-noite UTC) — mostrar em UTC evita "um dia antes".
const issueDateLabel = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
const isOpen = (p: AccountPayable) => p.status === "PENDING" || p.status === "OVERDUE";

const EMPTY_FILTERS = { issueDate: "", invoiceNumber: "", payeeName: "", documentNumber: "", amount: "", paidDate: "", notes: "" };
type Filters = typeof EMPTY_FILTERS;

export default function PayablesPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("finance", "manage");
  // Separação principal: todas (padrão), a pagar (pendentes/vencidas), pagas ou canceladas.
  const [view, setView] = useState<PayableView>("all");
  // Filtros: emissão da nota, nº da nota, fornecedor, duplicata, valor, data de pagamento e observação.
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  // Contas selecionadas para "Marcar como pagas" (só contas em aberto).
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function setFilter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  // Filtros comuns à lista e aos totais do topo (os totais ignoram só a aba de situação).
  const filterParams = Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, value.trim() || undefined])
  ) as Record<keyof Filters, string | undefined>;
  const hasFilters = Object.values(filterParams).some(Boolean);
  const filterKey = JSON.stringify(filterParams);

  const { data: summary } = useQuery({
    queryKey: ["payables", "summary", filterParams],
    queryFn: async () => (await api.payablesSummary(token!, filterParams)).summary,
    enabled: !!token,
  });

  const { data: page, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["payables", view, filterKey],
    queryFn: async () =>
      api.payables(token!, {
        ...(view === "open" ? { situation: "open" as const } : view === "paid" ? { situation: "paid" as const } : view === "cancelled" ? { status: "CANCELLED" } : {}),
        ...filterParams,
        pageSize: 100,
      }),
    enabled: !!token,
  });
  const data = page?.items as AccountPayable[] | undefined;
  const total = page?.pagination.total ?? 0;

  // Trocou de aba ou de filtro: a seleção antiga não vale mais.
  useEffect(() => {
    setSelected(new Set());
  }, [view, filterKey]);

  // Vencidas e que vencem em breve, sem filtros — mesmo dado do indicador da aba.
  const { data: dueWarnings } = useQuery({
    queryKey: ["payables", "due-warnings"],
    queryFn: async () => (await api.payableDueWarnings(token!)).warnings,
    enabled: !!token,
    refetchInterval: 5 * 60 * 1000,
  });
  const dueSoonDays = dueWarnings?.dueSoonDays ?? 3;
  const isDueSoon = (p: AccountPayable) =>
    p.status === "PENDING" && new Date(p.dueDate).getTime() - dataUpdatedAt <= dueSoonDays * 24 * 60 * 60 * 1000;

  const openRows = (data ?? []).filter(isOpen);
  const allSelected = openRows.length > 0 && openRows.every((p) => selected.has(p.id));

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(openRows.map((p) => p.id)) : new Set());
  }

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["payables"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
  }

  // Data de pagamento de uma conta já paga — corrigível direto na coluna "Pago em".
  async function changePaidAt(payable: AccountPayable, value: string) {
    if (!token) return;
    try {
      await api.updatePayable(payable.id, { paidAt: value }, token);
      toast.success("Data de pagamento alterada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível alterar a data de pagamento.");
    }
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

  const filterFields: { key: keyof Filters; label: string; type?: string; placeholder?: string; className: string; inputMode?: "decimal" }[] = [
    { key: "issueDate", label: "Emissão da nota", type: "date", className: "w-40" },
    { key: "invoiceNumber", label: "Nº da nota", placeholder: "Número", className: "w-32" },
    { key: "payeeName", label: "Fornecedor", placeholder: "Nome", className: "w-48" },
    { key: "documentNumber", label: "Duplicata", placeholder: "Nº da duplicata", className: "w-36" },
    { key: "amount", label: "Valor", placeholder: "0,00", className: "w-28", inputMode: "decimal" },
    { key: "paidDate", label: "Data de pagamento", type: "date", className: "w-40" },
    { key: "notes", label: "Observação", placeholder: "Contém...", className: "w-56" },
  ];

  return (
    <div className="grid gap-4">
      {!!dueWarnings?.overdue.count && (
        <button
          type="button"
          onClick={() => setView("open")}
          className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-left text-sm font-medium text-red-700"
        >
          <AlertTriangle className="size-5 shrink-0 animate-alert-blink text-red-600" />
          <span className="animate-alert-blink">
            {dueWarnings.overdue.count} conta{dueWarnings.overdue.count === 1 ? "" : "s"} vencida{dueWarnings.overdue.count === 1 ? "" : "s"} —{" "}
            {brl(dueWarnings.overdue.total)}
          </span>
          <span className="ml-auto text-xs font-normal underline">Ver a pagar</span>
        </button>
      )}
      {!!dueWarnings?.dueSoon.count && (
        <button
          type="button"
          onClick={() => setView("open")}
          className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm font-medium text-amber-800"
        >
          <Clock className="size-5 shrink-0 animate-alert-blink text-amber-500" />
          <span className="animate-alert-blink">
            {dueWarnings.dueSoon.count} conta{dueWarnings.dueSoon.count === 1 ? "" : "s"} vence{dueWarnings.dueSoon.count === 1 ? "" : "m"} nos
            próximos {dueWarnings.dueSoonDays} dias — {brl(dueWarnings.dueSoon.total)}
          </span>
          <span className="ml-auto text-xs font-normal underline">Ver a pagar</span>
        </button>
      )}
      <SettlementSummaryCards summary={summary} kind="payable" filtered={hasFilters} />
      <div className="inline-flex w-fit flex-wrap rounded-md border p-0.5 text-sm">
        {(Object.keys(VIEW_LABELS) as PayableView[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`rounded px-3 py-1 ${view === key ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => setView(key)}
          >
            {VIEW_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-2">
          {filterFields.map((field) => (
            <div key={field.key} className="grid gap-1">
              <Label htmlFor={`p-filter-${field.key}`} className="text-xs text-muted-foreground">
                {field.label}
              </Label>
              <Input
                id={`p-filter-${field.key}`}
                type={field.type ?? "text"}
                inputMode={field.inputMode}
                placeholder={field.placeholder}
                className={field.className}
                value={filters[field.key]}
                onChange={(e) => setFilter(field.key, e.target.value)}
              />
            </div>
          ))}
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            title="Contas a pagar"
            filename="contas-a-pagar"
            subtitle={`${VIEW_LABELS[view]}.${hasFilters ? " Com filtros." : ""}`}
            rows={data ?? []}
            columns={[
              { header: "Descrição", value: (p) => (p.installmentTotal && p.installmentTotal > 1 ? `${p.description} (${p.installmentNumber}/${p.installmentTotal})` : p.description) },
              { header: "Fornecedor/Beneficiário", value: (p) => p.payeeName },
              { header: "Categoria", value: (p) => p.category },
              { header: "Grupo", value: (p) => p.expenseGroup },
              { header: "Descr. despesa", value: (p) => p.expenseDescription },
              { header: "Setor", value: (p) => p.expenseSector },
              { header: "Nota fiscal", value: (p) => p.invoiceNumber ?? p.invoice?.number },
              { header: "Duplicata", value: (p) => p.documentNumber },
              { header: "Emissão", value: (p) => p.issueDate, type: "date" },
              { header: "Vencimento", value: (p) => p.dueDate, type: "date" },
              { header: "Status", value: (p) => STATUS_LABELS[p.status as PayableStatus] ?? p.status },
              { header: "Forma", value: (p) => p.paymentMethod },
              { header: "Valor", value: (p) => p.amount, type: "money" },
              { header: "Pago em", value: (p) => p.paidAt, type: "date" },
              { header: "Valor pago", value: (p) => p.paidAmount, type: "money" },
              { header: "Observação", value: (p) => p.notes },
            ]}
          />
          {canManage && <PayableFormDialog onSaved={refetch} trigger={<Button size="sm"><Plus className="size-4" />Nova conta a pagar</Button>} />}
        </div>
      </div>

      {/* Seleção em lote: "Selecionar tudo" pega todas as contas em aberto da lista filtrada. */}
      {canManage && openRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(v === true)} aria-label="Selecionar todas as contas em aberto" />
            Selecionar tudo ({openRows.length} em aberto{hasFilters ? " no filtro" : ""})
          </label>
          {/* Pergunta se mantém a data de hoje; se não, uma data por conta. */}
          <PayManyDialog
            payables={openRows.filter((p) => selected.has(p.id))}
            onDone={() => {
              setSelected(new Set());
              refetch();
            }}
          />
          {total > (data?.length ?? 0) && (
            <span className="text-xs text-muted-foreground">
              Mostrando {data?.length ?? 0} de {total} contas — refine o filtro para alcançar as demais.
            </span>
          )}
        </div>
      )}

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && <TableHead className="w-8" />}
              <TableHead>Descrição</TableHead>
              <TableHead>Fornecedor/Beneficiário</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Pago em</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {view === "open" ? "Nenhuma conta a pagar em aberto." : view === "paid" ? "Nenhuma conta paga." : "Nenhuma conta encontrada."}
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((payable) => (
              <TableRow key={payable.id} data-state={selected.has(payable.id) ? "selected" : undefined}>
                {canManage && (
                  <TableCell>
                    {isOpen(payable) && (
                      <Checkbox
                        checked={selected.has(payable.id)}
                        onCheckedChange={(v) => toggleOne(payable.id, v === true)}
                        aria-label={`Selecionar ${payable.description}`}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell className="font-medium">
                  {/* Clique no nome: detalhes completos (categoria, grupo, setor, nota, duplicata...). */}
                  <PayableDetailsDialog payable={payable} />
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
                </TableCell>
                <TableCell className="text-muted-foreground">{payable.payeeName}</TableCell>
                <TableCell>R$ {payable.amount.toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground">{dateLabel(payable.dueDate)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {payable.paidAt ? (
                    <>
                      {canManage && payable.status === "PAID" ? (
                        <SettledDateInput label="Data de pagamento" value={payable.paidAt} onSave={(value) => changePaidAt(payable, value)} />
                      ) : (
                        dateLabel(payable.paidAt)
                      )}
                      {payable.paidAmount != null && payable.paidAmount !== payable.amount && (
                        <span className="block text-xs">R$ {payable.paidAmount.toFixed(2)}</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[payable.status]} className={payable.status === "OVERDUE" ? "animate-alert-blink" : undefined}>
                    {STATUS_LABELS[payable.status]}
                  </Badge>
                  {isDueSoon(payable) && (
                    <Badge variant="outline" className="mt-1 flex w-fit animate-alert-blink border-amber-400 text-amber-700">
                      Vence em breve
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {canManage && isOpen(payable) && (
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

/**
 * Data de pagamento/recebimento editável numa conta já baixada. Salva ao escolher a data
 * (ano completo, para não gravar "0202" enquanto digita o ano); não aceita data futura.
 */
export function SettledDateInput({ label, value, onSave }: { label: string; value: string; onSave: (value: string) => void }) {
  const current = toLocalDateInput(value);
  return (
    <Input
      type="date"
      className="h-8 w-36"
      aria-label={label}
      title={`${label} — clique para corrigir`}
      max={todayInputValue()}
      defaultValue={current}
      key={value}
      onChange={(e) => {
        const next = e.target.value;
        if (/^20\d{2}-\d{2}-\d{2}$/.test(next) && next !== current && next <= todayInputValue()) onSave(next);
      }}
    />
  );
}

/** Detalhes completos da conta (o que saiu da tabela: categoria, grupo, setor...). */
function PayableDetailsDialog({ payable }: { payable: AccountPayable }) {
  const rows: [string, string | null | undefined][] = [
    ["Fornecedor/beneficiário", payable.payeeName],
    ["Status", STATUS_LABELS[payable.status]],
    ["Valor", brl(payable.amount)],
    ["Vencimento", dateLabel(payable.dueDate)],
    ["Pago em", payable.paidAt ? dateLabel(payable.paidAt) : null],
    ["Valor pago", payable.paidAmount != null ? brl(payable.paidAmount) : null],
    ["Forma de pagamento", payable.paymentMethod],
    ["Conta bancária", payable.bankAccount?.name],
    ["Categoria", payable.category],
    ["Grupo", payable.expenseGroup],
    ["Descrição da despesa", payable.expenseDescription],
    ["Setor", payable.expenseSector],
    ["Nº da nota", payable.invoiceNumber || payable.invoice?.number],
    ["Emissão da nota", payable.issueDate ? issueDateLabel(payable.issueDate) : null],
    ["Duplicata", payable.documentNumber],
    ["Parcela", payable.installmentTotal && payable.installmentTotal > 1 ? `${payable.installmentNumber}/${payable.installmentTotal}` : null],
    ["Loja", payable.store?.name],
    ["Lançado por", payable.createdBy?.name],
    ["Observação", payable.notes],
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="text-left underline-offset-2 hover:underline" title="Ver detalhes da conta">
          {payable.description}
        </button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{payable.description}</DialogTitle>
        </DialogHeader>
        <dl className="grid min-h-0 grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 overflow-y-auto text-sm">
          {rows
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="whitespace-pre-wrap break-words">{value}</dd>
              </div>
            ))}
        </dl>
      </DialogContent>
    </Dialog>
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
