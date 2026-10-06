"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PurchaseOrderFormDialog } from "@/components/dashboard/purchases/PurchaseOrderFormDialog";
import { ReceivePurchaseOrderDialog } from "@/components/dashboard/purchases/ReceivePurchaseOrderDialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/lib/types";

const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: "Rascunho",
  SENT: "Enviado",
  PARTIALLY_RECEIVED: "Recebido parcialmente",
  RECEIVED: "Recebido",
  CANCELLED: "Cancelado",
};

const STATUS_VARIANTS: Record<PurchaseOrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  DRAFT: "secondary",
  SENT: "outline",
  PARTIALLY_RECEIVED: "outline",
  RECEIVED: "default",
  CANCELLED: "destructive",
};

export default function ComprasPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("purchases", "manage");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: async () => (await api.purchaseOrders(token!, { pageSize: 50 })).items as PurchaseOrder[],
    enabled: !!token,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
  }

  async function handleSend(order: PurchaseOrder) {
    if (!token) return;
    try {
      await api.sendPurchaseOrder(order.id, token);
      toast.success("Pedido enviado — conta a pagar gerada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível enviar o pedido.");
    }
  }

  async function handleCancel(order: PurchaseOrder) {
    if (!token || !confirm(`Cancelar o pedido ${order.code}?`)) return;
    try {
      await api.cancelPurchaseOrder(order.id, token);
      toast.success("Pedido cancelado.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível cancelar o pedido.");
    }
  }

  const orderTotal = (order: PurchaseOrder) => order.items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compras</h1>
          <p className="text-sm text-muted-foreground">Pedidos de compra a fornecedores — enviar gera a conta a pagar; &quot;Receber&quot; registra o que chegou.</p>
        </div>
        {canManage && (
          <PurchaseOrderFormDialog
            onSaved={refetch}
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo pedido
              </Button>
            }
          />
        )}
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Previsão</TableHead>
              <TableHead className="w-56" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && (orders ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum pedido de compra.
                </TableCell>
              </TableRow>
            )}
            {(orders ?? []).map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">{order.code}</TableCell>
                <TableCell>{order.supplier.name}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[order.status]}>{STATUS_LABELS[order.status]}</Badge>
                </TableCell>
                <TableCell>R$ {orderTotal(order).toFixed(2)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {order.expectedDate ? new Date(order.expectedDate).toLocaleDateString("pt-BR") : "—"}
                </TableCell>
                <TableCell>
                  {canManage && (
                    <div className="flex justify-end gap-2">
                      {order.status === "DRAFT" && (
                        <Button size="sm" variant="outline" onClick={() => handleSend(order)}>
                          Enviar
                        </Button>
                      )}
                      {(order.status === "SENT" || order.status === "PARTIALLY_RECEIVED") && (
                        <ReceivePurchaseOrderDialog
                          order={order}
                          onSaved={refetch}
                          trigger={
                            <Button size="sm" variant="outline">
                              Receber
                            </Button>
                          }
                        />
                      )}
                      {order.status !== "RECEIVED" && order.status !== "CANCELLED" && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(order)}>
                          Cancelar
                        </Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
