"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { projectValues } from "@/lib/order-values";
import { PART_STATUS_LABELS, type Approval, type VehiclePart } from "@/lib/types";
import styles from "./dashboard.module.css";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * "Valores do projeto": cada problema com mão de obra, peças e total, e o valor final —
 * exatamente o que entra no PDF do serviço (o quadro "Peças do serviço" mostra só peças).
 * Admin corrige a mão de obra de qualquer problema aqui; o valor das peças, em "Peças do serviço".
 */
export default function ProjectValuesPanel({
  approvals,
  parts,
  estimatedMin,
  deliveryExtraValue,
  onUpdateLabor,
}: {
  approvals: Approval[];
  parts: VehiclePart[];
  estimatedMin?: number | null;
  deliveryExtraValue?: number | null;
  onUpdateLabor?: (approvalId: string, laborValue: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const values = projectValues({ approvals, estimatedMin, deliveryExtraValue });
  if (values.rows.length === 0 && !values.total) return null;

  async function saveLabor(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || !onUpdateLabor) return;
    const value = Number(editing.value.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Informe um valor de mão de obra válido.");
      return;
    }
    setSaving(true);
    try {
      await onUpdateLabor(editing.id, value);
      toast.success("Mão de obra atualizada.");
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar a mão de obra.");
    } finally {
      setSaving(false);
    }
  }

  function statusLabel(approval: Approval) {
    if (approval.status === "REJECTED") return "Recusado — não soma";
    const part = approval.partId ? parts.find((p) => p.id === approval.partId) : undefined;
    if (part) return PART_STATUS_LABELS[part.status];
    return approval.status === "APPROVED" ? "Aprovado" : "Pendente";
  }

  return (
    <div className={styles.panel}>
      <h2>Valores do projeto</h2>
      <div className="grid gap-2 text-sm">
        {values.rows.map(({ approval, labor, parts: partsValue, total, counts }) => (
          <div key={approval.id} className={`rounded-md border p-2.5 ${counts ? "" : "opacity-60"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="min-w-0 break-words font-medium">{approval.description}</span>
              <strong className={counts ? "" : "line-through"}>{brl(total)}</strong>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span>{statusLabel(approval)}</span>
              <span>Mão de obra: {brl(labor)}</span>
              <span>Peças: {brl(partsValue)}</span>
              {onUpdateLabor && editing?.id !== approval.id && (
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  // Problema antigo sem mão de obra separada: parte do total que não é peça.
                  onClick={() => setEditing({ id: approval.id, value: String(approval.laborValue ?? Math.max(0, total - partsValue)) })}
                >
                  Editar mão de obra
                </button>
              )}
            </div>
            {editing?.id === approval.id && (
              <form onSubmit={saveLabor} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <label htmlFor={`labor-${approval.id}`}>Mão de obra (R$)</label>
                <input
                  id={`labor-${approval.id}`}
                  type="number"
                  min="0"
                  step="0.01"
                  autoFocus
                  className="h-8 w-32 rounded-md border bg-transparent px-2"
                  value={editing.value}
                  onChange={(e) => setEditing({ id: approval.id, value: e.target.value })}
                />
                <button type="submit" className={styles.actionButton} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
                <button type="button" className="text-muted-foreground hover:underline" disabled={saving} onClick={() => setEditing(null)}>
                  Cancelar
                </button>
              </form>
            )}
          </div>
        ))}
        {onUpdateLabor && (
          <p className="text-xs text-muted-foreground">O valor das peças de cada problema é alterado no quadro &ldquo;Peças do serviço&rdquo;.</p>
        )}
        <div className="mt-1 grid gap-0.5 text-right">
          {values.rows.length > 0 && (
            <>
              <span className="text-muted-foreground">Mão de obra: {brl(values.laborTotal)}</span>
              <span className="text-muted-foreground">Peças: {brl(values.partsTotal)}</span>
            </>
          )}
          {values.estimate > 0 && <span className="text-muted-foreground">Valor estimado na abertura: {brl(values.estimate)}</span>}
          {values.extra > 0 && <span className="text-muted-foreground">Valor extra na entrega: {brl(values.extra)}</span>}
          <span>
            Valor final (igual ao PDF): <strong>{brl(values.total)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
