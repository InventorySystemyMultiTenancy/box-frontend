"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { ExpenseClassifications } from "@/lib/types";
import { categoriesForGroup } from "@/lib/utils";

// "Grupos e categorias" (Contas a pagar): cadastro dos grupos de despesa e das categorias de
// cada grupo — as mesmas sugestões dos campos "Grupo despesa" e "Categoria" da conta a pagar.
// Renomear também atualiza as contas já lançadas; excluir só tira das sugestões.
export function ExpenseClassificationsDialog({ trigger }: { trigger: React.ReactNode }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newGroup, setNewGroup] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [editing, setEditing] = useState<{ kind: "group" | "category"; oldName: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: classifications } = useQuery({
    queryKey: ["expense-classifications"],
    queryFn: async () => (await api.expenseClassifications(token!)) as ExpenseClassifications,
    enabled: !!token && open,
  });

  const groups = classifications?.groups ?? [];
  const group = selectedGroup && groups.includes(selectedGroup) ? selectedGroup : groups[0] ?? null;
  const categories = group ? categoriesForGroup(classifications, group) : [];

  async function run(action: () => Promise<ExpenseClassifications>, success: string) {
    if (!token) return false;
    setBusy(true);
    try {
      queryClient.setQueryData(["expense-classifications"], await action());
      toast.success(success);
      return true;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newGroup.trim();
    if (!name) return;
    if (await run(() => api.createExpenseGroup(name, token!), "Grupo criado.")) {
      setNewGroup("");
      setSelectedGroup(name);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategory.trim();
    if (!group || !name) return;
    if (await run(() => api.createExpenseCategory(group, name, token!), "Categoria criada.")) setNewCategory("");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const name = editing.name.trim();
    if (!name || name === editing.oldName) {
      setEditing(null);
      return;
    }
    const ok =
      editing.kind === "group"
        ? await run(() => api.renameExpenseGroup(editing.oldName, name, token!), "Grupo renomeado.")
        : await run(() => api.renameExpenseCategory(group!, editing.oldName, name, token!), "Categoria renomeada.");
    if (ok) {
      if (editing.kind === "group") setSelectedGroup(name);
      setEditing(null);
    }
  }

  async function removeGroup(name: string) {
    if (!window.confirm(`Excluir o grupo "${name}" e as categorias dele? As contas já lançadas não mudam.`)) return;
    await run(() => api.deleteExpenseGroup(name, token!), "Grupo excluído.");
  }

  async function removeCategory(name: string) {
    if (!group || !window.confirm(`Excluir a categoria "${name}" do grupo "${group}"? As contas já lançadas não mudam.`)) return;
    await run(() => api.deleteExpenseCategory(group, name, token!), "Categoria excluída.");
  }

  function row(kind: "group" | "category", name: string, active: boolean, onSelect?: () => void) {
    if (editing?.kind === kind && editing.oldName === name) {
      return (
        <form key={name} onSubmit={saveEdit} className="flex items-center gap-1 py-1">
          <Input autoFocus className="h-8" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <Button type="submit" size="icon" variant="ghost" className="size-8 shrink-0" disabled={busy} aria-label="Salvar">
            <Check className="size-4" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => setEditing(null)} aria-label="Cancelar">
            <X className="size-4" />
          </Button>
        </form>
      );
    }
    return (
      <div key={name} className={`flex items-center gap-1 rounded-md px-2 py-1 ${active ? "bg-muted font-medium" : ""}`}>
        {onSelect ? (
          <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={onSelect} title={name}>
            {name}
          </button>
        ) : (
          <span className="min-w-0 flex-1 truncate" title={name}>{name}</span>
        )}
        <Button type="button" size="icon" variant="ghost" className="size-7 shrink-0" disabled={busy} onClick={() => setEditing({ kind, oldName: name, name })} aria-label={`Renomear ${name}`}>
          <Pencil className="size-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7 shrink-0 text-destructive"
          disabled={busy}
          onClick={() => (kind === "group" ? removeGroup(name) : removeCategory(name))}
          aria-label={`Excluir ${name}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setEditing(null); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Grupos e categorias de despesa</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Renomear também atualiza as contas a pagar já lançadas. Excluir só tira das opções — as contas já lançadas continuam como estão.
        </p>
        <div className="grid min-h-0 gap-4 overflow-y-auto overscroll-contain text-sm sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <h3 className="font-semibold">Grupos</h3>
            <form onSubmit={addGroup} className="flex gap-2">
              <Input className="h-8" placeholder="Novo grupo (ex.: DESPESAS FIXAS)" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
              <Button type="submit" size="sm" disabled={busy || !newGroup.trim()}>
                <Plus className="size-4" /> Adicionar
              </Button>
            </form>
            <div className="grid gap-0.5">
              {!classifications && <span className="text-muted-foreground">Carregando...</span>}
              {classifications && groups.length === 0 && <span className="text-muted-foreground">Nenhum grupo cadastrado.</span>}
              {groups.map((name) => row("group", name, name === group, () => { setSelectedGroup(name); setEditing(null); }))}
            </div>
          </div>
          <div className="grid content-start gap-2">
            <h3 className="font-semibold">{group ? <>Categorias de {group}</> : "Categorias"}</h3>
            {group ? (
              <>
                <form onSubmit={addCategory} className="flex gap-2">
                  <Input className="h-8" placeholder="Nova categoria (ex.: ALUGUEL)" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                  <Button type="submit" size="sm" disabled={busy || !newCategory.trim()}>
                    <Plus className="size-4" /> Adicionar
                  </Button>
                </form>
                <div className="grid gap-0.5">
                  {categories.length === 0 && <span className="text-muted-foreground">Nenhuma categoria neste grupo.</span>}
                  {categories.map((name) => row("category", name, false))}
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">Crie um grupo para cadastrar categorias.</span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
