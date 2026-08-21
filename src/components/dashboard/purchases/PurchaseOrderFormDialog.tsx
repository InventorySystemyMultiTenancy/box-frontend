"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Supplier, InventoryPart } from "@/lib/types";

interface ItemRow {
  inventoryPartId: string;
  quantity: string;
  unitCost: string;
}

const EMPTY_ROW: ItemRow = { inventoryPartId: "", quantity: "1", unitCost: "" };

interface PurchaseOrderFormDialogProps {
  trigger: React.ReactNode;
  onSaved: () => void;
  defaultSupplierId?: string;
  defaultItems?: { inventoryPartId: string; quantity: number; unitCost: number }[];
}

export function PurchaseOrderFormDialog({ trigger, onSaved, defaultSupplierId, defaultItems }: PurchaseOrderFormDialogProps) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplierId, setSupplierId] = useState(defaultSupplierId ?? "");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemRow[]>(
    defaultItems?.length
      ? defaultItems.map((i) => ({ inventoryPartId: i.inventoryPartId, quantity: String(i.quantity), unitCost: String(i.unitCost) }))
      : [EMPTY_ROW]
  );

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-all"],
    queryFn: async () => (await api.suppliers(token!, { pageSize: 100 })).items as Supplier[],
    enabled: !!token && open,
  });

  const { data: parts } = useQuery({
    queryKey: ["inventory-parts"],
    queryFn: async () => (await api.inventoryParts(token!)).parts as InventoryPart[],
    enabled: !!token && open,
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      setSupplierId(defaultSupplierId ?? "");
      setExpectedDate("");
      setNotes("");
      setItems(
        defaultItems?.length
          ? defaultItems.map((i) => ({ inventoryPartId: i.inventoryPartId, quantity: String(i.quantity), unitCost: String(i.unitCost) }))
          : [EMPTY_ROW]
      );
    }
    setOpen(next);
  }

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setItems((rows) => [...rows, EMPTY_ROW]);
  }

  function removeRow(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
  }

  function onSelectPart(index: number, partId: string) {
    const part = parts?.find((p) => p.id === partId);
    updateItem(index, { inventoryPartId: partId, unitCost: part ? String(part.unitCost) : "" });
  }

  const total = items.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitCost) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !supplierId) return;
    const validItems = items
      .filter((row) => row.inventoryPartId && Number(row.quantity) > 0)
      .map((row) => ({ inventoryPartId: row.inventoryPartId, quantity: Number(row.quantity), unitCost: Number(row.unitCost) || 0 }));
    if (validItems.length === 0) {
      toast.error("Adicione ao menos um item válido.");
      return;
    }
    setSaving(true);
    try {
      await api.createPurchaseOrder(
        { supplierId, expectedDate: expectedDate || undefined, notes: notes || undefined, items: validItems },
        token
      );
      toast.success("Pedido de compra criado.");
      setOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar o pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo pedido de compra</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Fornecedor *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(suppliers ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="expectedDate">Previsão de entrega</Label>
              <Input id="expectedDate" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Itens</Label>
            {items.map((row, index) => (
              <div key={index} className="flex items-end gap-2">
                <div className="grid flex-1 gap-1.5">
                  <Select value={row.inventoryPartId} onValueChange={(v) => onSelectPart(index, v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Peça..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(parts ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} {p.sku ? `(${p.sku})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid w-20 gap-1.5">
                  <Input
                    type="number"
                    min="1"
                    placeholder="Qtd"
                    value={row.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  />
                </div>
                <div className="grid w-28 gap-1.5">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Custo un."
                    value={row.unitCost}
                    onChange={(e) => updateItem(index, { unitCost: e.target.value })}
                  />
                </div>
                <Button type="button" variant="outline" size="icon" onClick={() => removeRow(index)} disabled={items.length === 1}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addRow}>
              <Plus className="size-4" />
              Adicionar item
            </Button>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <p className="text-sm text-muted-foreground">
            Total estimado: <strong className="text-foreground">R$ {total.toFixed(2)}</strong>
          </p>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Criar pedido"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
