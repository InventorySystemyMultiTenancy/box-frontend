"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Car, Wallet, Package, Calendar, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { AppNotification } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  STALE_STATUS: "OS parada",
  SUPPLEMENT_PENDING: "Complemento pendente",
  LOW_STOCK: "Estoque baixo",
  INSPECTION_TODAY: "Vistoria hoje",
  DELIVERY_TOMORROW: "Entrega amanhã",
  PAYABLE_OVERDUE: "Conta vencida",
};

type AlertCategory = "VEICULOS" | "FINANCEIRO" | "ESTOQUE" | "AGENDA";

// Cada tipo de notificação cai numa categoria — se um novo NOTIFICATION_TYPE for
// criado no backend e não for mapeado aqui, cai em "VEICULOS" (categoria coringa)
// em vez de sumir da tela.
const TYPE_CATEGORY: Record<string, AlertCategory> = {
  STALE_STATUS: "VEICULOS",
  DELIVERY_TOMORROW: "VEICULOS",
  SUPPLEMENT_PENDING: "FINANCEIRO",
  PAYABLE_OVERDUE: "FINANCEIRO",
  LOW_STOCK: "ESTOQUE",
  INSPECTION_TODAY: "AGENDA",
};

interface CategoryTheme {
  label: string;
  icon: LucideIcon;
  border: string;
  iconWrap: string;
  badge: string;
}

// Mesmo padrão visual das colunas do Kanban de projetos: card branco, faixa
// colorida no topo, ícone num chip colorido e badge de contagem no mesmo tom.
const CATEGORY_THEME: Record<AlertCategory, CategoryTheme> = {
  VEICULOS: {
    label: "Veículos",
    icon: Car,
    border: "border-t-blue-500",
    iconWrap: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  FINANCEIRO: {
    label: "Financeiro",
    icon: Wallet,
    border: "border-t-emerald-500",
    iconWrap: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  ESTOQUE: {
    label: "Estoque",
    icon: Package,
    border: "border-t-orange-500",
    iconWrap: "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  AGENDA: {
    label: "Agenda",
    icon: Calendar,
    border: "border-t-purple-500",
    iconWrap: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
};

const CATEGORY_ORDER: AlertCategory[] = ["VEICULOS", "FINANCEIRO", "ESTOQUE", "AGENDA"];

function categoryOf(type: string): AlertCategory {
  return TYPE_CATEGORY[type] ?? "VEICULOS";
}

export default function AlertasPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<AlertCategory | null>(null);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => (await api.alerts(token!)).notifications as AppNotification[],
    enabled: !!token,
    refetchInterval: 60000,
  });

  const grouped = useMemo(() => {
    const byCategory = new Map<AlertCategory, AppNotification[]>();
    for (const category of CATEGORY_ORDER) byCategory.set(category, []);
    for (const n of notifications ?? []) {
      byCategory.get(categoryOf(n.type))?.push(n);
    }
    return byCategory;
  }, [notifications]);

  async function markRead(id: string) {
    if (!token) return;
    try {
      await api.markAlertRead(id, token);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível marcar o alerta como lido.");
    }
  }

  const visibleNotifications = selectedCategory ? grouped.get(selectedCategory) ?? [] : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Central de alertas</h1>
        <p className="text-sm text-muted-foreground">OS paradas, complementos pendentes, estoque baixo, vistorias e entregas próximas.</p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!isLoading && (
        <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {CATEGORY_ORDER.map((category) => {
            const theme = CATEGORY_THEME[category];
            const Icon = theme.icon;
            const count = grouped.get(category)?.length ?? 0;
            const active = selectedCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(active ? null : category)}
                className={`flex flex-col items-center gap-2 rounded-lg border border-t-4 bg-card p-4 text-center shadow-sm transition-shadow hover:shadow-md ${theme.border} ${
                  active ? "ring-2 ring-primary" : ""
                }`}
              >
                <span className={`flex size-10 items-center justify-center rounded-full ${theme.iconWrap}`}>
                  <Icon className="size-5" />
                </span>
                <span className="text-sm font-semibold">{theme.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${theme.badge}`}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && !selectedCategory && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Selecione uma categoria acima para ver os alertas.
        </p>
      )}

      {selectedCategory && (
        <div className="grid gap-3">
          {visibleNotifications.length === 0 && (
            <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhum alerta de {CATEGORY_THEME[selectedCategory].label.toLowerCase()} no momento.
            </p>
          )}
          {visibleNotifications.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{TYPE_LABELS[n.type] ?? n.type}</Badge>
                <span className="text-sm">{n.message}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                <Check className="size-4" />
                Marcar como lido
              </Button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
