// Identificador estável de cada aba da navegação — usado por Role.allowedTabs (aba
// Cargos) pra restringir quais abas um cargo específico pode ver. Compartilhado entre
// dashboard/layout.tsx (monta a navegação) e cargos/page.tsx (monta o checklist).
export const TAB_KEYS = [
  "projects",
  "requests",
  "users",
  "parts",
  "finance",
  "clients",
  "addons",
  "expenses",
  "alerts",
  "trucks",
  "insurance",
  "suppliers",
  "purchases",
  "agenda",
  "pdv",
  "warranties",
  "reports",
  "commissions",
  "stores",
  "roles",
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

export const TAB_LABELS: Record<TabKey, string> = {
  projects: "Projetos",
  requests: "Solicitações",
  users: "Usuários",
  parts: "Peças",
  finance: "Financeiro",
  clients: "Clientes",
  addons: "Complementos",
  expenses: "Gastos",
  alerts: "Alertas",
  trucks: "Caminhões",
  insurance: "Seguradoras",
  suppliers: "Fornecedores",
  purchases: "Compras",
  agenda: "Agenda",
  pdv: "PDV",
  warranties: "Garantias",
  reports: "Relatórios",
  commissions: "Comissões",
  stores: "Lojas",
  roles: "Cargos",
};
