import type { Approval } from "@/lib/types";

// Valores do projeto — a mesma conta do PDF ("Gerar PDF do serviço") e do quadro "Valores
// do projeto" na tela. Problema recusado pelo cliente aparece, mas não soma no total.
// Sem nenhum valor lançado, vale o estimado da abertura. Mesma regra do backend
// (projectValues em service-order-report.service.ts).
export function projectValues(order: { approvals: Approval[]; estimatedMin?: number | null; deliveryExtraValue?: number | null }) {
  const rows = order.approvals.map((approval) => ({
    approval,
    labor: approval.laborValue ?? 0,
    parts: approval.partsValue ?? 0,
    total: approval.estimatedValue ?? 0,
    counts: approval.status !== "REJECTED",
  }));
  const counted = rows.filter((row) => row.counts);
  const laborTotal = counted.reduce((sum, row) => sum + row.labor, 0);
  const partsTotal = counted.reduce((sum, row) => sum + row.parts, 0);
  const problemsTotal = counted.reduce((sum, row) => sum + row.total, 0);
  const estimate = problemsTotal ? 0 : order.estimatedMin ?? 0;
  const extra = order.deliveryExtraValue ?? 0;
  return { rows, laborTotal, partsTotal, problemsTotal, estimate, extra, total: (problemsTotal || estimate) + extra };
}
