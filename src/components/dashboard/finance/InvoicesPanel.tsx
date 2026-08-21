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

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
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
                <TableCell className="text-muted-foreground">{invoice.number ? `${invoice.number}/${invoice.series}` : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{invoice.client?.name || "—"}</TableCell>
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

function InvoiceFormDialog({ trigger, onSaved }: { trigger: React.ReactNode; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [type, setType] = useState<InvoiceType>("NFSE");
  const [clientId, setClientId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [description, setDescription] = useState("");
  const [clientNameGuess, setClientNameGuess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => (await api.clients(token!, { pageSize: 100 })).items as Client[],
    enabled: !!token && open,
  });

  async function handleExtract(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setExtracting(true);
    setClientNameGuess(null);
    try {
      const { extracted } = await api.extractInvoice(file, token);
      setType(extracted.type);
      if (extracted.totalAmount) setTotalAmount(String(extracted.totalAmount));
      setDescription(extracted.description);
      setClientNameGuess(extracted.clientNameGuess);
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
      await api.createInvoice({ type, clientId: clientId || undefined, totalAmount: Number(totalAmount), description }, token);
      toast.success("Nota fiscal criada em rascunho.");
      setOpen(false);
      setType("NFSE");
      setClientId("");
      setTotalAmount("");
      setDescription("");
      setClientNameGuess(null);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a nota.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
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
            {clientNameGuess && (
              <p className="text-xs text-muted-foreground">
                Destinatário identificado na imagem: <strong>{clientNameGuess}</strong> — selecione o cliente correspondente abaixo.
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as InvoiceType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Cliente</Label>
            <Select value={clientId || "NONE"} onValueChange={(v) => setClientId(v === "NONE" ? "" : v)}>
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
            <Label htmlFor="inv-amount">Valor *</Label>
            <Input id="inv-amount" type="number" min="0" step="0.01" required value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="inv-description">Descrição *</Label>
            <Input id="inv-description" required value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar rascunho"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
