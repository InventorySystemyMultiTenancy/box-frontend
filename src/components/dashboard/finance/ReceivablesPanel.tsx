"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButtons } from "@/components/ui/export-buttons";
import { SettlementSummaryCards } from "@/components/dashboard/finance/SettlementSummaryCards";
import { SettledDateInput } from "@/components/dashboard/finance/PayablesPanel";
import { SettleManyDialog } from "@/components/dashboard/finance/SettleManyDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { settlementDateParam, todayInputValue, toLocalDateInput } from "@/lib/dates";
import { RECEIVABLE_PAYER_LABELS, type AccountReceivable, type BankAccount, type Client, type ReceivableStatus } from "@/lib/types";

const STATUS_LABELS: Record<ReceivableStatus, string> = { PENDING: "Pendente", RECEIVED: "Recebido", OVERDUE: "Vencido", CANCELLED: "Cancelado" };
// Coluna "Data": quando a OS foi finalizada e a conta entrou em Contas a receber.
function finishedAt(r: AccountReceivable) {
  return r.serviceOrder?.completedAt ?? r.createdAt ?? null;
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

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
  // Busca por placa (descrição das contas de projeto), código/SS da OS, cliente ou descrição.
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Totais do topo (em aberto / vencido / já recebido) — não dependem do filtro de status.
  const { data: summary } = useQuery({
    queryKey: ["receivables", "summary"],
    queryFn: async () => (await api.receivablesSummary(token!)).summary,
    enabled: !!token,
  });

  const { data: page, isLoading } = useQuery({
    queryKey: ["receivables", status, q],
    queryFn: async () => api.receivables(token!, { status: status || undefined, q: q || undefined, pageSize: 100 }),
    enabled: !!token,
  });
  const data = page?.items as AccountReceivable[] | undefined;
  const total = page?.pagination.total ?? 0;

  // Seleção para "Marcar como recebidas" (só contas em aberto) — some ao trocar filtro/busca.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelected(new Set());
  }, [status, q]);
  const isOpen = (r: AccountReceivable) => r.status === "PENDING" || r.status === "OVERDUE";
  const openRows = (data ?? []).filter(isOpen);
  const allSelected = openRows.length > 0 && openRows.every((r) => selected.has(r.id));
  // Conta aberta no detalhe (clique no nome) — lida da lista para refletir o refetch.
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = (data ?? []).find((r) => r.id === detailId) ?? null;

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["receivables"] });
    queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    // Nota criada/associada no "Receber" aparece em Notas fiscais.
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

  // Prazo (no detalhe da conta): salva ao escolher a data; vazio tira o prazo (a conta fica vencida).
  async function handleDueDate(receivable: AccountReceivable, value: string) {
    if (!token) return;
    try {
      await api.setReceivableDueDate(receivable.id, value || null, token);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar o prazo.");
    }
  }

  // Data de recebimento (Faturado) de uma conta já recebida — corrigível direto na coluna.
  async function changeReceivedAt(receivable: AccountReceivable, value: string) {
    if (!token) return;
    try {
      await api.updateReceivable(receivable.id, { receivedAt: value }, token);
      toast.success("Data de recebimento alterada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível alterar a data de recebimento.");
    }
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
      <SettlementSummaryCards summary={summary} kind="receivable" filtered={false} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-64 max-w-full">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar placa, OS, SS ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons
            title="Contas a receber"
            filename="contas-a-receber"
            subtitle={status ? `Status: ${STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}.` : undefined}
            rows={data ?? []}
            columns={[
              { header: "Data", value: (r) => finishedAt(r), type: "date" },
              { header: "SS", value: (r) => r.serviceOrder?.ssNumber },
              { header: "Descrição", value: (r) => (r.installmentTotal && r.installmentTotal > 1 ? `${r.description} (${r.installmentNumber}/${r.installmentTotal})` : r.description) },
              { header: "Cliente", value: (r) => r.client?.name },
              { header: "OS", value: (r) => r.serviceOrder?.code },
              { header: "Nota fiscal", value: (r) => (r.invoices ?? []).map((i) => i.number).filter(Boolean).join(", ") },
              { header: "Categoria", value: (r) => r.category },
              { header: "Valor", value: (r) => r.amount, type: "money" },
              { header: "Prazo", value: (r) => r.dueDate, type: "date" },
              { header: "Faturado", value: (r) => r.receivedAt, type: "date" },
              { header: "Valor recebido", value: (r) => r.receivedAmount, type: "money" },
              { header: "Status", value: (r) => STATUS_LABELS[r.status as keyof typeof STATUS_LABELS] ?? r.status },
              { header: "Forma", value: (r) => r.paymentMethod },
              { header: "Pagador", value: (r) => (r.payer ? RECEIVABLE_PAYER_LABELS[r.payer] ?? r.payer : "") },
            ]}
          />
          {canManage && <ReceivableFormDialog onSaved={refetch} trigger={<Button size="sm"><Plus className="size-4" />Nova conta a receber</Button>} />}
        </div>
      </div>

      {/* Seleção em lote: "Selecionar tudo" pega todas as contas em aberto da lista filtrada. */}
      {canManage && openRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(v) => setSelected(v === true ? new Set(openRows.map((r) => r.id)) : new Set())}
              aria-label="Selecionar todas as contas em aberto"
            />
            Selecionar tudo ({openRows.length} em aberto{status || q ? " no filtro" : ""})
          </label>
          {/* Pergunta se mantém a data de hoje; se não, uma data por conta. */}
          <SettleManyDialog
            kind="receivable"
            rows={openRows.filter((r) => selected.has(r.id)).map((r) => ({ id: r.id, description: r.description, party: r.client?.name, amount: r.amount }))}
            onDone={() => {
              setSelected(new Set());
              refetch();
            }}
          />
          {total > (data?.length ?? 0) && (
            <span className="text-xs text-muted-foreground">
              Mostrando {data?.length ?? 0} de {total} contas — refine a busca para alcançar as demais.
            </span>
          )}
        </div>
      )}

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {canManage && <TableHead className="w-8" />}
              <TableHead>Data</TableHead>
              <TableHead>SS</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Faturado</TableHead>
              <TableHead>Valor recebido</TableHead>
              <TableHead>Nota</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">Nenhuma conta a receber.</TableCell></TableRow>
            )}
            {(data ?? []).map((receivable) => (
              <TableRow key={receivable.id} data-state={selected.has(receivable.id) ? "selected" : undefined}>
                {canManage && (
                  <TableCell>
                    {isOpen(receivable) && (
                      <Checkbox
                        checked={selected.has(receivable.id)}
                        onCheckedChange={(v) => toggleOne(receivable.id, v === true)}
                        aria-label={`Selecionar ${receivable.description}`}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(finishedAt(receivable))}</TableCell>
                <TableCell className="whitespace-nowrap font-mono text-xs">{receivable.serviceOrder?.ssNumber || "—"}</TableCell>
                {/* Clique no nome abre o detalhe (categoria, prazo e demais informações). */}
                <TableCell className="font-medium">
                  <button type="button" className="text-left hover:underline" onClick={() => setDetailId(receivable.id)}>
                    {receivable.description}
                  </button>
                  {receivable.installmentTotal && receivable.installmentTotal > 1 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({receivable.installmentNumber}/{receivable.installmentTotal})
                    </span>
                  )}
                </TableCell>
                {/* OS do projeto que gerou a cobrança (contas de Serviços). */}
                <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{receivable.serviceOrder?.code ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{receivable.client?.name || "—"}</TableCell>
                <TableCell>R$ {receivable.amount.toFixed(2)}</TableCell>
                {/* Faturado = data em que foi marcada como recebida; vazio enquanto pendente. */}
                <TableCell className="text-muted-foreground">
                  {receivable.receivedAt ? (
                    canManage && receivable.status === "RECEIVED" ? (
                      <SettledDateInput label="Data de recebimento" value={receivable.receivedAt} onSave={(value) => changeReceivedAt(receivable, value)} />
                    ) : (
                      new Date(receivable.receivedAt).toLocaleDateString("pt-BR")
                    )
                  ) : (
                    "—"
                  )}
                </TableCell>
                {/* Valor real recebido (com desconto, se houve) — é o que entra no caixa. */}
                <TableCell>
                  {receivable.status === "RECEIVED" ? (
                    <>
                      R$ {(receivable.receivedAmount ?? receivable.amount).toFixed(2)}
                      {receivable.receivedAmount != null && receivable.receivedAmount < receivable.amount && (
                        <span className="block text-xs text-muted-foreground">
                          desconto R$ {(receivable.amount - receivable.receivedAmount).toFixed(2)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                {/* Nota fiscal ligada ao recebimento. */}
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {(receivable.invoices ?? []).length ? (receivable.invoices ?? []).map((i) => (i.number ? `NF ${i.number}` : "Nota s/ nº")).join(", ") : "—"}
                </TableCell>
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

      <Dialog open={!!detail} onOpenChange={(next) => !next && setDetailId(null)}>
        <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-lg">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.description}</DialogTitle>
              </DialogHeader>
              <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain pr-1 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANTS[detail.status]}>{STATUS_LABELS[detail.status]}</Badge>
                  {detail.installmentTotal && detail.installmentTotal > 1 && (
                    <span className="text-muted-foreground">Parcela {detail.installmentNumber}/{detail.installmentTotal}</span>
                  )}
                </div>
                {/* Prazo: editável enquanto a conta está em aberto. Sem prazo = já vencida. */}
                <div className="grid gap-1.5">
                  <Label htmlFor={`due-${detail.id}`}>Prazo</Label>
                  {canManage && isOpen(detail) ? (
                    <Input
                      id={`due-${detail.id}`}
                      type="date"
                      className="w-44"
                      title="Prazo — depois desta data a conta aparece vencida; sem data, já aparece vencida"
                      defaultValue={toLocalDateInput(detail.dueDate)}
                      key={`${detail.id}-${detail.dueDate ?? ""}`}
                      // Salva ao escolher a data (ano completo, para não gravar "0202" enquanto
                      // digita o ano) ou ao limpar o campo.
                      onChange={(e) => {
                        const value = e.target.value;
                        if ((value === "" || /^20\d{2}-\d{2}-\d{2}$/.test(value)) && value !== toLocalDateInput(detail.dueDate)) {
                          handleDueDate(detail, value);
                        }
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground">{formatDate(detail.dueDate)}</span>
                  )}
                  {canManage && isOpen(detail) && !detail.dueDate && (
                    <span className="text-xs text-muted-foreground">Sem prazo a conta já aparece como vencida.</span>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {(
                    [
                      ["Categoria", detail.category],
                      ["Data", formatDate(finishedAt(detail))],
                      ["SS", detail.serviceOrder?.ssNumber],
                      ["OS", detail.serviceOrder?.code],
                      ["Cliente", detail.client?.name],
                      ["Valor", `R$ ${detail.amount.toFixed(2)}`],
                      ["Faturado", detail.receivedAt ? formatDate(detail.receivedAt) : null],
                      ["Valor recebido", detail.status === "RECEIVED" ? `R$ ${(detail.receivedAmount ?? detail.amount).toFixed(2)}` : null],
                      ["Forma de pagamento", detail.paymentMethod],
                      ["Pagador", detail.payer ? RECEIVABLE_PAYER_LABELS[detail.payer] ?? detail.payer : null],
                      ["Conta bancária", detail.bankAccount?.name],
                      ["Nota fiscal", (detail.invoices ?? []).map((i) => (i.number ? `NF ${i.number}` : "Nota s/ nº")).join(", ")],
                      ["Criada em", detail.createdAt ? formatDate(detail.createdAt) : null],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="grid gap-0.5">
                      <dt className="text-xs text-muted-foreground">{label}</dt>
                      <dd>{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
                {detail.notes && (
                  <div className="grid gap-0.5">
                    <span className="text-xs text-muted-foreground">Observações</span>
                    <p className="whitespace-pre-wrap">{detail.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
  // Desconto (pagamento antecipado, negociação...) — o valor recebido é o original menos ele.
  const [discount, setDiscount] = useState("");

  function changeDiscount(value: string) {
    setDiscount(value);
    const amount = Math.max(0, receivable.amount - (Number(value) || 0));
    setReceivedAmount(amount.toFixed(2));
  }

  function changeReceivedAmount(value: string) {
    setReceivedAmount(value);
    const diff = receivable.amount - (Number(value) || 0);
    setDiscount(diff > 0 ? diff.toFixed(2) : "");
  }
  const [bankAccountId, setBankAccountId] = useState(receivable.bankAccountId ?? "");
  const [paymentMethod, setPaymentMethod] = useState(receivable.paymentMethod ?? "");
  const [payer, setPayer] = useState(receivable.payer ?? "");
  // Data em que foi recebido — começa em hoje, dá pra mudar (ex.: recebido ontem).
  const [receivedAt, setReceivedAt] = useState(todayInputValue);
  // Nota fiscal criada ali mesmo (opcional) — só é criada se o número for preenchido.
  const [newInvoice, setNewInvoice] = useState({ number: "", issueDate: todayInputValue() });

  function handleOpenChange(next: boolean) {
    if (next) {
      setReceivedAt(todayInputValue());
      setReceivedAmount(String(receivable.amount));
      setDiscount("");
      setNewInvoice({ number: "", issueDate: todayInputValue() });
    }
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
    if (!(Number(receivedAmount) > 0)) {
      toast.error("Informe o valor recebido.");
      return;
    }
    const invoiceNumber = newInvoice.number.trim();
    setSaving(true);
    try {
      await api.receiveReceivable(
        receivable.id,
        {
          receivedAmount: Number(receivedAmount),
          receivedAt: settlementDateParam(receivedAt),
          bankAccountId: bankAccountId || undefined,
          paymentMethod: paymentMethod || undefined,
          payer: payer || undefined,
          newInvoice: invoiceNumber ? { number: invoiceNumber, type: "NFSE", issueDate: newInvoice.issueDate || undefined } : undefined,
        },
        token
      );
      toast.success(invoiceNumber ? "Recebimento confirmado e nota fiscal criada." : "Recebimento confirmado.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível confirmar o recebimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Receber</Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Receber &ldquo;{receivable.description}&rdquo;</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain pr-1">
          <div className="grid gap-1.5">
            <Label htmlFor={`received-at-${receivable.id}`}>Data do recebimento</Label>
            <Input
              id={`received-at-${receivable.id}`}
              type="date"
              required
              max={todayInputValue()}
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground">Valor da conta: R$ {receivable.amount.toFixed(2)}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`discount-${receivable.id}`}>Desconto (R$)</Label>
              <Input
                id={`discount-${receivable.id}`}
                type="number"
                min="0"
                step="0.01"
                max={receivable.amount}
                placeholder="0,00"
                value={discount}
                onChange={(e) => changeDiscount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`received-amount-${receivable.id}`}>Valor recebido *</Label>
              <Input
                id={`received-amount-${receivable.id}`}
                type="number"
                min="0.01"
                step="0.01"
                required
                value={receivedAmount}
                onChange={(e) => changeReceivedAmount(e.target.value)}
              />
            </div>
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
          <div className="grid gap-1.5">
            <Label>Pagador</Label>
            <Select value={payer || "NONE"} onValueChange={(v) => setPayer(v === "NONE" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">—</SelectItem>
                {Object.entries(RECEIVABLE_PAYER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Nota fiscal do recebimento — criada aqui mesmo se o número for preenchido. */}
          <div className="grid gap-2 rounded-md border p-3">
            <Label>Nota fiscal (opcional)</Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1">
                <Label htmlFor={`ni-number-${receivable.id}`} className="text-xs">Número da nota</Label>
                <Input id={`ni-number-${receivable.id}`} value={newInvoice.number} onChange={(e) => setNewInvoice((n) => ({ ...n, number: e.target.value }))} />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`ni-date-${receivable.id}`} className="text-xs">Data de emissão</Label>
                <Input id={`ni-date-${receivable.id}`} type="date" value={newInvoice.issueDate} onChange={(e) => setNewInvoice((n) => ({ ...n, issueDate: e.target.value }))} />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                A nota é cadastrada em Notas fiscais com o valor recebido, ligada a esta conta{receivable.serviceOrder?.code ? ` e à ${receivable.serviceOrder.code}` : ""}.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Confirmar recebimento"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
