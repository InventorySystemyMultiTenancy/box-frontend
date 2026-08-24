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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Client, Invoice, InvoiceStatus, InvoiceType } from "@/lib/types";

const TYPE_LABELS: Record<InvoiceType, string> = { NFE: "NF-e", NFSE: "NFS-e", NFCE: "NFC-e" };
const STATUS_LABELS: Record<InvoiceStatus, string> = { DRAFT: "Rascunho", PENDING: "Pendente", ISSUED: "Emitida", CANCELLED: "Cancelada", ERROR: "Erro" };
const STATUS_VARIANTS: Record<InvoiceStatus, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary",
  PENDING: "outline",
  ISSUED: "default",
  CANCELLED: "secondary",
  ERROR: "destructive",
};

export default function InvoicesPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("invoices", "manage");

  const { data, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => (await api.invoices(token!, { pageSize: 50 })).items as Invoice[],
    enabled: !!token,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
  }

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
      <div className="flex justify-end">
        {canManage && <InvoiceFormDialog onSaved={refetch} trigger={<Button size="sm"><Plus className="size-4" />Nova nota fiscal</Button>} />}
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
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma nota fiscal.</TableCell></TableRow>
            )}
            {(data ?? []).map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell>{TYPE_LABELS[invoice.type]}</TableCell>
                <TableCell className="text-muted-foreground">{invoice.number ? `${invoice.number}${invoice.series ? `/${invoice.series}` : ""}` : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{invoice.client?.name || invoice.recipientName || "—"}</TableCell>
                <TableCell>R$ {invoice.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[invoice.status]}>{STATUS_LABELS[invoice.status]}</Badge>
                  {invoice.status === "ERROR" && invoice.errorMessage && (
                    <p className="mt-1 text-xs text-destructive">{invoice.errorMessage}</p>
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

const EMPTY_FORM = {
  type: "NFSE" as InvoiceType,
  clientId: "",
  number: "",
  series: "",
  accessKey: "",
  operationNature: "",
  issuerName: "",
  issuerDocument: "",
  recipientName: "",
  recipientDocument: "",
  paymentMethod: "",
  description: "",
  totalAmount: "",
  discountAmount: "",
  taxAmount: "",
  issueDate: "",
};

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
        accessKey: extracted.accessKey ?? f.accessKey,
        operationNature: extracted.operationNature ?? f.operationNature,
        issuerName: extracted.issuerName ?? f.issuerName,
        issuerDocument: extracted.issuerDocument ?? f.issuerDocument,
        recipientName: extracted.recipientName ?? f.recipientName,
        recipientDocument: extracted.recipientDocument ?? f.recipientDocument,
        paymentMethod: extracted.paymentMethod ?? f.paymentMethod,
        description: extracted.description,
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      await api.createInvoice(
        {
          type: form.type,
          clientId: form.clientId || undefined,
          totalAmount: Number(form.totalAmount),
          description: form.description,
          number: form.number || undefined,
          series: form.series || undefined,
          accessKey: form.accessKey || undefined,
          operationNature: form.operationNature || undefined,
          issuerName: form.issuerName || undefined,
          issuerDocument: form.issuerDocument || undefined,
          recipientName: form.recipientName || undefined,
          recipientDocument: form.recipientDocument || undefined,
          paymentMethod: form.paymentMethod || undefined,
          discountAmount: form.discountAmount ? Number(form.discountAmount) : undefined,
          taxAmount: form.taxAmount ? Number(form.taxAmount) : undefined,
          issueDate: form.issueDate || undefined,
        },
        token
      );
      toast.success("Nota fiscal salva.");
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova nota fiscal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleExtract} />
            <Button type="button" variant="outline" size="sm" className="w-fit" disabled={extracting} onClick={() => fileInputRef.current?.click()}>
              <Sparkles className="size-4" />
              {extracting ? "Lendo nota fiscal..." : "Ler nota fiscal por foto (IA)"}
            </Button>
            {autoClientMessage && <p className="text-xs text-muted-foreground">{autoClientMessage}</p>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v as InvoiceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-number">Número</Label>
              <Input id="inv-number" value={form.number} onChange={(e) => set("number", e.target.value)} placeholder="Automático se vazio" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-series">Série</Label>
              <Input id="inv-series" value={form.series} onChange={(e) => set("series", e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="inv-access-key">Chave de acesso</Label>
            <Input id="inv-access-key" value={form.accessKey} onChange={(e) => set("accessKey", e.target.value)} placeholder="44 dígitos (NF-e/NFC-e)" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="inv-issuer-name">Emitente</Label>
              <Input id="inv-issuer-name" value={form.issuerName} onChange={(e) => set("issuerName", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-issuer-doc">CNPJ/CPF do emitente</Label>
              <Input id="inv-issuer-doc" value={form.issuerDocument} onChange={(e) => set("issuerDocument", e.target.value)} />
            </div>
          </div>

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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="inv-recipient-name">Destinatário (nome na nota)</Label>
              <Input id="inv-recipient-name" value={form.recipientName} onChange={(e) => set("recipientName", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-recipient-doc">CNPJ/CPF do destinatário</Label>
              <Input id="inv-recipient-doc" value={form.recipientDocument} onChange={(e) => set("recipientDocument", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="inv-operation">Natureza da operação</Label>
              <Input id="inv-operation" value={form.operationNature} onChange={(e) => set("operationNature", e.target.value)} placeholder="Venda de mercadoria" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="inv-payment">Forma de pagamento</Label>
              <Input id="inv-payment" value={form.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value)} placeholder="PIX" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="inv-description">Descrição / discriminação *</Label>
            <Input id="inv-description" required value={form.description} onChange={(e) => set("description", e.target.value)} />
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

          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar nota fiscal"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
