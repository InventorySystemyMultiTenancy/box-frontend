"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { todayInputValue } from "@/lib/dates";
import { printRefuelingReport, type RefuelingReport } from "@/lib/refueling-report";
import type { Truck } from "@/lib/types";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function firstDayOfMonth() {
  return `${todayInputValue().slice(0, 8)}01`;
}

// Caminhões > Abastecimentos > "Relatório" (só admin): escolhe o período (e, se quiser, um
// caminhão), vê o resumo e gera o PDF completo para salvar ou imprimir.
export function RefuelingReportDialog({ trigger }: { trigger: React.ReactNode }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(todayInputValue);
  const [truckId, setTruckId] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<RefuelingReport | null>(null);

  const { data: trucks } = useQuery({
    queryKey: ["trucks"],
    queryFn: async () => (await api.trucks(token!)).trucks as Truck[],
    enabled: !!token && open,
  });
  const truck = trucks?.find((t) => t.id === truckId);
  const truckLabel = truck ? [truck.plate, truck.brand, truck.model].filter(Boolean).join(" ") : undefined;

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (from > to) {
      toast.error("A data final precisa ser igual ou depois da inicial.");
      return;
    }
    setLoading(true);
    try {
      const { report } = await api.truckRefuelingReport(token, { from, to, truckId: truckId || undefined });
      setReport(report as RefuelingReport);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível gerar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  // Mudou o período ou o caminhão: o resumo antigo não vale mais.
  function change(setter: (value: string) => void, value: string) {
    setter(value);
    setReport(null);
  }

  const t = report?.totals;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Relatório de abastecimentos</DialogTitle>
        </DialogHeader>
        <form onSubmit={generate} className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain pr-1">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="refueling-report-from">De</Label>
              <Input id="refueling-report-from" type="date" required value={from} onChange={(e) => change(setFrom, e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="refueling-report-to">Até</Label>
              <Input id="refueling-report-to" type="date" required value={to} onChange={(e) => change(setTo, e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Caminhão</Label>
              <Select value={truckId || "ALL"} onValueChange={(v) => change(setTruckId, v === "ALL" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os caminhões</SelectItem>
                  {(trucks ?? []).map((x) => (
                    <SelectItem key={x.id} value={x.id}>{[x.plate, x.brand, x.model].filter(Boolean).join(" ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {report && t && (
            <div className="grid gap-3 text-sm">
              {t.refuelings === 0 ? (
                <p className="rounded-md border p-3 text-muted-foreground">Nenhum abastecimento registrado no período.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      ["Gasto total", brl(t.amount)],
                      ["Abastecimentos", String(t.refuelings)],
                      ["Litros", `${t.liters.toLocaleString("pt-BR")} L`],
                      ["Km rodados", `${t.km.toLocaleString("pt-BR")} km`],
                      ["Consumo médio", t.avgKmPerLiter != null ? `${t.avgKmPerLiter.toLocaleString("pt-BR")} km/l` : "—"],
                      ["Preço médio/L", t.avgPricePerLiter != null ? `R$ ${t.avgPricePerLiter.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}` : "—"],
                      ["Custo por km", t.costPerKm != null ? `R$ ${t.costPerKm.toLocaleString("pt-BR", { minimumFractionDigits: 3 })}` : "—"],
                      ["Média por dia", brl(t.avgAmountPerDay)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border p-2">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="font-semibold">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-1">
                    <span className="font-medium">Por caminhão</span>
                    {report.trucks.map((x) => (
                      <div key={x.truckId} className="flex flex-wrap justify-between gap-x-3 rounded-md border px-2.5 py-1.5">
                        <span className="font-medium">{x.plate}</span>
                        <span className="text-muted-foreground">
                          {x.refuelings} abast. · {x.km.toLocaleString("pt-BR")} km · {x.avgKmPerLiter != null ? `${x.avgKmPerLiter.toLocaleString("pt-BR")} km/l` : "— km/l"}
                        </span>
                        <span className="font-medium">{brl(x.amount)}</span>
                      </div>
                    ))}
                  </div>
                  {report.alerts.length > 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-300">{report.alerts.length} ponto(s) de atenção — detalhados no PDF.</p>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button type="submit" variant={report ? "outline" : "default"} disabled={loading}>
              {loading ? "Gerando..." : report ? "Atualizar" : "Gerar relatório"}
            </Button>
            {report && (
              <Button type="button" onClick={() => printRefuelingReport(report, truckLabel)}>
                <Printer className="size-4" /> PDF / Imprimir
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
