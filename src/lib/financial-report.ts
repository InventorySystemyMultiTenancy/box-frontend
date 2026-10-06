import { api } from "@/lib/api";
import { escapeHtml, formatCurrencyBRL, openPrintableReport } from "@/lib/printable-report";
import type { AccountPayable, AccountReceivable, CashFlow, DRE } from "@/lib/types";

// Relatório financeiro geral do período (aba Relatórios → "PDF financeiro do período"):
// resumo, DRE por categoria, despesas pagas por setor e por grupo, contas recebidas/pagas,
// lançamentos manuais e o que ficou em aberto com vencimento no período.

function date(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

function groupTotals<T>(rows: T[], key: (row: T) => string, amount: (row: T) => number) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + amount(row));
  return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}

function totalsTable(title: string, rows: { name: string; total: number }[], label: string) {
  const sum = rows.reduce((s, r) => s + r.total, 0);
  const body = rows.length
    ? rows.map((r) => `<tr><td>${escapeHtml(r.name)}</td><td>${formatCurrencyBRL(r.total)}</td><td>${sum > 0 ? ((r.total / sum) * 100).toFixed(1).replace(".", ",") : "0"}%</td></tr>`).join("")
    : `<tr><td colspan="3">Nada no período.</td></tr>`;
  return `<h2>${title}</h2><table><thead><tr><th>${label}</th><th>Valor</th><th>%</th></tr></thead><tbody>${body}</tbody>
    <tfoot><tr><th>Total</th><th>${formatCurrencyBRL(sum)}</th><th></th></tr></tfoot></table>`;
}

const paidValue = (p: AccountPayable) => p.paidAmount ?? p.amount;
const receivedValue = (r: AccountReceivable) => r.receivedAmount ?? r.amount;

