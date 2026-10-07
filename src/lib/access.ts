// Acesso por cargo à aba Relatórios e à aba Alertas — espelha REPORT_SECTIONS / ALERT_TYPES
// do backend (src/lib/report-access.ts). Mudar aqui exige mudar lá também.

export const REPORT_SECTIONS = [
  { key: "indicators", label: "Indicadores gerais (faturamento, ticket, aprovação, aceite)" },
  { key: "productivity", label: "Produtividade por mecânico" },
  { key: "revision", label: "Revisão preventiva" },
  { key: "parts", label: "Peças mais usadas" },
  { key: "financial", label: "PDF financeiro do período" },
] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number]["key"];

export const ALERT_TYPE_OPTIONS = [
  { key: "STALE_STATUS", label: "Veículo parado sem mudar de etapa", group: "Veículos" },
  { key: "DELIVERY_TOMORROW", label: "Entrega prevista para amanhã", group: "Veículos" },
  { key: "SUPPLEMENT_PENDING", label: "Complemento pendente de aprovação", group: "Financeiro" },
  { key: "PAYABLE_OVERDUE", label: "Conta a pagar vencida", group: "Financeiro" },
  { key: "INSPECTION_TODAY", label: "Vistoria marcada para hoje", group: "Agenda" },
  { key: "REVISION_REMINDER", label: "Lembrete de revisão preventiva", group: "Lembretes p/ clientes" },
  { key: "WARRANTY_REMINDER", label: "Lembrete de garantia vencendo", group: "Lembretes p/ clientes" },
] as const;
export type AlertTypeKey = (typeof ALERT_TYPE_OPTIONS)[number]["key"];

/** null = sem restrição (cargo sem configuração ou usuário sem cargo). */
export interface ReportAccess {
  sections: ReportSection[] | null;
  sectors: string[] | null;
  alertTypes: AlertTypeKey[] | null;
}

export const FULL_ACCESS: ReportAccess = { sections: null, sectors: null, alertTypes: null };

export function canSeeSection(access: ReportAccess, section: ReportSection) {
  return access.sections === null || access.sections.includes(section);
}

export function canSeeAlertType(access: ReportAccess, type: string) {
  return access.alertTypes === null || (access.alertTypes as string[]).includes(type);
}
