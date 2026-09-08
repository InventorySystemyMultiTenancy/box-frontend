"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import {
  STATUS_LABELS,
  ServiceOrder,
  Estimate,
  ESTIMATE_STATUS_LABELS,
  User,
  Vehicle,
  Supplier,
  InventoryPart,
  Truck,
  InsuranceCompany,
} from "@/lib/types";

const ROLE_LABELS: Record<string, string> = { CUSTOMER: "Cliente", MECHANIC: "Mecânico", ADMIN: "Admin" };

export default function BuscaGlobalPage() {
  const { token } = useAuth();
  const searchParams = useSearchParams();
  // Preenche com o termo vindo da busca do header (?q=...), se houver.
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");

  const { data, isFetching, isError } = useQuery({
    queryKey: ["global-search", q],
    queryFn: async () => {
      const res = await api.globalSearch(q, token!);
      return {
        orders: (res.orders ?? []) as ServiceOrder[],
        estimates: (res.estimates ?? []) as Estimate[],
        users: (res.users ?? []) as User[],
        vehicles: (res.vehicles ?? []) as Vehicle[],
        suppliers: (res.suppliers ?? []) as Supplier[],
        parts: (res.parts ?? []) as InventoryPart[],
        trucks: (res.trucks ?? []) as Truck[],
        insuranceCompanies: (res.insuranceCompanies ?? []) as InsuranceCompany[],
      };
    },
    enabled: !!token && q.trim().length >= 2,
  });

  const totalResults = data
    ? data.orders.length +
      data.estimates.length +
      data.users.length +
      data.vehicles.length +
      data.suppliers.length +
      data.parts.length +
      data.trucks.length +
      data.insuranceCompanies.length
    : 0;

  // Só pergunta à IA depois que a busca "de verdade" (banco de dados) já rodou e
  // confirmou 0 resultados, e só depois que a pessoa parou de digitar — evita
  // chamar a IA a cada tecla enquanto o termo ainda está sendo escrito.
  const [assistQuery, setAssistQuery] = useState<string | null>(null);
  useEffect(() => {
    if (isFetching || q.trim().length < 2 || totalResults > 0) {
      setAssistQuery(null);
      return;
    }
    const timer = setTimeout(() => setAssistQuery(q.trim()), 700);
    return () => clearTimeout(timer);
  }, [q, isFetching, totalResults]);

  const { data: assist, isFetching: assistLoading } = useQuery({
    queryKey: ["search-assist", assistQuery],
    queryFn: () => api.searchAssist(assistQuery!, token!),
    enabled: !!token && !!assistQuery,
    retry: false,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Busca global</h1>
        <p className="text-sm text-muted-foreground">
          Busca em tudo: OS, orçamento, clientes, usuários, veículos, peças, fornecedores, caminhões e seguradoras.
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="relative mb-6 max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar..." className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </form>

      {q.trim().length < 2 && <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres.</p>}
      {isFetching && <p className="text-sm text-muted-foreground">Buscando...</p>}
      {isError && <p className="text-sm text-destructive">Não foi possível buscar agora. Tente de novo.</p>}

      {data && (
        <div className="grid gap-6">
          {data.orders.length > 0 && (
            <section>
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
            </section>
          )}

          {data.estimates.length > 0 && (
            <section>
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
            </section>
          )}

          {data.users.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Usuários e clientes</h2>
              <div className="grid gap-2">
                {data.users.map((u) => (
                  <Link
                    key={u.id}
                    href={u.role === "CUSTOMER" ? "/dashboard/clientes" : "/dashboard/usuarios"}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{u.name}</strong>{" "}
                      <span className="text-muted-foreground">{u.email}</span>
                      {u.phone && <span className="text-muted-foreground"> · {u.phone}</span>}
                    </span>
                    <Badge variant="outline">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.vehicles.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Veículos</h2>
              <div className="grid gap-2">
                {data.vehicles.map((v) => (
                  <Link
                    key={v.id}
                    href={v.owner ? `/dashboard/clientes/${v.owner.id}` : "/dashboard/clientes"}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{v.brand} {v.model}</strong>
                      {v.plate && <span className="font-mono text-xs text-muted-foreground"> · {v.plate}</span>}
                      {v.owner && <span className="text-muted-foreground"> · {v.owner.name}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.suppliers.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fornecedores</h2>
              <div className="grid gap-2">
                {data.suppliers.map((s) => (
                  <Link
                    key={s.id}
                    href="/dashboard/fornecedores"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{s.name}</strong>
                      {s.phone && <span className="text-muted-foreground"> · {s.phone}</span>}
                      {s.email && <span className="text-muted-foreground"> · {s.email}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.parts.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Peças e materiais</h2>
              <div className="grid gap-2">
                {data.parts.map((p) => (
                  <Link
                    key={p.id}
                    href="/dashboard/pecas"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{p.name}</strong>
                      {p.sku && <span className="font-mono text-xs text-muted-foreground"> · {p.sku}</span>}
                    </span>
                    <Badge variant="outline">{p.stockQty} em estoque</Badge>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.trucks.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Caminhões</h2>
              <div className="grid gap-2">
                {data.trucks.map((t) => (
                  <Link
                    key={t.id}
                    href="/dashboard/caminhoes"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{t.plate}</strong>
                      {(t.brand || t.model) && <span className="text-muted-foreground"> · {t.brand} {t.model}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {data.insuranceCompanies.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seguradoras</h2>
              <div className="grid gap-2">
                {data.insuranceCompanies.map((i) => (
                  <Link
                    key={i.id}
                    href="/dashboard/seguradoras"
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm hover:border-primary/50"
                  >
                    <span>
                      <strong>{i.legalName}</strong>
                      {i.tradeName && <span className="text-muted-foreground"> · {i.tradeName}</span>}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {q.trim().length >= 2 && totalResults === 0 && !isFetching && (
            <div>
              <p className="mb-3 text-sm text-muted-foreground">Nenhum resultado encontrado para &quot;{q.trim()}&quot;.</p>

              {assistLoading && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Sparkles className="size-4 animate-pulse" /> Consultando a IA...
                </p>
              )}

              {assist && assistQuery === q.trim() && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                    <Sparkles className="size-3.5" /> Sugestão da IA
                  </div>
                  <p className="mb-3 text-sm text-foreground">{assist.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {assist.suggestedQuery && (
                      <button
                        type="button"
                        onClick={() => setQ(assist.suggestedQuery!)}
                        className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        Buscar por &quot;{assist.suggestedQuery}&quot;
                      </button>
                    )}
                    {assist.actions.map((action) => (
                      <Link
                        key={action.path}
                        href={action.path}
                        className="rounded-md border border-primary/40 bg-background px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        Ir para {action.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
