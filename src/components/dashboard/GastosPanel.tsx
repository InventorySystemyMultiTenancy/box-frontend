"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import styles from "./dashboard.module.css";

const EMPTY_FORM = { category: "", description: "", amount: "", occurredAt: new Date().toISOString().slice(0, 10) };

/** Qualquer funcionário lança um gasto próprio aqui — quem filtra/analisa por data,
 * usuário e categoria é o admin, na aba Financeiro » Resumo. */
export default function GastosPanel() {
  const { token, user } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api.expenseCategories(token).then(({ categories }) => setCategories(categories));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.createExpense(
        {
          category: form.category,
          description: form.description,
          amount: Number(form.amount),
          occurredAt: new Date(form.occurredAt).toISOString(),
        },
        token
      );
      setForm(EMPTY_FORM);
      setMessage("Gasto registrado.");
    } catch {
      setMessage("Não foi possível registrar o gasto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.content}>
      <div className={styles.sectionTitle}>Meus gastos</div>
      <p className={styles.tlSub} style={{ marginBottom: "1rem" }}>
        Lance aqui um gasto que você teve — {user?.name} — o administrador consegue ver e filtrar todos os gastos
        lançados pela equipe na aba Financeiro.
      </p>
      <div className={styles.panel}>
        <form className={styles.formGrid} onSubmit={submit}>
          <label>
            Categoria
            <input
              list="gasto-categorias"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="Ex.: Combustível, Alimentação..."
              required
            />
            <datalist id="gasto-categorias">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label>
            Valor
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />
          </label>
          <label>
            Data
            <input
              type="date"
              value={form.occurredAt}
              onChange={(e) => setForm((prev) => ({ ...prev, occurredAt: e.target.value }))}
              required
            />
          </label>
          <label className={styles.fullField}>
            Descrição
            <input
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              required
            />
          </label>
          {message && <div className={styles.formMessage}>{message}</div>}
          <button className={styles.actionButton} type="submit" disabled={busy}>
            {busy ? "Registrando..." : "Registrar gasto"}
          </button>
        </form>
      </div>
    </div>
  );
}
