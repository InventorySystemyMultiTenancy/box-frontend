"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { AccountPayable, AccountReceivable, CashFlow, DRE, FinancialEntry } from "@/lib/types";
import { openPrintableReport, escapeHtml, formatCurrencyBRL } from "@/lib/printable-report";

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function toDateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

type LedgerRow =
  | { kind: "receivable"; date: string; record: AccountReceivable }
  | { kind: "payable"; date: string; record: AccountPayable }
  | { kind: "entry"; date: string; record: FinancialEntry };

const KIND_LABELS: Record<LedgerRow["kind"], string> = {
  receivable: "Recebido",
  payable: "Pago",
  entry: "Manual",
};

export default function CashFlowPanel() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [editingRow, setEditingRow] = useState<LedgerRow | null>(null);

  const { data: cashFlow } = useQuery({
    queryKey: ["cash-flow", from, to],
    queryFn: async () => (await api.cashFlow(token!, { from, to })).cashFlow as CashFlow,
    enabled: !!token,
  });

  const { data: dre } = useQuery({
    queryKey: ["dre", from, to],
    queryFn: async () => (await api.dre(token!, { from, to })).dre as DRE,
    enabled: !!token,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["cash-flow"] });
    queryClient.invalidateQueries({ queryKey: ["dre"] });
  }

  const rows: LedgerRow[] = cashFlow
    ? [
        ...cashFlow.receivables.map((record): LedgerRow => ({ kind: "receivable", date: record.receivedAt ?? record.dueDate, record })),
        ...cashFlow.payables.map((record): LedgerRow => ({ kind: "payable", date: record.paidAt ?? record.dueDate, record })),
        ...cashFlow.entries.map((record): LedgerRow => ({ kind: "entry", date: record.occurredAt, record })),
      ].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  function generatePdf() {
    if (!cashFlow || !dre) return;
    const rowsHtml = rows
      .map((row) => {
        const amount =
          row.kind === "receivable"
            ? row.record.receivedAmount ?? row.record.amount
            : row.kind === "payable"
              ? row.record.paidAmount ?? row.record.amount
              : row.record.amount;
        const isOut = row.kind === "payable" || (row.kind === "entry" && row.record.type === "EXPENSE");
        return `
          <tr>
            <td>${new Date(row.date).toLocaleDateString("pt-BR")}</td>
            <td>${KIND_LABELS[row.kind]}</td>
            <td>${escapeHtml(row.record.description)}</td>
            <td>${escapeHtml(row.record.category)}</td>
            <td>${isOut ? "-" : "+"} ${formatCurrencyBRL(amount)}</td>
          </tr>
        `;
      })
      .join("");
    const revenueRows = dre.revenueByCategory.map((r) => `<tr><td>${escapeHtml(r.category)}</td><td>${formatCurrencyBRL(r.amount)}</td></tr>`).join("");
    const expenseRows = dre.expensesByCategory.map((r) => `<tr><td>${escapeHtml(r.category)}</td><td>${formatCurrencyBRL(r.amount)}</td></tr>`).join("");
    openPrintableReport(
      "Fluxo de caixa",
      `
        <h1>Fluxo de caixa</h1>
        <div class="muted">Período: ${new Date(from).toLocaleDateString("pt-BR")} a ${new Date(to).toLocaleDateString("pt-BR")} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
        <div class="summary">
          <div class="box"><strong>Saldo inicial</strong><br />${formatCurrencyBRL(cashFlow.initialBalance)}</div>
          <div class="box"><strong>Entradas</strong><br />${formatCurrencyBRL(cashFlow.totalIn)}</div>
          <div class="box"><strong>Saídas</strong><br />${formatCurrencyBRL(cashFlow.totalOut)}</div>
          <div class="box"><strong>Saldo final</strong><br />${formatCurrencyBRL(cashFlow.finalBalance)}</div>
        </div>
        <h2>DRE simplificado</h2>
        <table><thead><tr><th>Receita por categoria</th><th>Valor</th></tr></thead><tbody>${revenueRows || '<tr><td colspan="2">Sem receitas.</td></tr>'}</tbody></table>
        <table><thead><tr><th>Despesa por categoria</th><th>Valor</th></tr></thead><tbody>${expenseRows || '<tr><td colspan="2">Sem despesas.</td></tr>'}</tbody></table>
        <h2>Lançamentos do período</h2>
        <table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead>
          <tbody>${rowsHtml || '<tr><td colspan="5">Nenhum lançamento no período.</td></tr>'}</tbody>
        </table>
        <div class="total">Resultado líquido: ${formatCurrencyBRL(dre.netResult)}</div>
      `
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="cf-from">De</Label>
          <Input id="cf-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cf-to">Até</Label>
          <Input id="cf-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={generatePdf} disabled={!cashFlow || !dre}>
          Gerar PDF do período
        </Button>
      </div>

      {cashFlow && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Saldo inicial" value={cashFlow.initialBalance} />
          <StatCard label="Entradas" value={cashFlow.totalIn} tone="ok" />
          <StatCard label="Saídas" value={cashFlow.totalOut} tone="crit" />
          <StatCard label="Custo de peças" value={cashFlow.partsCost} tone="crit" />
          <StatCard label="Saldo final" value={cashFlow.finalBalance} />
        </div>
      )}

      {cashFlow && cashFlow.timeline.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Fluxo de caixa diário</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Entradas</TableHead>
                  <TableHead>Saídas</TableHead>
                  <TableHead>Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashFlow.timeline.map((point) => (
                  <TableRow key={point.date}>
                    <TableCell>{new Date(point.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-emerald-600">R$ {point.in.toFixed(2)}</TableCell>
                    <TableCell className="text-destructive">R$ {point.out.toFixed(2)}</TableCell>
                    <TableCell className="font-medium">R$ {point.balance.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {dre && (
        <Card>
          <CardHeader><CardTitle className="text-base">DRE simplificado</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Receitas por categoria</p>
              {dre.revenueByCategory.length === 0 && <p className="text-sm text-muted-foreground">Sem receitas no período.</p>}
              {dre.revenueByCategory.map((r) => (
                <div key={r.category} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.category}</span>
                  <span>R$ {r.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Despesas por categoria</p>
              {dre.expensesByCategory.length === 0 && <p className="text-sm text-muted-foreground">Sem despesas no período.</p>}
              {dre.expensesByCategory.map((r) => (
                <div key={r.category} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.category}</span>
                  <span>R$ {r.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="col-span-full flex justify-between border-t pt-3 text-sm font-semibold">
              <span>Resultado líquido</span>
              <span className={dre.netResult < 0 ? "text-destructive" : "text-emerald-600"}>R$ {dre.netResult.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Lançamentos do período</CardTitle></CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Tudo aqui é editável — clique em <Pencil className="inline size-3" /> para corrigir valor, data, categoria ou descrição.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum lançamento no período.</TableCell></TableRow>
              )}
              {rows.map((row) => {
                const isOut = row.kind === "payable" || (row.kind === "entry" && row.record.type === "EXPENSE");
                const amount =
                  row.kind === "receivable"
                    ? row.record.receivedAmount ?? row.record.amount
                    : row.kind === "payable"
                      ? row.record.paidAmount ?? row.record.amount
                      : row.record.amount;
                const description = row.kind === "payable" ? `${row.record.description} (${row.record.payeeName})` : row.record.description;
                return (
                  <TableRow key={`${row.kind}-${row.record.id}`}>
                    <TableCell>{new Date(row.date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-muted-foreground">{KIND_LABELS[row.kind]}</TableCell>
                    <TableCell>{description}</TableCell>
                    <TableCell className="text-muted-foreground">{row.record.category}</TableCell>
                    <TableCell className={isOut ? "text-destructive" : "text-emerald-600"}>
                      {isOut ? "-" : "+"} R$ {amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => setEditingRow(row)}>
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EditLedgerRowDialog
        row={editingRow}
        onOpenChange={(open) => !open && setEditingRow(null)}
        onSaved={() => {
          setEditingRow(null);
          refetch();
        }}
      />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "ok" | "crit" }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${tone === "ok" ? "text-emerald-600" : tone === "crit" ? "text-destructive" : "text-foreground"}`}>
        R$ {value.toFixed(2)}
      </p>
    </div>
  );
}

function EditLedgerRowDialog({
  row,
  onOpenChange,
  onSaved,
}: {
  row: LedgerRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  const [saving, setSaving] = useState(false);

  if (!row) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
        </DialogHeader>
        {row.kind === "receivable" && (
          <ReceivableForm
            record={row.record}
            saving={saving}
            onSubmit={async (payload) => {
              if (!token) return;
              setSaving(true);
              try {
                await api.updateReceivable(row.record.id, payload, token);
                toast.success("Lançamento atualizado.");
                onSaved();
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
              } finally {
                setSaving(false);
              }
            }}
          />
        )}
        {row.kind === "payable" && (
          <PayableForm
            record={row.record}
            saving={saving}
            onSubmit={async (payload) => {
              if (!token) return;
              setSaving(true);
              try {
                await api.updatePayable(row.record.id, payload, token);
                toast.success("Lançamento atualizado.");
                onSaved();
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
              } finally {
                setSaving(false);
              }
            }}
          />
        )}
        {row.kind === "entry" && (
          <EntryForm
            record={row.record}
            saving={saving}
            onSubmit={async (payload) => {
              if (!token) return;
              setSaving(true);
              try {
                await api.updateFinancialEntry(row.record.id, payload, token);
                toast.success("Lançamento atualizado.");
                onSaved();
              } catch (err) {
                toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
              } finally {
                setSaving(false);
              }
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReceivableForm({
  record,
  saving,
  onSubmit,
}: {
  record: AccountReceivable;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [description, setDescription] = useState(record.description);
  const [category, setCategory] = useState(record.category);
  const [amount, setAmount] = useState(String(record.amount));
  const [dueDate, setDueDate] = useState(toDateInput(record.dueDate));
  const [receivedAmount, setReceivedAmount] = useState(record.receivedAmount != null ? String(record.receivedAmount) : "");
  const [receivedAt, setReceivedAt] = useState(toDateInput(record.receivedAt));

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          description,
          category,
          amount: Number(amount),
          dueDate: dueDate || undefined,
          receivedAmount: receivedAmount ? Number(receivedAmount) : undefined,
          receivedAt: receivedAt || undefined,
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Categoria</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label>Valor</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Vencimento</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Data do recebimento</Label>
          <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Valor recebido</Label>
        <Input type="number" min="0" step="0.01" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}

function PayableForm({
  record,
  saving,
  onSubmit,
}: {
  record: AccountPayable;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [description, setDescription] = useState(record.description);
  const [category, setCategory] = useState(record.category);
  const [payeeName, setPayeeName] = useState(record.payeeName);
  const [amount, setAmount] = useState(String(record.amount));
  const [dueDate, setDueDate] = useState(toDateInput(record.dueDate));
  const [paidAmount, setPaidAmount] = useState(record.paidAmount != null ? String(record.paidAmount) : "");
  const [paidAt, setPaidAt] = useState(toDateInput(record.paidAt));

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          description,
          category,
          payeeName,
          amount: Number(amount),
          dueDate: dueDate || undefined,
          paidAmount: paidAmount ? Number(paidAmount) : undefined,
          paidAt: paidAt || undefined,
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Categoria</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label>Beneficiário</Label>
          <Input value={payeeName} onChange={(e) => setPayeeName(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Valor</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label>Vencimento</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Valor pago</Label>
          <Input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Data do pagamento</Label>
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}

function EntryForm({
  record,
  saving,
  onSubmit,
}: {
  record: FinancialEntry;
  saving: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [type, setType] = useState(record.type);
  const [description, setDescription] = useState(record.description);
  const [category, setCategory] = useState(record.category);
  const [amount, setAmount] = useState(String(record.amount));
  const [occurredAt, setOccurredAt] = useState(toDateInput(record.occurredAt));

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          type,
          description,
          category,
          amount: Number(amount),
          occurredAt: occurredAt ? new Date(occurredAt).toISOString() : undefined,
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label>Tipo</Label>
        <Select value={type} onValueChange={(v) => setType(v as FinancialEntry["type"])}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="INCOME">Entrada</SelectItem>
            <SelectItem value="EXPENSE">Saída</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label>Descrição</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Categoria</Label>
          <Input value={category} onChange={(e) => setCategory(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label>Valor</Label>
          <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Data</Label>
        <Input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </DialogFooter>
    </form>
  );
}
