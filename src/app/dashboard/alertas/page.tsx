"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Car, Wallet, Calendar, MessageCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, ALERTS_CHANGED_EVENT } from "@/lib/api";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { revisionReminderMessage, warrantyReminderMessage } from "@/lib/whatsapp-messages";
import { ALERT_TYPE_OPTIONS, canSeeAlertType } from "@/lib/access";
import type { AppNotification, ExpiringWarrantyPart, RevisionAlert } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  STALE_STATUS: "OS parada",
  SUPPLEMENT_PENDING: "Complemento pendente",
  INSPECTION_TODAY: "Vistoria hoje",
  DELIVERY_TOMORROW: "Entrega amanhã",
  PAYABLE_OVERDUE: "Conta vencida",
};

type AlertCategory = "VEICULOS" | "FINANCEIRO" | "AGENDA" | "CLIENTES";

// Cada tipo de notificação cai numa categoria — se um novo NOTIFICATION_TYPE for
// criado no backend e não for mapeado aqui, cai em "VEICULOS" (categoria coringa)
// em vez de sumir da tela.
const TYPE_CATEGORY: Record<string, AlertCategory> = {
  STALE_STATUS: "VEICULOS",
  DELIVERY_TOMORROW: "VEICULOS",
  SUPPLEMENT_PENDING: "FINANCEIRO",
  PAYABLE_OVERDUE: "FINANCEIRO",
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
  AGENDA: {
    label: "Agenda",
    icon: Calendar,
    border: "border-t-purple-500",
    iconWrap: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-300",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  },
  CLIENTES: {
    label: "Lembretes p/ clientes",
    icon: MessageCircle,
    border: "border-t-green-600",
    iconWrap: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
};

const CATEGORY_ORDER: AlertCategory[] = ["VEICULOS", "FINANCEIRO", "AGENDA", "CLIENTES"];

// Grupo do tipo de alerta (lib/access.ts) → categoria (card) desta tela.
const CATEGORY_OF_ALERT_GROUP: Record<string, AlertCategory> = {
  Veículos: "VEICULOS",
  Financeiro: "FINANCEIRO",
  Agenda: "AGENDA",
  "Lembretes p/ clientes": "CLIENTES",
};

function categoryOf(type: string): AlertCategory {
  return TYPE_CATEGORY[type] ?? "VEICULOS";
}

export default function AlertasPage() {
  const { token, reportAccess } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<AlertCategory | null>(null);

  // Tipos de alerta liberados pelo cargo (Cargos → Relatórios e alertas). Os alertas
  // gravados já chegam filtrados do servidor; aqui some a categoria sem nenhum tipo liberado.
  const showRevisionReminders = canSeeAlertType(reportAccess, "REVISION_REMINDER");
  const showWarrantyReminders = canSeeAlertType(reportAccess, "WARRANTY_REMINDER");
  const visibleCategories = CATEGORY_ORDER.filter((category) =>
    ALERT_TYPE_OPTIONS.some((a) => CATEGORY_OF_ALERT_GROUP[a.group] === category && canSeeAlertType(reportAccess, a.key))
  );

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
      // Atualiza o contador do sininho no topo na hora (senão só no próximo ciclo de 60s).
      window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível marcar o alerta como lido.");
    }
  }

  // Lembretes proativos (revisão preventiva atrasada e garantia vencendo nos próximos 30
  // dias) — envio manual pelo WhatsApp com a mensagem já pronta. Sem permissão para algum
  // dos dois relatórios, a lista correspondente só fica vazia.
  const { data: reminders } = useQuery({
    queryKey: ["customer-reminders", showRevisionReminders, showWarrantyReminders],
    queryFn: async () => {
      const [revisions, warranties] = await Promise.all([
        showRevisionReminders
          ? api.revisionAlerts(token!).then((r) => r.alerts as RevisionAlert[]).catch(() => [] as RevisionAlert[])
          : Promise.resolve([] as RevisionAlert[]),
        showWarrantyReminders
          ? api.expiringWarranties(token!, 30).then((r) => r.parts as ExpiringWarrantyPart[]).catch(() => [] as ExpiringWarrantyPart[])
          : Promise.resolve([] as ExpiringWarrantyPart[]),
      ]);
      return [
        ...warranties.map((part) => {
          const vehicle = part.serviceOrder.vehicle;
          const vehicleName = `${vehicle.brand} ${vehicle.model}`;
          const expiresAt = new Date(part.warrantyExpiresAt!);
          return {
            id: `w-${part.id}`,
            kind: "Garantia",
            text: `Garantia de ${part.name} — ${vehicleName}${vehicle.plate ? ` (${vehicle.plate})` : ""}, ${vehicle.owner.name}: ${
              expiresAt.getTime() < Date.now() ? "venceu" : "vence"
            } em ${expiresAt.toLocaleDateString("pt-BR")}.`,
            link: buildWhatsAppLink(vehicle.owner.phone, warrantyReminderMessage(vehicle.owner.name, vehicleName, part.name, expiresAt)),
          };
        }),
        ...revisions.map((alert) => {
          const vehicleName = `${alert.vehicle.brand} ${alert.vehicle.model}`;
          return {
            id: `r-${alert.vehicle.id}`,
            kind: "Revisão",
            text: `${vehicleName}${alert.vehicle.plate ? ` (${alert.vehicle.plate})` : ""}, ${alert.owner.name}: ${alert.monthsSinceLastService} meses sem revisão.`,
            link: buildWhatsAppLink(alert.owner.phone, revisionReminderMessage(alert.owner.name, vehicleName, alert.monthsSinceLastService)),
          };
        }),
      ];
    },
    enabled: !!token && (showRevisionReminders || showWarrantyReminders),
  });

  const visibleNotifications = selectedCategory && selectedCategory !== "CLIENTES" ? grouped.get(selectedCategory) ?? [] : [];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Central de alertas</h1>
        <p className="text-sm text-muted-foreground">
          OS paradas, contas vencidas, vistorias, entregas próximas e lembretes para enviar aos clientes. Atualizado automaticamente de hora em hora.
        </p>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

      {!isLoading && visibleCategories.length === 0 && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Seu cargo não tem nenhum tipo de alerta liberado. Peça ao administrador para ajustar em Cargos → Relatórios e alertas.
        </p>
      )}

      {!isLoading && visibleCategories.length > 0 && (
        <div className="mb-6 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
          {visibleCategories.map((category) => {
            const theme = CATEGORY_THEME[category];
            const Icon = theme.icon;
            const count = category === "CLIENTES" ? reminders?.length ?? 0 : grouped.get(category)?.length ?? 0;
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

      {!isLoading && visibleCategories.length > 0 && !selectedCategory && (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Selecione uma categoria acima para ver os alertas.
        </p>
      )}

      {selectedCategory === "CLIENTES" && (
        <div className="grid gap-3">
          {(reminders ?? []).length === 0 && (
            <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
              Nenhum cliente com revisão atrasada ou garantia vencendo nos próximos 30 dias.
            </p>
          )}
          {(reminders ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{r.kind}</Badge>
                <span className="text-sm">{r.text}</span>
              </div>
              {r.link ? (
                <Button size="sm" variant="outline" asChild>
                  <a href={r.link} target="_blank" rel="noreferrer">
                    <MessageCircle className="size-4" />
                    Enviar lembrete
                  </a>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">Sem telefone cadastrado</span>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedCategory && selectedCategory !== "CLIENTES" && (
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
