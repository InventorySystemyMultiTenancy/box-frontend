"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SuggestInput } from "@/components/ui/suggest-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import type { BankAccount, ExpenseClassifications, Store, Supplier } from "@/lib/types";

// Mesmo layout do "Cadastrar contas a Pagar" que a oficina já usava: cabeçalho com nota,
// fornecedor e classificação da despesa, e "Condições de pagamento" com as duplicatas
// digitadas uma a uma (vencimento/valor) — cada uma vira uma conta a pagar.

interface DuplicateRow {
  documentNumber: string;
  dueDate: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
  bankAccountId: string;
}

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function brl(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function addMonths(isoDate: string, months: number) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const EMPTY_HEADER = {
  storeId: "",
  invoiceNumber: "",
  issueDate: today(),
  payeeName: "",
  expenseGroup: "",
  expenseDescription: "",
  category: "",
  expenseSector: "",
  totalAmount: "",
  notes: "",
};

const EMPTY_DUPLICATE = { documentNumber: "", dueDate: "", amount: "", paymentMethod: "Boleto", paid: false, paidAt: today(), paidBankAccountId: "" };

export function PayableFormDialog({ trigger, onSaved }: { trigger: React.ReactNode; onSaved: () => void }) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [plannedBankAccountId, setPlannedBankAccountId] = useState("");
  const [dup, setDup] = useState(EMPTY_DUPLICATE);
  const [rows, setRows] = useState<DuplicateRow[]>([]);
  const [split, setSplit] = useState({ count: "2", firstDueDate: "" });

  const { data: classifications } = useQuery({
    queryKey: ["expense-classifications"],
    queryFn: async () => (await api.expenseClassifications(token!)) as ExpenseClassifications,
    enabled: !!token && open,
  });
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-all"],
    queryFn: async () => (await api.suppliers(token!, { pageSize: 100 })).items as Supplier[],
    enabled: !!token && open,
  });
  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await api.bankAccounts(token!)).accounts as BankAccount[],
    enabled: !!token && open,
  });
  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await api.stores(token!)).stores as Store[],
    enabled: !!token && open,
  });

  // Descrições do grupo escolhido primeiro; as sem grupo (ou de outro grupo) depois.
  const descriptionOptions = useMemo(() => {
    const all = classifications?.descriptions ?? [];
    const ofGroup = all.filter((d) => d.group && d.group.toLowerCase() === header.expenseGroup.trim().toLowerCase()).map((d) => d.name);
    const others = all.map((d) => d.name).filter((n) => !ofGroup.includes(n));
    return [...new Set([...ofGroup, ...others])];
  }, [classifications, header.expenseGroup]);

  const totalAmount = Number(header.totalAmount) || 0;
  const duplicatesTotal = rows.reduce((sum, r) => sum + r.amount, 0);
  const remaining = Math.round((totalAmount - duplicatesTotal) * 100) / 100;
  const bankName = (id: string) => accounts?.find((a) => a.id === id)?.name ?? "—";

  function setH<K extends keyof typeof header>(key: K, value: string) {
    setHeader((h) => ({ ...h, [key]: value }));
  }

  function reset() {
    setHeader({ ...EMPTY_HEADER, issueDate: today() });
    setDup({ ...EMPTY_DUPLICATE, paidAt: today() });
    setRows([]);
    setPlannedBankAccountId("");
    setSplit({ count: "2", firstDueDate: "" });
  }

  function handleOpenChange(next: boolean) {
    if (next) reset();
    setOpen(next);
  }

  // Botão ✓ "Confirme" — adiciona a duplicata digitada na tabela.
  function confirmDuplicate() {
    const amount = Number(dup.amount || (remaining > 0 ? remaining : 0));
    if (!dup.dueDate) return toast.error("Informe o vencimento da duplicata.");
    if (!(amount > 0)) return toast.error("Informe o valor da duplicata.");
    setRows((prev) => [
      ...prev,
      {
        documentNumber: dup.documentNumber.trim() || String(prev.length + 1),
        dueDate: dup.dueDate,
        amount: Math.round(amount * 100) / 100,
        paymentMethod: dup.paymentMethod,
        paidAt: dup.paid ? dup.paidAt : "",
        bankAccountId: dup.paid ? dup.paidBankAccountId : "",
      },
    ]);
    setDup((d) => ({ ...EMPTY_DUPLICATE, paymentMethod: d.paymentMethod, dueDate: d.dueDate ? addMonths(d.dueDate, 1) : "", paidAt: today() }));
  }

  // Atalho: divide o Valor N.F. em N duplicatas mensais iguais (centavos na última).
  function generateInstallments() {
    const count = Math.max(1, Math.min(60, Math.floor(Number(split.count) || 1)));
    if (!(totalAmount > 0)) return toast.error("Informe o Valor N.F. antes de gerar as parcelas.");
    if (!split.firstDueDate) return toast.error("Informe o vencimento da 1ª parcela.");
    const cents = Math.round(totalAmount * 100);
    const base = Math.floor(cents / count);
    setRows(
      Array.from({ length: count }, (_, i) => ({
        documentNumber: `${i + 1}/${count}`,
        dueDate: addMonths(split.firstDueDate, i),
        amount: (i === count - 1 ? cents - base * (count - 1) : base) / 100,
        paymentMethod: dup.paymentMethod,
        paidAt: "",
        bankAccountId: "",
      }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!header.payeeName.trim()) return toast.error("Informe o fornecedor.");
    if (!header.category.trim()) return toast.error("Informe a categoria (natureza da operação).");
    if (rows.length === 0) return toast.error('Adicione ao menos uma duplicata em "Condições de pagamento" (botão ✓).');
    if (totalAmount > 0 && Math.abs(remaining) >= 0.01) {
      return toast.error(`A soma das duplicatas (${brl(duplicatesTotal)}) não bate com o Valor N.F. (${brl(totalAmount)}).`);
    }

    const supplier = suppliers?.find((s) => s.name.trim().toLowerCase() === header.payeeName.trim().toLowerCase());
    setSaving(true);
    try {
      const { installments } = await api.createPayables(
        {
          storeId: header.storeId || undefined,
          invoiceNumber: header.invoiceNumber || undefined,
          issueDate: header.issueDate ? new Date(`${header.issueDate}T12:00:00`).toISOString() : undefined,
          payeeName: header.payeeName.trim(),
          supplierId: supplier?.id,
          expenseGroup: header.expenseGroup || undefined,
          expenseDescription: header.expenseDescription || undefined,
          category: header.category,
          expenseSector: header.expenseSector || undefined,
          notes: header.notes || undefined,
          bankAccountId: plannedBankAccountId || undefined,
          duplicates: rows.map((r) => ({
            documentNumber: r.documentNumber,
            dueDate: new Date(`${r.dueDate}T12:00:00`).toISOString(),
            amount: r.amount,
            paymentMethod: r.paymentMethod,
            paidAt: r.paidAt ? new Date(`${r.paidAt}T12:00:00`).toISOString() : undefined,
            bankAccountId: r.bankAccountId || undefined,
          })),
        },
        token
      );
      toast.success(installments.length > 1 ? `${installments.length} duplicatas lançadas em contas a pagar.` : "Conta a pagar lançada.");
      queryClient.invalidateQueries({ queryKey: ["expense-classifications"] });
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível lançar a conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Cadastrar contas a pagar</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Só esta área rola (no celular a rolagem fica no formulário, não na página). */}
          <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain pr-1">
            {/* Cabeçalho do lançamento */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              {stores && stores.length > 0 && (
                <div className="grid gap-1.5 sm:col-span-4">
                  <Label>Empresa</Label>
                  <Select value={header.storeId || "NONE"} onValueChange={(v) => setH("storeId", v === "NONE" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">—</SelectItem>
                      {stores.filter((s) => s.active).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className={`grid gap-1.5 ${stores && stores.length > 0 ? "sm:col-span-2" : "sm:col-span-6"}`}>
                <Label>Responsável pelo lançamento</Label>
                <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm">
                  <UserRound className="size-4 text-muted-foreground" />
                  {user?.name}
                </div>
              </div>

              <div className="grid gap-1.5 sm:col-span-3">
                <Label htmlFor="ap-nf">Nota fiscal</Label>
                <Input id="ap-nf" value={header.invoiceNumber} onChange={(e) => setH("invoiceNumber", e.target.value)} placeholder="Nº da nota (opcional)" />
              </div>
              <div className="grid gap-1.5 sm:col-span-3">
                <Label htmlFor="ap-issue">Data emissão</Label>
                <Input id="ap-issue" type="date" value={header.issueDate} onChange={(e) => setH("issueDate", e.target.value)} />
              </div>

              <div className="grid gap-1.5 sm:col-span-6">
                <Label htmlFor="ap-supplier">Fornecedor *</Label>
                <SuggestInput
                  id="ap-supplier"
                  options={(suppliers ?? []).filter((s) => s.active !== false).map((s) => s.name)}
                  value={header.payeeName}
                  onChange={(e) => setH("payeeName", e.target.value)}
                  placeholder="Escolha um fornecedor cadastrado ou digite o nome"
                />
              </div>

              <div className="grid gap-1.5 sm:col-span-3">
                <Label htmlFor="ap-group">Grupo despesa</Label>
                <SuggestInput id="ap-group" options={classifications?.groups ?? []} value={header.expenseGroup} onChange={(e) => setH("expenseGroup", e.target.value)} placeholder="Ex.: FOLHA DE PAGAMENTO" />
              </div>
              <div className="grid gap-1.5 sm:col-span-3">
                <Label htmlFor="ap-desc">Descr. despesa</Label>
                <SuggestInput id="ap-desc" options={descriptionOptions} value={header.expenseDescription} onChange={(e) => setH("expenseDescription", e.target.value)} placeholder="Ex.: ASSISTÊNCIA MÉDICA" />
              </div>

              <div className="grid gap-1.5 sm:col-span-3">
                <Label htmlFor="ap-category">Categoria (natureza da operação) *</Label>
                <SuggestInput id="ap-category" options={classifications?.categories ?? []} value={header.category} onChange={(e) => setH("category", e.target.value)} placeholder="Ex.: Despesas administrativas" />
              </div>
              <div className="grid gap-1.5 sm:col-span-3">
                <Label htmlFor="ap-sector">Origem despesa (setor)</Label>
                <SuggestInput id="ap-sector" options={classifications?.sectors ?? []} value={header.expenseSector} onChange={(e) => setH("expenseSector", e.target.value)} placeholder="Ex.: Administração" />
              </div>

              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="ap-total">Valor N.F.</Label>
                <Input id="ap-total" type="number" min="0" step="0.01" value={header.totalAmount} onChange={(e) => setH("totalAmount", e.target.value)} />
              </div>
              <div className="grid gap-1.5 sm:col-span-4">
                <Label htmlFor="ap-notes">Observação</Label>
                <Input id="ap-notes" value={header.notes} onChange={(e) => setH("notes", e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Categorias, grupos, descrições e setores novos ficam salvos e aparecem como sugestão nos próximos lançamentos.
            </p>

            {/* Condições de pagamento */}
            <fieldset className="grid gap-3 rounded-lg border p-3">
              <legend className="px-1 text-sm font-semibold">Condições de pagamento</legend>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                <div className="grid gap-1.5 sm:col-span-3">
                  <Label>Pagto previsto na C/C</Label>
                  <Select value={plannedBankAccountId || "NONE"} onValueChange={(v) => setPlannedBankAccountId(v === "NONE" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Conta bancária..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">—</SelectItem>
                      {(accounts ?? []).map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}{a.bank ? ` — ${a.bank}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5 sm:col-span-3">
                  <Label>Tipo docto</Label>
                  <Select value={dup.paymentMethod} onValueChange={(v) => setDup((d) => ({ ...d, paymentMethod: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Boleto", ...PAYMENT_METHODS.filter((m) => m !== "Boleto")].map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5 sm:col-span-1">
                  <Label htmlFor="ap-dup">Dupl.</Label>
                  <Input id="ap-dup" value={dup.documentNumber} onChange={(e) => setDup((d) => ({ ...d, documentNumber: e.target.value }))} placeholder={String(rows.length + 1)} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="ap-due">Vencto</Label>
                  <Input id="ap-due" type="date" value={dup.dueDate} onChange={(e) => setDup((d) => ({ ...d, dueDate: e.target.value }))} />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="ap-dup-value">Valor</Label>
                  <Input
                    id="ap-dup-value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={dup.amount}
                    onChange={(e) => setDup((d) => ({ ...d, amount: e.target.value }))}
                    placeholder={remaining > 0 ? remaining.toFixed(2) : ""}
                  />
                </div>
                <div className="flex items-end sm:col-span-1">
                  <Button type="button" className="w-full" onClick={confirmDuplicate} title="Adicionar duplicata">
                    <Check className="size-4" />
                    Confirme
                  </Button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={dup.paid} onChange={(e) => setDup((d) => ({ ...d, paid: e.target.checked }))} />
                Banco — preencher somente se o pagamento foi efetuado
              </label>
              {dup.paid && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label>Data do pagamento</Label>
                    <Input type="date" value={dup.paidAt} onChange={(e) => setDup((d) => ({ ...d, paidAt: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Banco do pagamento</Label>
                    <Select value={dup.paidBankAccountId || "NONE"} onValueChange={(v) => setDup((d) => ({ ...d, paidBankAccountId: v === "NONE" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Conta bancária..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">—</SelectItem>
                        {(accounts ?? []).map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-2 text-sm">
                <span className="text-muted-foreground">Ou gere parcelas iguais do Valor N.F.:</span>
                <Input className="w-20" type="number" min="1" max="60" value={split.count} onChange={(e) => setSplit((s) => ({ ...s, count: e.target.value }))} aria-label="Quantidade de parcelas" />
                <span className="text-muted-foreground">x, 1º vencimento</span>
                <Input className="w-40" type="date" value={split.firstDueDate} onChange={(e) => setSplit((s) => ({ ...s, firstDueDate: e.target.value }))} aria-label="Vencimento da primeira parcela" />
                <Button type="button" variant="outline" size="sm" onClick={generateInstallments}>
                  <Plus className="size-4" />
                  Gerar parcelas
                </Button>
              </div>

              <div className="min-w-0 overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Duplicata</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Dt. pagto</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Emissão</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nenhuma duplicata — preencha vencimento e valor acima e clique em &quot;Confirme&quot;.
                        </TableCell>
                      </TableRow>
                    )}
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.documentNumber}</TableCell>
                        <TableCell>{new Date(`${r.dueDate}T12:00:00`).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{brl(r.amount)}</TableCell>
                        <TableCell>{r.paidAt ? new Date(`${r.paidAt}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell>{r.paidAt ? bankName(r.bankAccountId) : "—"}</TableCell>
                        <TableCell>{r.paymentMethod}</TableCell>
                        <TableCell>{header.issueDate ? new Date(`${header.issueDate}T12:00:00`).toLocaleDateString("pt-BR") : "—"}</TableCell>
                        <TableCell>
                          <Button type="button" size="icon" variant="ghost" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remover duplicata">
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-wrap justify-end gap-4 text-sm">
                <span>Total das duplicatas: <strong>{brl(duplicatesTotal)}</strong></span>
                {totalAmount > 0 && (
                  <span className={Math.abs(remaining) >= 0.01 ? "font-semibold text-destructive" : "text-muted-foreground"}>
                    {Math.abs(remaining) < 0.01 ? "Bate com o Valor N.F." : remaining > 0 ? `Faltam ${brl(remaining)}` : `Passou ${brl(-remaining)} do Valor N.F.`}
                  </span>
                )}
              </div>
            </fieldset>

          </div>
          <DialogFooter className="border-t pt-3">
            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>{saving ? "Salvando..." : "Salvar conta a pagar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
