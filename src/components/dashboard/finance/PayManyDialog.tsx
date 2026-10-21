"use client";

import { useState } from "react";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { todayInputValue } from "@/lib/dates";
import type { AccountPayable } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * "Marcar como pagas" das contas selecionadas. Primeiro pergunta se mantém a data de hoje;
 * se não, mostra uma data de pagamento por conta (começando em hoje) antes de confirmar.
 */
export function PayManyDialog({ payables, onDone }: { payables: AccountPayable[]; onDone: () => void }) {
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
      setDates(Object.fromEntries(payables.map((p) => [p.id, today])));
      setAllDate(today);
    }
    setOpen(next);
  }

  function applyToAll(value: string) {
    setAllDate(value);
    if (value) setDates(Object.fromEntries(payables.map((p) => [p.id, value])));
  }

  async function pay(withDates: boolean) {
    if (!token) return;
    if (withDates && payables.some((p) => !dates[p.id] || dates[p.id] > today)) {
      toast.error("Informe uma data de pagamento (até hoje) para cada conta.");
      return;
    }
    setBusy(true);
    try {
      const items = payables.map((p) => ({ id: p.id, ...(withDates && dates[p.id] !== today ? { paidAt: dates[p.id] } : {}) }));
      const { paid } = await api.payManyPayables(items, token);
      toast.success(`${paid} conta(s) marcada(s) como paga(s).`);
      setOpen(false);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível marcar as contas como pagas.");
    } finally {
      setBusy(false);
    }
  }

  const total = payables.reduce((sum, p) => sum + p.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={payables.length === 0}>
          <CheckCheck className="size-4" />
          {`Marcar como pagas${payables.length ? ` (${payables.length})` : ""}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Marcar {payables.length} conta{payables.length === 1 ? "" : "s"} como paga{payables.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Total: {brl(total)} — cada conta é baixada com o valor cheio.
          </DialogDescription>
        </DialogHeader>

        {step === "ask" ? (
          <>
            <p className="text-sm font-medium">Manter datas de pagamento hoje?</p>
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
              {payables.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.description}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.payeeName} · {brl(p.amount)}
                    </div>
                  </div>
                  <Input
                    type="date"
                    max={today}
                    className="h-8 w-40"
                    aria-label={`Data de pagamento de ${p.description}`}
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
                {busy ? "Marcando..." : "Confirmar pagamento"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
