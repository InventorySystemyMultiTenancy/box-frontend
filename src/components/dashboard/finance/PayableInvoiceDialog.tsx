"use client";

import { useState } from "react";
import { FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { prepareImageForAi, UnsupportedImageError } from "@/lib/image-compress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CameraOrGalleryPicker } from "@/components/ui/camera-or-gallery-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Dados extras da nota cadastrada junto com a conta a pagar (vão em invoiceDetails). */
export interface PayableInvoiceDetails {
  type: "NFE" | "NFSE" | "NFCE";
  series?: string;
  accessKey?: string;
  issuerDocument?: string;
  taxAmount?: number;
  discountAmount?: number;
}

/** O que o mini formulário devolve para preencher a conta a pagar. */
export interface PayableInvoiceResult {
  number: string;
  issuerName: string;
  issueDate: string; // YYYY-MM-DD
  totalAmount: string;
  operationNature: string;
  details: PayableInvoiceDetails;
}

const EMPTY = {
  type: "NFE" as PayableInvoiceDetails["type"],
  number: "",
  series: "",
  issuerName: "",
  issuerDocument: "",
  issueDate: "",
  totalAmount: "",
  accessKey: "",
  operationNature: "",
  taxAmount: "",
  discountAmount: "",
};

/**
 * "Gerar nota fiscal" dentro da nova conta a pagar: mini formulário de nota (com leitura
 * da foto por IA). Não grava nada sozinho — preenche a conta e a nota é cadastrada junto
 * quando a conta a pagar é salva (ligada às parcelas, sem duplicar nota já existente).
 */
export function PayableInvoiceDialog({
  initial,
  onApply,
}: {
  initial: { number: string; issuerName: string; issueDate: string; totalAmount: string };
  onApply: (result: PayableInvoiceResult) => void;
}) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [extracting, setExtracting] = useState(false);

  function set(key: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleOpenChange(next: boolean) {
    if (next) setForm({ ...EMPTY, ...initial });
    setOpen(next);
  }

  async function readPhoto(original: File | undefined) {
    if (!original || !token) return;
    setExtracting(true);
    try {
      const { extracted } = await api.extractInvoice(await prepareImageForAi(original), token);
      setForm((f) => ({
        ...f,
        type: extracted.type ?? f.type,
        number: extracted.number ?? f.number,
        series: extracted.series ?? f.series,
        issuerName: extracted.issuerName ?? f.issuerName,
        issuerDocument: extracted.issuerDocument ?? f.issuerDocument,
        issueDate: extracted.issueDate ?? f.issueDate,
        totalAmount: extracted.totalAmount ? String(extracted.totalAmount) : f.totalAmount,
        accessKey: extracted.accessKey ?? f.accessKey,
        operationNature: extracted.operationNature ?? f.operationNature,
        taxAmount: extracted.taxAmount ? String(extracted.taxAmount) : f.taxAmount,
        discountAmount: extracted.discountAmount ? String(extracted.discountAmount) : f.discountAmount,
      }));
      toast.success("Dados da nota lidos — confira antes de usar.");
    } catch (err) {
      toast.error(err instanceof ApiError || err instanceof UnsupportedImageError ? err.message : "Não foi possível ler a imagem.");
    } finally {
      setExtracting(false);
    }
  }

  function apply() {
    if (!form.number.trim()) return toast.error("Informe o número da nota fiscal.");
    if (!form.issuerName.trim()) return toast.error("Informe o emitente (fornecedor) da nota.");
    const num = (v: string) => (v.trim() && Number(v) >= 0 ? Number(v) : undefined);
    onApply({
      number: form.number.trim(),
      issuerName: form.issuerName.trim(),
      issueDate: form.issueDate,
      totalAmount: form.totalAmount,
      operationNature: form.operationNature.trim(),
      details: {
        type: form.type,
        series: form.series.trim() || undefined,
        accessKey: form.accessKey.trim() || undefined,
        issuerDocument: form.issuerDocument.trim() || undefined,
        taxAmount: num(form.taxAmount),
        discountAmount: num(form.discountAmount),
      },
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-fit">
          <FileText className="size-4" />
          Gerar nota fiscal
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nota fiscal da conta a pagar</DialogTitle>
          <DialogDescription>
            A nota é cadastrada em Notas fiscais junto com a conta, quando você salvar a conta a pagar.
          </DialogDescription>
        </DialogHeader>
        {/* Sem <form>: o diálogo fica dentro do formulário da conta (portal), e um submit aqui subiria até ele. */}
        <div className="grid min-h-0 gap-3 overflow-y-auto overscroll-contain pr-1">
          <div className="grid gap-1.5 rounded-md border border-dashed px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="size-4" />
              {extracting ? "Lendo nota fiscal..." : "Ler nota fiscal por foto (IA)"}
            </span>
            <CameraOrGalleryPicker disabled={extracting} onFiles={(files) => readPhoto(files[0])} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pi-number">Número *</Label>
              <Input id="pi-number" value={form.number} onChange={(e) => set("number", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pi-series">Série</Label>
              <Input id="pi-series" value={form.series} onChange={(e) => set("series", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NFE">NF-e (produto)</SelectItem>
                  <SelectItem value="NFSE">NFS-e (serviço)</SelectItem>
                  <SelectItem value="NFCE">NFC-e (cupom)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="pi-issuer">Emitente (fornecedor) *</Label>
              <Input id="pi-issuer" value={form.issuerName} onChange={(e) => set("issuerName", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pi-doc">CNPJ/CPF</Label>
              <Input id="pi-doc" value={form.issuerDocument} onChange={(e) => set("issuerDocument", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pi-issue">Emissão</Label>
              <Input id="pi-issue" type="date" value={form.issueDate} onChange={(e) => set("issueDate", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pi-total">Valor total</Label>
              <Input id="pi-total" type="number" min="0" step="0.01" value={form.totalAmount} onChange={(e) => set("totalAmount", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pi-tax">Impostos</Label>
              <Input id="pi-tax" type="number" min="0" step="0.01" value={form.taxAmount} onChange={(e) => set("taxAmount", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pi-discount">Desconto</Label>
              <Input id="pi-discount" type="number" min="0" step="0.01" value={form.discountAmount} onChange={(e) => set("discountAmount", e.target.value)} />
            </div>
            <div className="col-span-2 grid gap-1.5">
              <Label htmlFor="pi-nature">Natureza da operação</Label>
              <Input id="pi-nature" value={form.operationNature} onChange={(e) => set("operationNature", e.target.value)} placeholder="Ex.: Compra de peças" />
            </div>
            <div className="col-span-full grid gap-1.5">
              <Label htmlFor="pi-key">Chave de acesso</Label>
              <Input id="pi-key" value={form.accessKey} onChange={(e) => set("accessKey", e.target.value)} placeholder="44 dígitos (opcional)" />
            </div>
          </div>
        </div>
        <DialogFooter className="border-t pt-3">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={apply}>
            Usar na conta a pagar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
