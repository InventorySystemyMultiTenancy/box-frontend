"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Client, CounterSale, InventoryPart, Store } from "@/lib/types";

interface ItemRow {
  inventoryPartId: string;
  quantity: string;
  unitPrice: string;
}

const EMPTY_ROW: ItemRow = { inventoryPartId: "", quantity: "1", unitPrice: "" };

export default function PdvPage() {
  const { user, token, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const allowed = hasPermission("pdv", "view");

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  const canManage = hasPermission("pdv", "manage");
  const [clientId, setClientId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [storeId, setStoreId] = useState("");
  const [items, setItems] = useState<ItemRow[]>([EMPTY_ROW]);
  const [saving, setSaving] = useState(false);

  const { data: stores } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await api.stores(token!)).stores as Store[],
    enabled: !!token,
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-all"],
    queryFn: async () => (await api.clients(token!, { pageSize: 100 })).items as Client[],
    enabled: !!token,
  });

  const { data: parts } = useQuery({
    queryKey: ["inventory-parts"],
    queryFn: async () => (await api.inventoryParts(token!)).parts as InventoryPart[],
    enabled: !!token,
  });

  const { data: sales, isLoading } = useQuery({
    queryKey: ["counter-sales"],
    queryFn: async () => (await api.counterSales(token!, { pageSize: 20 })).items as CounterSale[],
    enabled: !!token,
  });

  if (!allowed) return null;

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function onSelectPart(index: number, partId: string) {
    const part = parts?.find((p) => p.id === partId);
    updateItem(index, { inventoryPartId: partId, unitPrice: part ? String(part.unitCost) : "" });
  }

  function addRow() {
    setItems((rows) => [...rows, EMPTY_ROW]);
  }

  function removeRow(index: number) {
    setItems((rows) => rows.filter((_, i) => i !== index));
  }

  function resetForm() {
    setClientId("");
    setCustomerName("");
    setPaymentMethod("");
    setStoreId("");
    setItems([EMPTY_ROW]);
  }

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["counter-sales"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-parts"] });
  }

  const total = items.reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    const validItems = items
      .filter((row) => row.inventoryPartId && Number(row.quantity) > 0)
      .map((row) => ({ inventoryPartId: row.inventoryPartId, quantity: Number(row.quantity), unitPrice: Number(row.unitPrice) || 0 }));
    if (validItems.length === 0) {
      toast.error("Adicione ao menos um item válido.");
      return;
    }
    setSaving(true);
    try {
      await api.createCounterSale(
        {
          clientId: clientId || undefined,
          customerName: customerName || undefined,
          paymentMethod: paymentMethod || undefined,
          storeId: storeId || undefined,
          items: validItems,
        },
        token
      );
      toast.success("Venda registrada.");
      resetForm();
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível registrar a venda.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(sale: CounterSale) {
    if (!token || !confirm(`Cancelar a venda ${sale.code}?`)) return;
    try {
      await api.cancelCounterSale(sale.id, token);
      toast.success("Venda cancelada — estoque estornado.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível cancelar a venda.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">PDV — Venda de balcão</h1>
        <p className="text-sm text-muted-foreground">Venda avulsa de peças, sem ordem de serviço vinculada.</p>
      </div>

      {canManage && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Nova venda</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Cliente cadastrado</Label>
                  <Select value={clientId || "NONE"} onValueChange={(v) => setClientId(v === "NONE" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">—</SelectItem>
                      {(clients ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pdv-customer">Ou nome do cliente (sem cadastro)</Label>
                  <Input id="pdv-customer" value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={!!clientId} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Itens</Label>
                {items.map((row, index) => (
                  <div key={index} className="flex flex-wrap items-end gap-2">
                    <div className="grid min-w-40 flex-1 gap-1.5">
                      <Select value={row.inventoryPartId} onValueChange={(v) => onSelectPart(index, v)}>
                        <SelectTrigger><SelectValue placeholder="Peça..." /></SelectTrigger>
                        <SelectContent>
                          {(parts ?? []).filter((p) => p.active).map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name} (estoque: {p.stockQty})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid w-20 gap-1.5">
                      <Input type="number" min="1" placeholder="Qtd" value={row.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} />
                    </div>
                    <div className="grid w-24 gap-1.5 sm:w-28">
                      <Input type="number" min="0" step="0.01" placeholder="Preço un." value={row.unitPrice} onChange={(e) => updateItem(index, { unitPrice: e.target.value })} />
                    </div>
                    <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => removeRow(index)} disabled={items.length === 1}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addRow}>
                  <Plus className="size-4" />
                  Adicionar item
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:max-w-md sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="pdv-payment">Forma de pagamento</Label>
                  <Input id="pdv-payment" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="PIX" />
                </div>
                {stores && stores.length > 0 && (
                  <div className="grid gap-1.5">
                    <Label>Loja</Label>
                    <Select value={storeId || "NONE"} onValueChange={(v) => setStoreId(v === "NONE" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Sem loja" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">—</SelectItem>
                        {stores.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <p className="text-sm text-muted-foreground">
                  Total: <strong className="text-foreground">R$ {total.toFixed(2)}</strong>
                </p>
                <Button type="submit" disabled={saving}>
                  {saving ? "Registrando..." : "Finalizar venda"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (sales ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma venda registrada.</TableCell></TableRow>
            )}
            {(sales ?? []).map((sale) => (
              <TableRow key={sale.id}>
                <TableCell className="font-medium">{sale.code}</TableCell>
                <TableCell className="text-muted-foreground">{sale.client?.name || sale.customerName || "—"}</TableCell>
                <TableCell>R$ {sale.totalAmount.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant={sale.status === "COMPLETED" ? "default" : "secondary"}>
                    {sale.status === "COMPLETED" ? "Concluída" : "Cancelada"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(sale.createdAt).toLocaleString("pt-BR")}</TableCell>
                <TableCell>
                  {canManage && sale.status === "COMPLETED" && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(sale)}>
                      Cancelar
                    </Button>
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