/** `popup`: janela aberta já no clique (openReportWindow) — evita o bloqueio de pop-up. */
export async function generateFinancialReportPdf(token: string, from: string, to: string, popup: Window | null) {
  const [cashFlow, dre, openPayables, openReceivables] = await Promise.all([
    api.cashFlow(token, { from, to }).then((r) => r.cashFlow as CashFlow),
    api.dre(token, { from, to }).then((r) => r.dre as DRE),
    api.payables(token, { from, to, pageSize: 100 }).then((r) => (r.items as AccountPayable[]).filter((p) => p.status === "PENDING" || p.status === "OVERDUE")),
    api.receivables(token, { from, to, pageSize: 100 }).then((r) => (r.items as AccountReceivable[]).filter((p) => p.status === "PENDING" || p.status === "OVERDUE")),
  ]);

  const period = `${new Date(`${from}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${to}T12:00:00`).toLocaleDateString("pt-BR")}`;
  const bySector = groupTotals(cashFlow.payables, (p) => p.expenseSector || "Sem setor", paidValue);
  const byGroup = groupTotals(cashFlow.payables, (p) => p.expenseGroup || "Sem grupo", paidValue);
  const byDescription = groupTotals(
    cashFlow.payables.filter((p) => p.expenseDescription),
    (p) => `${p.expenseGroup ? `${p.expenseGroup} › ` : ""}${p.expenseDescription}`,
    paidValue
  );

  const receivedRows = cashFlow.receivables
    .map((r) => `<tr><td>${date(r.receivedAt)}</td><td>${escapeHtml(r.description)}</td><td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.client?.name ?? "—")}</td><td>${formatCurrencyBRL(receivedValue(r))}</td></tr>`)
    .join("");
  const paidRows = cashFlow.payables
    .map(
      (p) =>
        `<tr><td>${date(p.paidAt)}</td><td>${escapeHtml(p.description)}</td><td>${escapeHtml(p.payeeName)}</td><td>${escapeHtml(p.category)}${p.expenseGroup ? `<br/><small>${escapeHtml(p.expenseGroup)}${p.expenseDescription ? ` › ${escapeHtml(p.expenseDescription)}` : ""}</small>` : ""}</td><td>${escapeHtml(p.expenseSector ?? "—")}</td><td>${formatCurrencyBRL(paidValue(p))}</td></tr>`
    )
    .join("");
  const manualRows = cashFlow.entries
    .map((e) => `<tr><td>${date(e.occurredAt)}</td><td>${e.type === "INCOME" ? "Entrada" : "Saída"}</td><td>${escapeHtml(e.description)}</td><td>${escapeHtml(e.category)}</td><td>${formatCurrencyBRL(e.amount)}</td></tr>`)
    .join("");
  const openPayRows = openPayables
    .map((p) => `<tr><td>${date(p.dueDate)}</td><td>${escapeHtml(p.description)}</td><td>${escapeHtml(p.payeeName)}</td><td>${p.status === "OVERDUE" ? "Vencida" : "Pendente"}</td><td>${formatCurrencyBRL(p.amount)}</td></tr>`)
    .join("");
  const openRecRows = openReceivables
    .map((r) => `<tr><td>${date(r.dueDate)}</td><td>${escapeHtml(r.description)}</td><td>${escapeHtml(r.client?.name ?? "—")}</td><td>${r.status === "OVERDUE" ? "Vencida" : "Pendente"}</td><td>${formatCurrencyBRL(r.amount)}</td></tr>`)
    .join("");
  const sum = <T,>(rows: T[], f: (r: T) => number) => formatCurrencyBRL(rows.reduce((s, r) => s + f(r), 0));

  const body = `
    <h1>Relatório financeiro</h1>
    <div class="muted">Período: ${period} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
    <div class="summary">
      <div class="box"><strong>Saldo inicial das contas</strong><br />${formatCurrencyBRL(cashFlow.initialBalance)}</div>
      <div class="box"><strong>Entradas no período</strong><br />${formatCurrencyBRL(cashFlow.totalIn)}</div>
      <div class="box"><strong>Saídas no período</strong><br />${formatCurrencyBRL(cashFlow.totalOut)}</div>
      <div class="box"><strong>Resultado do período</strong><br />${formatCurrencyBRL(dre.netResult)}</div>
      <div class="box"><strong>A pagar em aberto (vence no período)</strong><br />${sum(openPayables, (p) => p.amount)}</div>
      <div class="box"><strong>A receber em aberto (vence no período)</strong><br />${sum(openReceivables, (r) => r.amount)}</div>
    </div>

    ${totalsTable("Receitas por categoria", dre.revenueByCategory.map((r) => ({ name: r.category, total: r.amount })), "Categoria")}
    ${totalsTable("Despesas por categoria (natureza da operação)", dre.expensesByCategory.map((r) => ({ name: r.category, total: r.amount })), "Categoria")}
    ${totalsTable("Despesas pagas por setor", bySector, "Setor")}
    ${totalsTable("Despesas pagas por grupo", byGroup, "Grupo")}
    ${byDescription.length ? totalsTable("Despesas pagas por descrição", byDescription, "Grupo › descrição") : ""}

    <h2>Contas recebidas</h2>
    <table><thead><tr><th>Recebida em</th><th>Descrição</th><th>Categoria</th><th>Cliente</th><th>Valor</th></tr></thead>
      <tbody>${receivedRows || '<tr><td colspan="5">Nenhuma no período.</td></tr>'}</tbody></table>

    <h2>Contas pagas</h2>
    <table><thead><tr><th>Paga em</th><th>Descrição</th><th>Fornecedor</th><th>Categoria / grupo</th><th>Setor</th><th>Valor</th></tr></thead>
      <tbody>${paidRows || '<tr><td colspan="6">Nenhuma no período.</td></tr>'}</tbody></table>

    <h2>Lançamentos manuais</h2>
    <table><thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead>
      <tbody>${manualRows || '<tr><td colspan="5">Nenhum no período.</td></tr>'}</tbody></table>

    <h2>Em aberto com vencimento no período</h2>
    <table><thead><tr><th>Vencimento</th><th>A pagar</th><th>Fornecedor</th><th>Situação</th><th>Valor</th></tr></thead>
      <tbody>${openPayRows || '<tr><td colspan="5">Nenhuma conta a pagar em aberto.</td></tr>'}</tbody></table>
    <table><thead><tr><th>Vencimento</th><th>A receber</th><th>Cliente</th><th>Situação</th><th>Valor</th></tr></thead>
      <tbody>${openRecRows || '<tr><td colspan="5">Nenhuma conta a receber em aberto.</td></tr>'}</tbody></table>

    <div class="total">Resultado líquido do período: ${formatCurrencyBRL(dre.netResult)}</div>
  `;
  openPrintableReport(`Relatório financeiro ${period}`, body, popup);
}
