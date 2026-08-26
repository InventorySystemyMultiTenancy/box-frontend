"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { api, API_URL } from "@/lib/api";
import type { ConsumptionAlert, TruckRefueling } from "@/lib/types";

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const ALERT_STYLES: Record<ConsumptionAlert["type"], { icon: typeof AlertTriangle; className: string }> = {
  CONSUMO_ALTO: { icon: AlertTriangle, className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300" },
  CONSUMO_BAIXO: { icon: TrendingUp, className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" },
  PRECO_ACIMA_MEDIA: { icon: TrendingDown, className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300" },
};

function RefuelingCard({ refueling }: { refueling: TruckRefueling }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>
            {refueling.truck?.plate}
            {(refueling.truck?.brand || refueling.truck?.model) && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {refueling.truck?.brand} {refueling.truck?.model}
              </span>
            )}
          </span>
          <span className="text-sm font-normal text-muted-foreground">{formatDate(refueling.createdAt)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
          <span>Motorista: {refueling.driver?.name ?? "—"}</span>
          <span>Km: {refueling.currentKm.toLocaleString("pt-BR")}</span>
          <span>Km de referência: {refueling.referenceKm.toLocaleString("pt-BR")}</span>
          <span>Litros: {refueling.liters.toLocaleString("pt-BR")} L</span>
          <span>Valor pago: {formatCurrency(refueling.amountPaid)}</span>
          {refueling.pricePerLiter != null && <span>Preço/litro: {formatCurrency(refueling.pricePerLiter)}</span>}
          {refueling.kmPerLiter != null && <span className="font-medium">Consumo: {refueling.kmPerLiter.toFixed(1)} km/l</span>}
          {refueling.notes && <span className="col-span-full text-muted-foreground">Obs.: {refueling.notes}</span>}

          {refueling.alerts && refueling.alerts.length > 0 && (
            <div className="col-span-full mt-1 grid gap-1.5">
              {refueling.alerts.map((alert, i) => {
                const style = ALERT_STYLES[alert.type];
                const Icon = style.icon;
                return (
                  <div key={i} className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs ${style.className}`}>
                    <Icon className="mt-0.5 size-3.5 shrink-0" />
                    <span>{alert.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <a href={mediaUrl(refueling.photoUrl)} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl(refueling.photoUrl)} alt="Foto da bomba" className="h-28 w-40 rounded-md border object-cover" />
        </a>
      </CardContent>
    </Card>
  );
}

export function TruckRefuelingsPanel() {
  const { token } = useAuth();

  const { data: refuelings, isLoading } = useQuery({
    queryKey: ["truck-refuelings"],
    queryFn: async () => (await api.allTruckRefuelings(token!)).refuelings as TruckRefueling[],
    enabled: !!token,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  if (!refuelings || refuelings.length === 0) {
    return <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum abastecimento registrado ainda.</p>;
  }

  return (
    <div className="grid gap-3">
      {refuelings.map((refueling) => (
        <RefuelingCard key={refueling.id} refueling={refueling} />
      ))}
    </div>
  );
}
