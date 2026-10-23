"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import type { Approval, ProblemPartUsage, VehiclePart } from "@/lib/types";
import styles from "./dashboard.module.css";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * "Peças do serviço": todas as peças lançadas nos problemas do projeto, com valor unitário,
 * quantidade e subtotal. O admin edita uma por uma (só neste projeto — o cadastro da peça
 * não muda); o total de peças e o do problema são recalculados no servidor.
 */
export default function ServicePartsPanel({
  approvals,
  parts,
  canViewPrices,
  canEdit,
  onUpdateUsage,
}: {
  approvals: Approval[];
  parts: VehiclePart[];
  canViewPrices: boolean;
  canEdit: boolean;
  onUpdateUsage: (approvalId: string, usageId: string, data: { unitCost: number; quantity: number }) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [unitCost, setUnitCost] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = approvals
    .filter((a) => a.status !== "REJECTED")
    .flatMap((approval) =>
      (approval.partUsages ?? []).map((usage) => ({
        approval,
        usage,
        problem: approval.partId ? parts.find((p) => p.id === approval.partId)?.name : undefined,
      }))
    );

  if (rows.length === 0) return null;

  const total = rows.reduce((sum, { usage }) => sum + (usage.unitCostSnapshot ?? 0) * usage.quantity, 0);

  function startEdit(usage: ProblemPartUsage) {
    setEditing(usage.id);
    setUnitCost(String(usage.unitCostSnapshot ?? 0));
    setQuantity(String(usage.quantity));
  }

  async function save(approvalId: string, usageId: string) {
    const cost = Number(unitCost);
    const qty = Math.floor(Number(quantity));
    if (!(cost >= 0) || unitCost.trim() === "") return toast.error("Informe o valor unitário da peça.");
    if (!(qty >= 1)) return toast.error("A quantidade precisa ser pelo menos 1.");
    setBusy(true);
    try {
      await onUpdateUsage(approvalId, usageId, { unitCost: cost, quantity: qty });
      setEditing(null);
      toast.success("Valor da peça atualizado.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar a peça.");
    } finally {
      setBusy(false);
    }
  }

  // Campos de edição — os mesmos na tabela (computador) e nos cartões (celular).
  const editFields = (approvalId: string, usageId: string) => (
    <div className="flex flex-wrap items-end gap-2">
      <label className="grid gap-1 text-xs text-muted-foreground">
        Qtd
        <input
          type="number"
          min="1"
          inputMode="numeric"
          className="h-9 w-16 rounded-md border bg-background px-2 text-base text-foreground sm:h-8 sm:text-sm"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Valor unit.
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          className="h-9 w-28 rounded-md border bg-background px-2 text-base text-foreground sm:h-8 sm:text-sm"
          autoFocus
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
        />
      </label>
      <span className="pb-2 text-sm text-muted-foreground">= {brl((Number(unitCost) || 0) * (Math.floor(Number(quantity)) || 0))}</span>
      <div className="flex gap-2">
        <button type="button" className={styles.btnApprove} disabled={busy} onClick={() => save(approvalId, usageId)}>
          {busy ? "Salvando..." : "Salvar"}
        </button>
        <button type="button" className={styles.btnReject} disabled={busy} onClick={() => setEditing(null)}>
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.panel}>
      <h2>Peças do serviço</h2>
      {/* Celular: um cartão por peça (a tabela não cabia e escondia o Subtotal/Editar). */}
      <div className="grid gap-2 sm:hidden">
        {rows.map(({ approval, usage, problem }) => (
          <div key={usage.id} className="rounded-md border p-2.5 text-sm">
            <div className="font-medium break-words">{usage.inventoryPart.name}</div>
            <div className="text-xs text-muted-foreground break-words">{problem ?? approval.title}</div>
            {editing === usage.id ? (
              <div className="mt-2">{editFields(approval.id, usage.id)}</div>
            ) : (
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                <span>
                  {usage.quantity}x
                  {canViewPrices && (
                    <>
                      {" "}
                      {brl(usage.unitCostSnapshot ?? 0)} = <strong>{brl((usage.unitCostSnapshot ?? 0) * usage.quantity)}</strong>
                    </>
                  )}
                </span>
                {canEdit && (
                  <button type="button" className={styles.actionButton} onClick={() => startEdit(usage)}>
                    Editar
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="hidden min-w-0 overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-2 font-medium">Peça</th>
              <th className="py-1.5 pr-2 font-medium">Problema</th>
              <th className="py-1.5 pr-2 font-medium">Qtd</th>
              {canViewPrices && <th className="py-1.5 pr-2 font-medium">Valor unit.</th>}
              {canViewPrices && <th className="py-1.5 pr-2 font-medium">Subtotal</th>}
              {canEdit && <th className="py-1.5" />}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ approval, usage, problem }) =>
              editing === usage.id ? (
                <tr key={usage.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 font-medium">{usage.inventoryPart.name}</td>
                  <td className="py-1.5" colSpan={canEdit ? 5 : 4}>
                    {editFields(approval.id, usage.id)}
                  </td>
                </tr>
              ) : (
                <tr key={usage.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2 font-medium">{usage.inventoryPart.name}</td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{problem ?? approval.title}</td>
                  <td className="py-1.5 pr-2">{usage.quantity}</td>
                  {canViewPrices && <td className="py-1.5 pr-2">{brl(usage.unitCostSnapshot ?? 0)}</td>}
                  {canViewPrices && <td className="py-1.5 pr-2">{brl((usage.unitCostSnapshot ?? 0) * usage.quantity)}</td>}
                  {canEdit && (
                    <td className="py-1.5 text-right">
                      <button type="button" className={styles.actionButton} onClick={() => startEdit(usage)}>
                        Editar
                      </button>
                    </td>
                  )}
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
      {canViewPrices && (
        <div className="mt-2 text-right text-sm">
          Total em peças: <strong>{brl(total)}</strong>
        </div>
      )}
    </div>
  );
}
