"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Role, Permission } from "@/lib/types";

const RESOURCE_LABELS: Record<string, string> = {
  clients: "Clientes",
  roles: "Cargos e permissões",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Visualizar",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
  manage: "Gerenciar",
};

export default function CargosPage() {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  // Edições locais (não salvas) do cargo selecionado. null = ainda não mexeu,
  // usa o que veio do servidor. Evita sincronizar estado do servidor via effect.
  const [localChecked, setLocalChecked] = useState<Set<string> | null>(null);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await api.roles(token!)).roles as Role[],
    enabled: !!token,
  });

  const { data: catalog } = useQuery({
    queryKey: ["permission-catalog"],
    queryFn: async () => (await api.permissionCatalog(token!)).permissions as Permission[],
    enabled: !!token,
  });

  const { data: rolePermissions } = useQuery({
    queryKey: ["role-permissions", selectedRoleId],
    queryFn: async () => (await api.rolePermissions(selectedRoleId!, token!)).permissions as Permission[],
    enabled: !!token && !!selectedRoleId,
  });

  const serverChecked = useMemo(() => new Set((rolePermissions ?? []).map((p) => p.id)), [rolePermissions]);
  const checked = localChecked ?? serverChecked;

  const selectedRole = useMemo(() => roles?.find((r) => r.id === selectedRoleId) ?? null, [roles, selectedRoleId]);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of catalog ?? []) {
      const list = map.get(p.resource) ?? [];
      list.push(p);
      map.set(p.resource, list);
    }
    return map;
  }, [catalog]);

  function refetchRoles() {
    queryClient.invalidateQueries({ queryKey: ["roles"] });
  }

  async function handleCreateRole(name: string, description: string) {
    if (!token) return;
    try {
      await api.createRole({ name, description: description || undefined }, token);
      toast.success("Cargo criado.");
      refetchRoles();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar o cargo.");
    }
  }

  async function handleDeleteRole(role: Role) {
    if (!token || !confirm(`Excluir o cargo "${role.name}"?`)) return;
    try {
      await api.deleteRole(role.id, token);
      toast.success("Cargo excluído.");
      if (selectedRoleId === role.id) setSelectedRoleId(null);
      refetchRoles();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o cargo.");
    }
  }

  function toggle(permissionId: string) {
    const next = new Set(checked);
    if (next.has(permissionId)) next.delete(permissionId);
    else next.add(permissionId);
    setLocalChecked(next);
  }

  async function handleSavePermissions() {
    if (!token || !selectedRoleId) return;
    setSavingPermissions(true);
    try {
      await api.setRolePermissions(selectedRoleId, Array.from(checked), token);
      toast.success("Permissões atualizadas.");
      setLocalChecked(null);
      queryClient.invalidateQueries({ queryKey: ["role-permissions", selectedRoleId] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar as permissões.");
    } finally {
      setSavingPermissions(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Cargos e permissões</h1>
          <p className="text-sm text-muted-foreground">Crie cargos e defina o que cada um pode ver, criar, editar ou excluir.</p>
        </div>
        <CreateRoleDialog onCreate={handleCreateRole} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[240px_1fr]">
        <div className="grid gap-2">
          {(roles ?? []).map((role) => (
            <button
              key={role.id}
              onClick={() => {
                setSelectedRoleId(role.id);
                setLocalChecked(null);
              }}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                selectedRoleId === role.id ? "border-primary bg-accent" : "hover:bg-accent"
              }`}
            >
              <span>
                {role.name}
                {role.isSystem && (
                  <Badge variant="secondary" className="ml-2">
                    Sistema
                  </Badge>
                )}
              </span>
              {!role.isSystem && (role._count?.users ?? 0) === 0 && (
                <Trash2
                  className="size-4 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRole(role);
                  }}
                />
              )}
            </button>
          ))}
          {roles?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cargo cadastrado.</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{selectedRole ? `Permissões de ${selectedRole.name}` : "Selecione um cargo"}</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedRole && <p className="text-sm text-muted-foreground">Escolha um cargo à esquerda para configurar suas permissões.</p>}
            {selectedRole && (
              <div className="grid gap-4">
                {Array.from(grouped.entries()).map(([resource, perms]) => (
                  <div key={resource}>
                    <p className="mb-2 text-sm font-medium">{RESOURCE_LABELS[resource] ?? resource}</p>
                    <div className="flex flex-wrap gap-4">
                      {perms.map((p) => (
                        <label key={p.id} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={checked.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                          {ACTION_LABELS[p.action] ?? p.action}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <Button className="w-fit" onClick={handleSavePermissions} disabled={savingPermissions}>
                  {savingPermissions ? "Salvando..." : "Salvar permissões"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function CreateRoleDialog({ onCreate }: { onCreate: (name: string, description: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name, description);
    setSaving(false);
    setOpen(false);
    setName("");
    setDescription("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Novo cargo
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo cargo</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="role-name">Nome</Label>
            <Input id="role-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Financeiro" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="role-description">Descrição</Label>
            <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Criando..." : "Criar cargo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
