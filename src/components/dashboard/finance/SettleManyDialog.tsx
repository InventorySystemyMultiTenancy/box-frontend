"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { todayInputValue } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export interface SettleRow {
  id: string;
  description: string;
  /** Fornecedor (a pagar) ou cliente (a receber). */
  party?: string | null;
  amount: number;
}

const TEXT = {
  payable: { verb: "pagas", verbOne: "paga", button: "Marcar como pagas", ask: "Manter datas de pagamento hoje?", dateLabel: "Data de pagamento", confirm: "Confirmar pagamento" },
  receivable: { verb: "recebidas", verbOne: "recebida", button: "Marcar como recebidas", ask: "Manter datas de recebimento hoje?", dateLabel: "Data de recebimento", confirm: "Confirmar recebimento" },
} as const;

/**
 * "Marcar como pagas/recebidas" das contas selecionadas (contas a pagar ou a receber).
 * Primeiro pergunta se mantém a data de hoje; se não, mostra uma data por conta (começando
 * em hoje) antes de confirmar. Cada conta é baixada com o valor cheio.
 */
export function SettleManyDialog({ kind, rows, onDone }: { kind: "payable" | "receivable"; rows: SettleRow[]; onDone: () => void }) {
  const text = TEXT[kind];
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"ask" | "dates">("ask");
  const [dates, setDates] = useState<Record<string, string>>({});
  const [allDate, setAllDate] = useState("");
  const [busy, setBusy] = useState(false);
  const today = todayInputValue();

  function handleOpenChange(next: boolean) {
    if (next) {
      setStep("ask");
      setDates(Object.fromEntries(rows.map((p) => [p.id, today])));
      setAllDate(today);
    }
    setOpen(next);
  }

  function applyToAll(value: string) {
    setAllDate(value);
    if (value) setDates(Object.fromEntries(rows.map((p) => [p.id, value])));
  }

  async function pay(withDates: boolean) {
    if (!token) return;
    if (withDates && rows.some((p) => !dates[p.id] || dates[p.id] > today)) {
      toast.error(`Informe uma ${text.dateLabel.toLowerCase()} (até hoje) para cada conta.`);
      return;
    }
    setBusy(true);
    try {
      const chosen = (id: string) => (withDates && dates[id] !== today ? dates[id] : undefined);
      const count =
        kind === "payable"
          ? (await api.payManyPayables(rows.map((p) => ({ id: p.id, paidAt: chosen(p.id) })), token)).paid
          : (await api.receiveManyReceivables(rows.map((p) => ({ id: p.id, receivedAt: chosen(p.id) })), token)).received;
      toast.success(`${count} conta(s) marcada(s) como ${text.verbOne}(s).`);
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : `Não foi possível marcar as contas como ${text.verb}.`);
    } finally {
      setBusy(false);
    }
  }

  const total = rows.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={rows.length === 0}>
          <CheckCheck className="size-4" />
          {`${text.button}${rows.length ? ` (${rows.length})` : ""}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Marcar {rows.length} conta{rows.length === 1 ? "" : "s"} como {rows.length === 1 ? text.verbOne : text.verb}
          </DialogTitle>
          <DialogDescription>
            Total: {brl(total)} — cada conta é baixada com o valor cheio.
          </DialogDescription>
        </DialogHeader>

        {step === "ask" ? (
          <>
            <p className="text-sm font-medium">{text.ask}</p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("dates")} disabled={busy}>
                Não, escolher as datas
              </Button>
              <Button onClick={() => pay(false)} disabled={busy}>
                {busy ? "Marcando..." : "Sim, hoje"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="pay-many-all">Aplicar a mesma data a todas</Label>
              <Input id="pay-many-all" type="date" max={today} className="w-44" value={allDate} onChange={(e) => applyToAll(e.target.value)} />
            </div>
            <div className="grid min-h-0 gap-2 overflow-y-auto overscroll-contain pr-1">
              {rows.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.party ? `${p.party} · ` : ""}
                      {brl(p.amount)}
                    </div>
                  </div>
                  <Input
                    type="date"
                    max={today}
                    className="h-8 w-40"
                    aria-label={`${text.dateLabel} de ${p.description}`}
                    value={dates[p.id] ?? ""}
                    onChange={(e) => setDates((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => setStep("ask")} disabled={busy}>
                Voltar
              </Button>
              <Button onClick={() => pay(true)} disabled={busy}>
                {busy ? "Marcando..." : text.confirm}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
