"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButtons } from "@/components/ui/export-buttons";
import { SuggestInput } from "@/components/ui/suggest-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import type { BankAccount, Client, ExpenseClassifications, Invoice, InvoiceStatus, InvoiceType, ServiceOrder, ServiceOrderStatus } from "@/lib/types";

// "Em andamento" = mesma definição usada em MechanicProjectsPanel — qualquer OS que
// ainda não chegou em FINISHED/READY_FOR_PICKUP.
const DONE_ORDER_STATUSES = new Set<ServiceOrderStatus>(["FINISHED", "READY_FOR_PICKUP"]);

const TYPE_LABELS: Record<InvoiceType, string> = { NFE: "NF-e", NFSE: "NFS-e", NFCE: "NFC-e" };
const STATUS_LABELS: Record<InvoiceStatus, string> = { DRAFT: "Rascunho", PENDING: "Pendente", ISSUED: "Emitida", CANCELLED: "Cancelada", ERROR: "Erro" };
const STATUS_VARIANTS: Record<InvoiceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary",
  PENDING: "outline",
  ISSUED: "default",
  CANCELLED: "secondary",
  ERROR: "destructive",
};

const EMPTY_SEARCH = { clientName: "", number: "", orderCode: "", date: "" };

export default function InvoicesPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("invoices", "manage");
  const [search, setSearch] = useState(EMPTY_SEARCH);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", search],
    queryFn: async () => (await api.invoices(token!, { pageSize: 50, ...search })).items as Invoice[],
    enabled: !!token,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

  function setSearchField<K extends keyof typeof search>(key: K, value: string) {
    setSearch((s) => ({ ...s, [key]: value }));
  }

  const hasActiveSearch = Object.values(search).some((v) => v !== "");

  async function handleIssue(invoice: Invoice) {
    if (!token) return;
    try {
      await api.issueInvoice(invoice.id, token);
      toast.success("Nota fiscal emitida.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível emitir a nota.");
    }
  }

  async function handleCancel(invoice: Invoice) {
    if (!token || !confirm(`Cancelar a nota ${invoice.number ?? invoice.id}?`)) return;
    try {
      await api.cancelInvoice(invoice.id, token);
      toast.success("Nota fiscal cancelada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível cancelar a nota.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <ExportButtons
          title="Notas fiscais"
          filename="notas-fiscais"
          rows={data ?? []}
          columns={[
            { header: "Tipo", value: (i) => TYPE_LABELS[i.type] },
            { header: "Número", value: (i) => i.number },
            { header: "Série", value: (i) => i.series },
            { header: "Emissão", value: (i) => i.issueDate, type: "date" },
            { header: "Emitente", value: (i) => i.issuerName },
            { header: "Destinatário", value: (i) => i.recipientName ?? i.client?.name },
            { header: "Status", value: (i) => STATUS_LABELS[i.status] },
            { header: "Pagamento", value: (i) => i.paymentMethod },
            { header: "Valor", value: (i) => i.totalAmount, type: "money" },
          ]}
        />
        {canManage && <InvoiceFormDialog onSaved={refetch} trigger={<Button size="sm"><Plus className="size-4" />Nova nota fiscal</Button>} />}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="grid gap-1.5">
          <Label htmlFor="search-client">Cliente</Label>
          <Input
            id="search-client"
            placeholder="Cliente ou fornecedor"
            value={search.clientName}
            onChange={(e) => setSearchField("clientName", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="search-number">Número da nota</Label>
          <Input id="search-number" placeholder="Número" value={search.number} onChange={(e) => setSearchField("number", e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="search-order">Projeto</Label>
          <Input
            id="search-order"
            placeholder="Código da OS"
            value={search.orderCode}
            onChange={(e) => setSearchField("orderCode", e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="search-date">Data</Label>
          <div className="flex gap-2">
            <Input id="search-date" type="date" value={search.date} onChange={(e) => setSearchField("date", e.target.value)} />
            {hasActiveSearch && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSearch(EMPTY_SEARCH)}>
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Cliente/Destinatário</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {hasActiveSearch ? "Nenhuma nota encontrada com esse filtro." : "Nenhuma nota fiscal."}
                </TableCell>
              </TableRow>
            )}
            {(data ?? []).map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{TYPE_LABELS[invoice.type]}</TableCell>
                <TableCell className="text-muted-foreground">{invoice.number ? `${invoice.number}${invoice.series ? `/${invoice.series}` : ""}` : "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {invoice.client?.name || invoice.recipientName || (invoice.issuerName ? `Fornecedor: ${invoice.issuerName}` : "—")}
                  {invoice.serviceOrder && <p className="text-xs">Projeto: {invoice.serviceOrder.code}</p>}
                  {(invoice.expenseSector || invoice.expenseGroup) && (
                    <p className="text-xs">{[invoice.expenseGroup, invoice.expenseSector].filter(Boolean).join(" · ")}</p>
                  )}
                </TableCell>
                <TableCell>R$ {invoice.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[invoice.status]}>{STATUS_LABELS[invoice.status]}</Badge>
                  {invoice.status === "ERROR" && invoice.errorMessage && (
                    <p className="mt-1 text-xs text-destructive">{invoice.errorMessage}</p>
                  )}
                  {invoice.payables && invoice.payables.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {invoice.payables.length} parcela{invoice.payables.length > 1 ? "s" : ""} em contas a pagar
                      {(() => {
                        const paid = invoice.payables.filter((p) => p.status === "PAID").length;
                        return paid > 0 ? ` · ${paid} paga${paid > 1 ? "s" : ""}` : "";
                      })()}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      {(invoice.status === "DRAFT" || invoice.status === "ERROR") && (
                        <Button size="sm" variant="outline" onClick={() => handleIssue(invoice)}>Emitir</Button>
                      )}
                      {invoice.status === "ISSUED" && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(invoice)}>Cancelar</Button>
                      )}
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

// Tipo, chave de acesso, destinatário e CNPJs saíram do formulário a pedido da oficina — o
// tipo ainda é guardado internamente quando a leitura por IA o identifica (padrão NF-e).
const EMPTY_FORM = {
  type: "NFE" as InvoiceType,
  clientId: "",
  serviceOrderId: "",
  number: "",
  series: "",
  operationNature: "",
  issuerName: "",
  paymentMethod: "",
  description: "",
  totalAmount: "",
  discountAmount: "",
  taxAmount: "",
  issueDate: "",
  // Nota de despesa (conta a pagar): classificação, banco e parcelas.
  isExpense: false,
  expenseSector: "",
  expenseGroup: "",
  expenseDescription: "",
  bankAccountId: "",
  dueDate: "",
  installments: "1",
};

function isBoleto(paymentMethod: string) {
  return paymentMethod.trim().toLowerCase().includes("boleto");
}

function InvoiceFormDialog({ trigger, onSaved }: { trigger: React.ReactNode; onSaved: () => void }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [autoClientMessage, setAutoClientMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => (await api.clients(token!, { pageSize: 100 })).items as Client[],
    enabled: !!token && open,
  });

  const { data: classifications } = useQuery({
    queryKey: ["expense-classifications"],
    queryFn: async () => (await api.expenseClassifications(token!)) as ExpenseClassifications,
    enabled: !!token && open,
  });

  const { data: bankAccounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await api.bankAccounts(token!)).accounts as BankAccount[],
    enabled: !!token && open,
  });

  const { data: openOrders } = useQuery({
    queryKey: ["service-orders-open-for-invoice"],
    queryFn: async () => {
      const { orders } = await api.serviceOrders(token!);
      return (orders as ServiceOrder[]).filter((o) => !DONE_ORDER_STATUSES.has(o.status));
    },
    enabled: !!token && open,
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setForm(EMPTY_FORM);
      setAutoClientMessage(null);
    }
    setOpen(next);
  }

  async function handleExtract(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setExtracting(true);
    setAutoClientMessage(null);
    try {
      const { extracted, clientId, clientName, clientCreated } = await api.extractInvoice(file, token);
      setForm((f) => ({
        ...f,
        type: extracted.type,
        number: extracted.number ?? f.number,
        series: extracted.series ?? f.series,
        operationNature: extracted.operationNature ?? f.operationNature,
        issuerName: extracted.issuerName ?? f.issuerName,
        paymentMethod: extracted.paymentMethod ?? f.paymentMethod,
        description: extracted.description ?? f.description,
        totalAmount: extracted.totalAmount ? String(extracted.totalAmount) : f.totalAmount,
        discountAmount: extracted.discountAmount ? String(extracted.discountAmount) : f.discountAmount,
        taxAmount: extracted.taxAmount ? String(extracted.taxAmount) : f.taxAmount,
        issueDate: extracted.issueDate ?? f.issueDate,
        clientId: clientId ?? f.clientId,
      }));
      if (clientCreated) {
        setAutoClientMessage(`Cliente novo cadastrado automaticamente: ${clientName}. Confira os dados em Clientes.`);
        queryClient.invalidateQueries({ queryKey: ["clients-all"] });
        queryClient.invalidateQueries({ queryKey: ["clients"] });
      } else if (clientId) {
        setAutoClientMessage(`Cliente identificado: ${clientName}.`);
      }
      toast.success("Dados extraídos — confira antes de salvar.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível ler a imagem.");
    } finally {
      setExtracting(false);
    }
  }

  // Gera contas a pagar quando é nota de despesa ou quando é paga por boleto.
  const generatesPayables = form.isExpense || isBoleto(form.paymentMethod);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (generatesPayables && !form.dueDate) {
      toast.error("Informe o vencimento da primeira parcela.");
      return;
    }
    if (form.isExpense && !form.issuerName.trim()) {
      toast.error("Informe o emitente/fornecedor da nota de despesa.");
      return;
    }
    setSaving(true);
    try {
      const { invoice } = await api.createInvoice(
        {
          type: form.type,
          clientId: form.clientId || undefined,
          serviceOrderId: form.serviceOrderId || undefined,
          totalAmount: Number(form.totalAmount),
          description: form.description.trim() || undefined,
          number: form.number || undefined,
          series: form.series || undefined,
          operationNature: form.operationNature || undefined,
          issuerName: form.issuerName || undefined,
          paymentMethod: form.paymentMethod || undefined,
          discountAmount: form.discountAmount ? Number(form.discountAmount) : undefined,
          taxAmount: form.taxAmount ? Number(form.taxAmount) : undefined,
          issueDate: form.issueDate || undefined,
          isExpense: form.isExpense || undefined,
          expenseSector: form.isExpense ? form.expenseSector || undefined : undefined,
          expenseGroup: form.isExpense ? form.expenseGroup || undefined : undefined,
          expenseDescription: form.isExpense ? form.expenseDescription || undefined : undefined,
          bankAccountId: form.bankAccountId || undefined,
          dueDate: generatesPayables ? form.dueDate : undefined,
          installments: generatesPayables ? Number(form.installments) || 1 : undefined,
        },
        token
      );
      queryClient.invalidateQueries({ queryKey: ["expense-classifications"] });
      queryClient.invalidateQueries({ queryKey: ["payables"] });
      const payablesCount = (invoice as Invoice).payables?.length ?? 0;
      toast.success(payablesCount > 0 ? `Nota fiscal salva — ${payablesCount} parcela(s) lançada(s) em contas a pagar.` : "Nota fiscal salva.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a nota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova nota fiscal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Só esta área rola (no celular a rolagem fica no formulário, não na página). */}
          <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain pr-1">
            <div className="grid gap-1.5">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleExtract} />
              <Button type="button" variant="outline" size="sm" className="w-fit" disabled={extracting} onClick={() => fileInputRef.current?.click()}>
                <Sparkles className="size-4" />
                {extracting ? "Lendo nota fiscal..." : "Ler nota fiscal por foto (IA)"}
              </Button>
              {autoClientMessage && <p className="text-xs text-muted-foreground">{autoClientMessage}</p>}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="inv-number">Número da nota fiscal</Label>
                <Input id="inv-number" value={form.number} onChange={(e) => set("number", e.target.value)} placeholder="Automático se vazio" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inv-series">Série</Label>
                <Input id="inv-series" value={form.series} onChange={(e) => set("series", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="inv-issuer-name">Emitente / fornecedor{form.isExpense ? " *" : ""}</Label>
              <Input id="inv-issuer-name" value={form.issuerName} onChange={(e) => set("issuerName", e.target.value)} />
            </div>

            {/* Nota de despesa — vira conta a pagar, classificada por setor/categoria/grupo/descrição. */}
            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
              <Checkbox checked={form.isExpense} onCheckedChange={(v) => set("isExpense", v === true)} />
              <span>
                <strong>Nota de despesa</strong> — lançar em contas a pagar
              </span>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Cliente cadastrado</Label>
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
              <div className="grid gap-1.5">
                <Label>Projeto em andamento (opcional)</Label>
                <Select value={form.serviceOrderId || "NONE"} onValueChange={(v) => set("serviceOrderId", v === "NONE" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    {(openOrders ?? []).map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.code} — {o.vehicle.brand} {o.vehicle.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="inv-operation">Categoria (natureza da operação)</Label>
                <SuggestInput
                  id="inv-operation"
                  options={classifications?.categories ?? []}
                  value={form.operationNature}
                  onChange={(e) => set("operationNature", e.target.value)}
                  placeholder="Ex.: Compra de peças"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inv-payment">Forma de pagamento</Label>
                <SuggestInput
                  id="inv-payment"
                  options={[...PAYMENT_METHODS]}
                  value={form.paymentMethod}
                  onChange={(e) => set("paymentMethod", e.target.value)}
                  placeholder="PIX, Boleto, Dinheiro..."
                />
              </div>
            </div>

            {form.isExpense && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="inv-sector">Setor</Label>
                  <SuggestInput id="inv-sector" options={classifications?.sectors ?? []} value={form.expenseSector} onChange={(e) => set("expenseSector", e.target.value)} placeholder="Ex.: Oficina" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="inv-group">Grupo de despesa</Label>
                  <SuggestInput id="inv-group" options={classifications?.groups ?? []} value={form.expenseGroup} onChange={(e) => set("expenseGroup", e.target.value)} placeholder="Ex.: PEÇAS" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="inv-exp-desc">Descrição da despesa</Label>
                  <SuggestInput
                    id="inv-exp-desc"
                    options={[...new Set((classifications?.descriptions ?? []).filter((d) => !form.expenseGroup || d.group.toLowerCase() === form.expenseGroup.trim().toLowerCase()).map((d) => d.name))]}
                    value={form.expenseDescription}
                    onChange={(e) => set("expenseDescription", e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label>Banco associado (opcional)</Label>
              <Select value={form.bankAccountId || "NONE"} onValueChange={(v) => set("bankAccountId", v === "NONE" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">—</SelectItem>
                  {(bankAccounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}{a.bank ? ` — ${a.bank}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {generatesPayables && (
              <div className="grid grid-cols-1 gap-3 rounded-md border border-dashed p-3 sm:grid-cols-2">
                <div className="col-span-full text-xs font-medium text-muted-foreground">
                  Gera as parcelas em contas a pagar, vencendo mês a mês{form.bankAccountId ? ", previstas no banco escolhido" : ""}.
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="inv-due-date">Vencimento da 1ª parcela *</Label>
                  <Input id="inv-due-date" type="date" required value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="inv-installments">Quantidade de parcelas *</Label>
                  <Input
                    id="inv-installments"
                    type="number"
                    min="1"
                    max="60"
                    required
                    value={form.installments}
                    onChange={(e) => set("installments", e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-1.5">
              <Label htmlFor="inv-description">Observação (opcional)</Label>
              <Input id="inv-description" value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="inv-amount">Valor total *</Label>
                <Input id="inv-amount" type="number" min="0" step="0.01" required value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inv-discount">Desconto</Label>
                <Input id="inv-discount" type="number" min="0" step="0.01" value={form.discountAmount} onChange={(e) => set("discountAmount", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inv-tax">Impostos</Label>
                <Input id="inv-tax" type="number" min="0" step="0.01" value={form.taxAmount} onChange={(e) => set("taxAmount", e.target.value)} />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="inv-issue-date">Data de emissão</Label>
              <Input id="inv-issue-date" type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
              <p className="text-xs text-muted-foreground">
                {form.number ? "Com número preenchido, a nota é salva como já emitida." : "Sem número, a nota é salva como rascunho para emitir depois."}
              </p>
            </div>

          </div>
          <DialogFooter className="border-t pt-3">
            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>{saving ? "Salvando..." : "Salvar nota fiscal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
