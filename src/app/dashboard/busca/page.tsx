"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { STATUS_LABELS, ServiceOrder, Estimate, ESTIMATE_STATUS_LABELS } from "@/lib/types";

export default function BuscaGlobalPage() {
  const { token } = useAuth();
  const [q, setQ] = useState("");

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", q],
    queryFn: async () => {
      const res = await api.globalSearch(q, token!);
      return { orders: res.orders as ServiceOrder[], estimates: res.estimates as Estimate[] };
    },
    enabled: !!token && q.trim().length >= 2,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Busca global</h1>
        <p className="text-sm text-muted-foreground">Nº de OS, orçamento, placa, cliente, veículo, seguradora, consultor ou orçamentista.</p>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar..." className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>

      {q.trim().length < 2 && <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres.</p>}
      {isFetching && <p className="text-sm text-muted-foreground">Buscando...</p>}

      {data && (
        <div className="grid gap-6">
          {data.orders.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ordens de serviço</h2>
              <div className="grid gap-2">
                {data.orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard?order=${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{order.vehicle.brand} {order.vehicle.model}</strong>{" "}
                      <span className="font-mono text-xs text-muted-foreground">{order.code}</span>
                      {order.vehicle.plate && <span className="text-muted-foreground"> · {order.vehicle.plate}</span>}
                    </span>
                    <Badge variant="outline">{STATUS_LABELS[order.status]}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.estimates.length > 0 && (
            <div>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Orçamentos</h2>
              <div className="grid gap-2">
                {data.estimates.map((estimate) => (
                  <Link
                    key={estimate.id}
                    href={`/dashboard?order=${estimate.serviceOrderId}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span className="font-mono text-xs">{estimate.code}</span>
                    <Badge variant="outline">{ESTIMATE_STATUS_LABELS[estimate.status]}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {q.trim().length >= 2 && data.orders.length === 0 && data.estimates.length === 0 && !isFetching && (
            <p className="text-sm text-muted-foreground">Nenhum resultado encontrado.</p>
          )}
        </div>
      )}
    </main>
  );
}
