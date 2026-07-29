"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, API_URL } from "@/lib/api";
import { InventoryPart } from "@/lib/types";
import styles from "./dashboard.module.css";

function photoUrl(url?: string | null) {
  if (!url) return "";
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

export default function AdminPartsPanel() {
  const { token } = useAuth();
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [form, setForm] = useState({ name: "", sku: "", description: "", unitCost: "", stockQty: "", photo: null as File | null });
  const [busy, setBusy] = useState(false);

  function loadParts() {
    if (!token) return;
    api.inventoryParts(token).then(({ parts }) => setParts(parts as InventoryPart[]));
  }

  useEffect(loadParts, [token]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      await api.saveInventoryPart(form, token);
      setForm({ name: "", sku: "", description: "", unitCost: "", stockQty: "", photo: null });
      loadParts();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>Catálogo e estoque de peças</div>
      <div className={styles.panel}>
        <form className={styles.formGrid} onSubmit={save}>
          <label>
            Peça
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </label>
          <label>
            SKU
            <input value={form.sku} onChange={(e) => setForm((prev) => ({ ...prev, sku: e.target.value }))} />
          </label>
          <label>
            Custo fixo
            <input type="number" min="0" step="0.01" value={form.unitCost} onChange={(e) => setForm((prev) => ({ ...prev, unitCost: e.target.value }))} required />
          </label>
          <label>
            Estoque
            <input type="number" min="0" value={form.stockQty} onChange={(e) => setForm((prev) => ({ ...prev, stockQty: e.target.value }))} required />
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
            {busy ? "Salvando..." : "Cadastrar peça"}
          </button>
        </form>
      </div>

      <div className={styles.queueGrid}>
        {parts.map((part) => (
          <div key={part.id} className={styles.queueCard}>
            {part.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.partThumb} src={photoUrl(part.photoUrl)} alt={part.name} />
            )}
            <h3>{part.name}</h3>
            <p>{part.description}</p>
            <div className={styles.partMeta}>
              <span>Estoque: {part.stockQty}</span>
              <span>Custo: R$ {part.unitCost.toFixed(2)}</span>
              {part.sku && <span>SKU: {part.sku}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
