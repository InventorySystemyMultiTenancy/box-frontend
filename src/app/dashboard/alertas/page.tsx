"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
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
};

export default function AlertasPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => (await api.alerts(token!)).notifications as AppNotification[],
    enabled: !!token,
    refetchInterval: 60000,
  });

  async function markRead(id: string) {
    if (!token) return;
    try {
      await api.markAlertRead(id, token);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível marcar o alerta como lido.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Central de alertas</h1>
        <p className="text-sm text-muted-foreground">OS paradas, complementos pendentes, estoque baixo, vistorias e entregas próximas.</p>
      </div>

      <div className="grid gap-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && (notifications ?? []).length === 0 && (
          <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum alerta no momento.</p>
        )}
        {(notifications ?? []).map((n) => (
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
    </main>
  );
}
