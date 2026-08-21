"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Store } from "@/lib/types";

export default function LojasPage() {
  const { user, token, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const allowed = hasPermission("stores", "view");
  const canManage = hasPermission("stores", "manage");

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  const { data: stores, isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => (await api.stores(token!)).stores as Store[],
    enabled: !!token && allowed,
  });

  if (!allowed) return null;

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["stores"] });
  }

  async function handleArchive(store: Store) {
    if (!token || !confirm(`Arquivar a loja "${store.name}"?`)) return;
    try {
      await api.archiveStore(store.id, token);
      toast.success("Loja arquivada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível arquivar a loja.");
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lojas</h1>
          <p className="text-sm text-muted-foreground">
            Unidades/filiais. Estoque, OS, boxes, pedidos de compra e vendas de balcão podem ser atribuídos a uma loja — clientes e
            usuários continuam compartilhados entre todas.
          </p>
        </div>
        {canManage && <StoreFormDialog onSaved={refetch} trigger={<Button><Plus className="size-4" />Nova loja</Button>} />}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (stores ?? []).length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhuma loja cadastrada.</TableCell></TableRow>
            )}
            {(stores ?? []).map((store) => (
              <TableRow key={store.id}>
                <TableCell className="font-medium">{store.name}</TableCell>
                <TableCell className="text-muted-foreground">{store.city ? `${store.city}${store.state ? `/${store.state}` : ""}` : "—"}</TableCell>
                <TableCell className="text-muted-foreground">{store.phone || "—"}</TableCell>
                <TableCell>
                  {canManage && (
                    <Trash2 className="size-4 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => handleArchive(store)} />
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

function StoreFormDialog({ trigger, onSaved }: { trigger: React.ReactNode; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", addressLine: "", city: "", state: "", phone: "" });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !form.name.trim()) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      await api.createStore(payload, token);
      toast.success("Loja criada.");
      setOpen(false);
      setForm({ name: "", addressLine: "", city: "", state: "", phone: "" });
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar a loja.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova loja</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="store-name">Nome *</Label>
            <Input id="store-name" required value={form.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="store-address">Endereço</Label>
            <Input id="store-address" value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="store-city">Cidade</Label>
              <Input id="store-city" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="store-state">Estado</Label>
              <Input id="store-state" value={form.state} onChange={(e) => set("state", e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="store-phone">Telefone</Label>
            <Input id="store-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar loja"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
