"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, API_URL, ApiError } from "@/lib/api";
import { InventoryPart, Supplier } from "@/lib/types";
import { matchesSearch } from "@/lib/utils";
import { PurchaseOrderFormDialog } from "@/components/dashboard/purchases/PurchaseOrderFormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import styles from "./dashboard.module.css";

function photoUrl(url?: string | null) {
  if (!url) return "";
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

const EMPTY_FORM = {
  name: "",
  sku: "",
  description: "",
  unitCost: "",
  preferredSupplierId: "",
  photo: null as File | null,
};

// Catálogo de peças: só nome + preço (e dados de apoio). Não há controle de estoque — a
// peça pode ser usada em qualquer projeto ou vendida no PDV quantas vezes for preciso.
export default function AdminPartsPanel() {
  const { token } = useAuth();
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-all"],
    queryFn: async () => (await api.suppliers(token!, { pageSize: 100 })).items as Supplier[],
    enabled: !!token,
  });

  function loadParts() {
    if (!token) return;
    api.inventoryParts(token).then(({ parts }) => setParts(parts as InventoryPart[]));
  }

  useEffect(loadParts, [token]);

  function startEdit(part: InventoryPart) {
    setEditingId(part.id);
    setForm({
      name: part.name,
      sku: part.sku ?? "",
      description: part.description ?? "",
      unitCost: String(part.unitCost ?? ""),
      preferredSupplierId: part.preferredSupplierId ?? "",
      photo: null,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      await api.saveInventoryPart({ ...form, id: editingId ?? undefined, preferredSupplierId: form.preferredSupplierId || undefined }, token);
      toast.success(editingId ? "Peça atualizada." : "Peça cadastrada.");
      cancelEdit();
      loadParts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a peça.");
    } finally {
      setBusy(false);
    }
  }

  // Desativar tira a peça das listas de escolha (projeto/PDV) sem apagar o histórico de uso.
  async function toggleActive(part: InventoryPart) {
    if (!token) return;
    try {
      await api.saveInventoryPart({ id: part.id, name: part.name, unitCost: String(part.unitCost), active: !part.active }, token);
      loadParts();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível alterar a peça.");
    }
  }

  const visibleParts = parts.filter((p) => matchesSearch(search, [p.name, p.sku, p.description]));

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>{editingId ? "Editar peça" : "Cadastro de peças"}</div>
      <div className={styles.panel}>
        <form className={styles.formGrid} onSubmit={save}>
          <label>
            Peça
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label>
            Preço (R$)
            <input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm((prev) => ({ ...prev, unitCost: e.target.value }))} required />
          </label>
          <label>
            Código / SKU (opcional)
            <input value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} />
          </label>
          <label>
            Fornecedor preferencial (opcional)
            <select
              value={form.preferredSupplierId}
              onChange={(e) => setForm((prev) => ({ ...prev, preferredSupplierId: e.target.value }))}
            >
              <option value="">Nenhum</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.fullField}>
            Descrição
            <textarea value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
          </label>
          <label className={styles.fullField}>
            Foto opcional
            <input type="file" accept="image/*" onChange={(e) => setForm((prev) => ({ ...prev, photo: e.target.files?.[0] ?? null }))} />
          </label>
          <button className={styles.actionButton} disabled={busy}>
            {busy ? "Salvando..." : editingId ? "Salvar alterações" : "Cadastrar peça"}
          </button>
          {editingId && (
            <button type="button" className={styles.linkButton} onClick={cancelEdit}>
              Cancelar edição
            </button>
          )}
        </form>
      </div>

      <div className={styles.sectionTitle}>Peças cadastradas ({parts.length})</div>
      <Input
        placeholder="Buscar peça por nome, código ou descrição..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-3 max-w-sm"
      />
      <div className={styles.queueGrid}>
        {visibleParts.map((part) => (
          <div key={part.id} className={styles.queueCard} style={part.active ? undefined : { opacity: 0.55 }}>
            {part.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.partThumb} src={photoUrl(part.photoUrl)} alt={part.name} />
            )}
            <h3>
              {part.name}
              {!part.active && <span className={styles.tlSub}> · desativada</span>}
            </h3>
            <p>{part.description}</p>
            <div className={styles.partMeta}>
              <span>Preço: R$ {part.unitCost.toFixed(2)}</span>
              {part.sku && <span>Código: {part.sku}</span>}
            </div>
            <div className={styles.approvalActions} style={{ marginTop: "0.6rem" }}>
              <Button size="sm" variant="outline" onClick={() => startEdit(part)}>
                Editar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggleActive(part)}>
                {part.active ? "Desativar" : "Reativar"}
              </Button>
              <PurchaseOrderFormDialog
                onSaved={loadParts}
                defaultSupplierId={part.preferredSupplierId ?? undefined}
                defaultItems={[{ inventoryPartId: part.id, quantity: 1, unitCost: part.unitCost }]}
                trigger={
                  <Button size="sm" variant="ghost">
                    Comprar
                  </Button>
                }
              />
            </div>
          </div>
        ))}
        {visibleParts.length === 0 && <p className={styles.tlSub}>{parts.length === 0 ? "Nenhuma peça cadastrada ainda." : "Nenhuma peça encontrada."}</p>}
      </div>
    </div>
  );
}
