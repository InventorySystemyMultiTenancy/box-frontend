"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { PurchaseOrder } from "@/lib/types";

interface ReceivePurchaseOrderDialogProps {
  order: PurchaseOrder;
  trigger: React.ReactNode;
  onSaved: () => void;
}

export function ReceivePurchaseOrderDialog({ order, trigger, onSaved }: ReceivePurchaseOrderDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = order.items.filter((item) => item.receivedQty < item.quantity);
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  function handleOpenChange(next: boolean) {
    if (next) {
      setQuantities(Object.fromEntries(pending.map((item) => [item.id, String(item.quantity - item.receivedQty)])));
    }
    setOpen(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const payloadItems = pending
      .map((item) => ({ itemId: item.id, receivedQty: Number(quantities[item.id] || 0) }))
      .filter((i) => i.receivedQty > 0);
    if (payloadItems.length === 0) {
      toast.error("Informe ao menos uma quantidade a receber.");
      return;
    }
    setSaving(true);
    try {
      await api.receivePurchaseOrder(order.id, { items: payloadItems }, token);
      toast.success("Recebimento registrado — estoque atualizado.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar o recebimento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receber pedido {order.code}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          {pending.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_100px] items-end gap-3">
              <div>
                <Label>{item.inventoryPart.name}</Label>
                <p className="text-xs text-muted-foreground">
                  Pedido: {item.quantity} · Já recebido: {item.receivedQty} · Restante: {item.quantity - item.receivedQty}
                </p>
              </div>
              <Input
                type="number"
                min="0"
                max={item.quantity - item.receivedQty}
                value={quantities[item.id] ?? ""}
                onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))}
              />
            </div>
          ))}
          {pending.length === 0 && <p className="text-sm text-muted-foreground">Todos os itens já foram recebidos.</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving || pending.length === 0}>
              {saving ? "Registrando..." : "Confirmar recebimento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
