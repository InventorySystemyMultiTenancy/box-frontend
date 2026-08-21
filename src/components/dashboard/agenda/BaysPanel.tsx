"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Bay, BayType } from "@/lib/types";

export default function BaysPanel() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission("agenda", "manage");

  const { data: bays, isLoading } = useQuery({
    queryKey: ["bays"],
    queryFn: async () => (await api.bays(token!)).bays as Bay[],
    enabled: !!token,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["bays"] });
  }

  async function handleArchive(bay: Bay) {
    if (!token || !confirm(`Arquivar "${bay.name}"?`)) return;
    try {
      await api.archiveBay(bay.id, token);
      toast.success("Box/elevador arquivado.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível arquivar.");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        {canManage && <BayFormDialog onSaved={refetch} trigger={<Button size="sm"><Plus className="size-4" />Novo box/elevador</Button>} />}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && (bays ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum box/elevador cadastrado.</p>}
        {(bays ?? []).map((bay) => (
          <div key={bay.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
            <div>
              <p className="font-medium">{bay.name}</p>
              <Badge variant="outline">{bay.type === "LIFT" ? "Elevador" : "Box"}</Badge>
            </div>
            {canManage && (
              <Trash2 className="size-4 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => handleArchive(bay)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BayFormDialog({ trigger, onSaved }: { trigger: React.ReactNode; onSaved: () => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<BayType>("BAY");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setSaving(true);
    try {
      await api.createBay({ name, type }, token);
      toast.success("Box/elevador criado.");
      setOpen(false);
      setName("");
      setType("BAY");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo box/elevador</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="bay-name">Nome *</Label>
            <Input id="bay-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Elevador 1" />
          </div>
          <div className="grid gap-1.5">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as BayType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BAY">Box</SelectItem>
                <SelectItem value="LIFT">Elevador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
