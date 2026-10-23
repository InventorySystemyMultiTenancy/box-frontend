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

  return (
    <div className={styles.panel}>
      <h2>Peças do serviço</h2>
      <div className="min-w-0 overflow-x-auto">
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
                  <td className="py-1.5 pr-2 text-muted-foreground">{problem ?? approval.title}</td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min="1"
                      className="h-8 w-16 rounded-md border bg-background px-2"
                      aria-label="Quantidade"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-8 w-24 rounded-md border bg-background px-2"
                      aria-label="Valor unitário"
                      autoFocus
                      value={unitCost}
                      onChange={(e) => setUnitCost(e.target.value)}
                    />
                  </td>
                  <td className="py-1.5 pr-2 text-muted-foreground">{brl((Number(unitCost) || 0) * (Math.floor(Number(quantity)) || 0))}</td>
                  <td className="py-1.5 text-right whitespace-nowrap">
                    <button type="button" className={styles.btnApprove} disabled={busy} onClick={() => save(approval.id, usage.id)}>
                      {busy ? "Salvando..." : "Salvar"}
                    </button>{" "}
                    <button type="button" className={styles.btnReject} disabled={busy} onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
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
