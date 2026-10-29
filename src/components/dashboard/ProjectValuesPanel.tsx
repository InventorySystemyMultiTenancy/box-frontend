"use client";

import { projectValues } from "@/lib/order-values";
import { PART_STATUS_LABELS, type Approval, type VehiclePart } from "@/lib/types";
import styles from "./dashboard.module.css";

const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * "Valores do projeto": cada problema com mão de obra, peças e total, e o valor final —
 * exatamente o que entra no PDF do serviço (o quadro "Peças do serviço" mostra só peças).
 */
export default function ProjectValuesPanel({
  approvals,
  parts,
  estimatedMin,
  deliveryExtraValue,
}: {
  approvals: Approval[];
  parts: VehiclePart[];
  estimatedMin?: number | null;
  deliveryExtraValue?: number | null;
}) {
  const values = projectValues({ approvals, estimatedMin, deliveryExtraValue });
  if (values.rows.length === 0 && !values.total) return null;

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
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <span>{statusLabel(approval)}</span>
              <span>Mão de obra: {brl(labor)}</span>
              <span>Peças: {brl(partsValue)}</span>
            </div>
          </div>
        ))}
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
