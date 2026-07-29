"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { FinancialEntry } from "@/lib/types";
import styles from "./dashboard.module.css";

interface Summary {
  income: number;
  expenses: number;
  partsCost: number;
  profit: number;
  count: number;
}

export default function AdminFinancePanel() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [form, setForm] = useState({ category: "Despesa fixa", description: "", amount: "" });

  function load() {
    if (!token) return;
    api.financeSummary(token).then(({ summary, entries }) => {
      setSummary(summary as Summary);
      setEntries(entries as FinancialEntry[]);
    });
  }

  useEffect(load, [token]);

  async function createExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    await api.createExpense({ category: form.category, description: form.description, amount: Number(form.amount) }, token);
    setForm({ category: "Despesa fixa", description: "", amount: "" });
    load();
  }

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>Controle de lucros</div>
      {summary && (
        <div className={styles.statsGrid}>
          <div className={styles.statBox}><span>Entradas</span><strong>R$ {summary.income.toFixed(2)}</strong></div>
          <div className={styles.statBox}><span>Saídas</span><strong>R$ {summary.expenses.toFixed(2)}</strong></div>
          <div className={styles.statBox}><span>Custo de peças</span><strong>R$ {summary.partsCost.toFixed(2)}</strong></div>
          <div className={styles.statBox}><span>Lucro líquido</span><strong>R$ {summary.profit.toFixed(2)}</strong></div>
        </div>
      )}

      <div className={styles.panel}>
        <h2>Cadastrar gasto</h2>
        <form className={styles.formGrid} onSubmit={createExpense}>
          <label>
            Categoria
            <input value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} required />
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

      <div className={styles.ordersList}>
        {entries.map((entry) => (
          <div key={entry.id} className={styles.orderRow}>
            <div className={styles.orderRowInfo}>
              <strong>{entry.description}</strong>
              <span>{entry.category} · {new Date(entry.occurredAt).toLocaleString("pt-BR")}</span>
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
