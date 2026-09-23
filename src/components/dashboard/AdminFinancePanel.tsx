"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { FinancialEntry } from "@/lib/types";
import { FinanceCostBreakdownChart, FinanceTrendChart, MonthlyPoint } from "@/components/dashboard/FinanceCharts";
import { openPrintableReport, escapeHtml, formatCurrencyBRL } from "@/lib/printable-report";
import styles from "./dashboard.module.css";

interface Summary {
  income: number;
  expenses: number;
  partsCost: number;
  paidPayables: number;
  manualExpenses: number;
  receivedReceivables: number;
  profit: number;
  count: number;
}

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function AdminFinancePanel() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({ category: "Despesa fixa", description: "", amount: "" });
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [filterCategory, setFilterCategory] = useState("");
  const [filterUserId, setFilterUserId] = useState("");

  function load() {
    if (!token) return;
    api.financeSummary(token, { from, to }).then(({ summary, entries, monthly }) => {
      setSummary(summary as Summary);
      setEntries(entries as FinancialEntry[]);
      setMonthly((monthly as MonthlyPoint[]) ?? []);
    });
    api.expenseCategories(token).then(({ categories }) => setCategories(categories));
  }

  useEffect(load, [token, from, to]);

  async function createExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await api.createExpense({ category: form.category, description: form.description, amount: Number(form.amount) }, token);
    setForm({ category: "Despesa fixa", description: "", amount: "" });
    load();
  }

  const loggedByUsers = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of entries) {
      if (entry.createdBy) map.set(entry.createdBy.id, entry.createdBy.name);
    }
    return Array.from(map.entries());
  }, [entries]);

  const filteredEntries = entries.filter(
    (entry) =>
      (!filterCategory || entry.category === filterCategory) &&
      (!filterUserId || entry.createdBy?.id === filterUserId)
  );

  function generatePdf() {
    if (!summary) return;
    const rows = filteredEntries
      .map(
        (entry) => `
          <tr>
            <td>${new Date(entry.occurredAt).toLocaleDateString("pt-BR")}</td>
            <td>${escapeHtml(entry.description)}</td>
            <td>${escapeHtml(entry.category)}</td>
            <td>${escapeHtml(entry.createdBy?.name ?? "—")}</td>
            <td>${entry.type === "INCOME" ? "Entrada" : "Saída"}</td>
            <td>${formatCurrencyBRL(entry.amount)}</td>
          </tr>
        `
      )
      .join("");
    openPrintableReport(
      "Resumo financeiro",
      `
        <h1>Resumo financeiro</h1>
        <div class="muted">Período: ${new Date(from).toLocaleDateString("pt-BR")} a ${new Date(to).toLocaleDateString("pt-BR")} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
        <div class="summary">
          <div class="box"><strong>Entradas</strong><br />${formatCurrencyBRL(summary.income)}</div>
          <div class="box"><strong>Saídas</strong><br />${formatCurrencyBRL(summary.expenses)}</div>
          <div class="box"><strong>Custo de peças</strong><br />${formatCurrencyBRL(summary.partsCost)}</div>
          <div class="box"><strong>Contas pagas</strong><br />${formatCurrencyBRL(summary.paidPayables)}</div>
          <div class="box"><strong>Contas recebidas</strong><br />${formatCurrencyBRL(summary.receivedReceivables)}</div>
          <div class="box"><strong>Lucro líquido</strong><br />${formatCurrencyBRL(summary.profit)}</div>
        </div>
        <h2>Lançamentos do período</h2>
        <table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Lançado por</th><th>Tipo</th><th>Valor</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="6">Nenhum lançamento no período.</td></tr>'}</tbody>
        </table>
        <div class="total">Lucro líquido: ${formatCurrencyBRL(summary.profit)}</div>
      `
    );
  }

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>Controle de lucros</div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          De
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          Até
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="button" className={styles.actionButton} onClick={generatePdf} disabled={!summary}>
          Gerar PDF do período
        </button>
      </div>

      {summary && (
        <div className={styles.statsGrid}>
          <div className={styles.statBox}><span>Entradas</span><strong>R$ {summary.income.toFixed(2)}</strong></div>
          <div className={styles.statBox}><span>Saídas</span><strong>R$ {summary.expenses.toFixed(2)}</strong></div>
          <div className={styles.statBox}><span>Custo de peças</span><strong>R$ {summary.partsCost.toFixed(2)}</strong></div>
          <div className={styles.statBox}><span>Contas recebidas</span><strong>R$ {summary.receivedReceivables.toFixed(2)}</strong></div>
          <div className={styles.statBox}><span>Lucro líquido</span><strong>R$ {summary.profit.toFixed(2)}</strong></div>
        </div>
      )}

      <div className={styles.panel}>
        <h2>Cadastrar gasto</h2>
        <form className={styles.formGrid} onSubmit={createExpense}>
          <label>
            Categoria
            <input
              list="expense-categories"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              required
            />
            <datalist id="expense-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Valor
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} required />
          </label>
          <label className={styles.fullField}>
            Descrição
            <input value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} required />
          </label>
          <button className={styles.actionButton}>Registrar gasto</button>
        </form>
      </div>

      {summary && (
        <div className={styles.panel}>
          <h2>Entradas x saídas (últimos 6 meses)</h2>
          <FinanceTrendChart data={monthly} />
        </div>
      )}

      {summary && (
        <div className={styles.panel}>
          <h2>Composição das saídas</h2>
          <FinanceCostBreakdownChart
            breakdown={{ partsCost: summary.partsCost, paidPayables: summary.paidPayables, manualExpenses: summary.manualExpenses }}
          />
        </div>
      )}

      <div className={styles.panelHeadRow} style={{ marginTop: "1.2rem" }}>
        <h2 style={{ marginBottom: 0 }}>Lançamentos ({filteredEntries.length})</h2>
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)}>
          <option value="">Todos os usuários</option>
          {loggedByUsers.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
      </div>

      <div className={styles.ordersList}>
        {filteredEntries.map((entry) => (
          <div key={entry.id} className={styles.orderRow}>
            <div className={styles.orderRowInfo}>
              <strong>{entry.description}</strong>
              <span>
                {entry.category} · {new Date(entry.occurredAt).toLocaleString("pt-BR")}
                {entry.createdBy && ` · ${entry.createdBy.name}`}
              </span>
            </div>
            <span className={`${styles.badge} ${entry.type === "INCOME" ? styles["tone-ok"] : styles["tone-crit"]}`}>
              <i className={styles.dot} />
              {entry.type === "INCOME" ? "+" : "-"} R$ {entry.amount.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
