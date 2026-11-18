// Abas do painel por chave (Role.allowedTabs), na mesma ordem da navegação
// (app/dashboard/layout.tsx). Usado para mandar quem tem cargo restrito DIRETO para a
// aba dele ao entrar — sem baixar e montar a tela de Serviços que ele nem pode ver.
const TAB_HREFS: [key: string, href: string][] = [
  ["projects", "/dashboard"],
  ["requests", "/dashboard/solicitacoes"],
  ["users", "/dashboard/usuarios"],
  ["parts", "/dashboard/pecas"],
  ["finance", "/dashboard/financeiro"],
  ["clients", "/dashboard/clientes"],
  ["expenses", "/dashboard/gastos"],
  ["alerts", "/dashboard/alertas"],
  ["trucks", "/dashboard/caminhoes"],
  ["insurance", "/dashboard/seguradoras"],
  ["suppliers", "/dashboard/fornecedores"],
  ["purchases", "/dashboard/compras"],
  ["agenda", "/dashboard/agenda"],
  ["pdv", "/dashboard/pdv"],
  ["warranties", "/dashboard/garantias"],
  ["reports", "/dashboard/relatorios"],
  ["commissions", "/dashboard/comissoes"],
  ["stores", "/dashboard/lojas"],
  ["roles", "/dashboard/cargos"],
];

/** Primeira tela do painel para este cargo (sem restrição de abas = Serviços). */
export function dashboardHomePath(allowedTabs: string[]): string {
  if (allowedTabs.length === 0 || allowedTabs.includes("projects")) return "/dashboard";
  return TAB_HREFS.find(([key]) => allowedTabs.includes(key))?.[1] ?? "/dashboard";
}
