"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { FinancialEntry } from "@/lib/types";
import { openPrintableReport, escapeHtml, formatCurrencyBRL } from "@/lib/printable-report";
import styles from "./dashboard.module.css";

const EMPTY_FORM = { category: "", description: "", amount: "", occurredAt: new Date().toISOString().slice(0, 10) };

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/** Qualquer funcionário lança um gasto próprio aqui — quem filtra/analisa por data,
 * usuário e categoria é o admin, na aba Financeiro » Resumo. */
export default function GastosPanel({ backTo }: { backTo?: { href: string; label: string } }) {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reportFrom, setReportFrom] = useState(firstDayOfMonth());
  const [reportTo, setReportTo] = useState(new Date().toISOString().slice(0, 10));
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.expenseCategories(token).then(({ categories }) => setCategories(categories));
  }, [token]);

  async function generateReport() {
    if (!token) return;
    setGeneratingReport(true);
    try {
      const { entries, total } = await api.myExpenses(token, { from: reportFrom, to: reportTo });
      const rows = (entries as FinancialEntry[])
        .map(
          (entry) => `
            <tr>
              <td>${new Date(entry.occurredAt).toLocaleDateString("pt-BR")}</td>
              <td>${escapeHtml(entry.description)}</td>
              <td>${escapeHtml(entry.category)}</td>
              <td>${formatCurrencyBRL(entry.amount)}</td>
            </tr>
          `
        )
        .join("");
      openPrintableReport(
        "Relatório de gastos",
        `
          <h1>Relatório de gastos</h1>
          <div class="muted">
            ${escapeHtml(user?.name ?? "")} · Período: ${new Date(reportFrom).toLocaleDateString("pt-BR")} a ${new Date(reportTo).toLocaleDateString("pt-BR")}
            · Gerado em ${new Date().toLocaleString("pt-BR")}
          </div>
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Valor</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="4">Nenhum gasto lançado no período.</td></tr>'}</tbody>
          </table>
          <div class="total">Total do período: ${formatCurrencyBRL(total)}</div>
        `
      );
    } finally {
      setGeneratingReport(false);
    }
  }

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
      setForm({ ...EMPTY_FORM, occurredAt: form.occurredAt });
      setMessage("Gasto registrado.");
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["my-expenses"] });
    } catch {
      setMessage("Não foi possível registrar o gasto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.content}>
      {backTo && (
        <Link href={backTo.href} className={styles.linkButton} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.8rem" }}>
          <ArrowLeft size={14} /> {backTo.label}
        </Link>
      )}
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
              placeholder="Refeição, Hotel, Diversos..."
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
          {backTo && saved && (
            <Link href={backTo.href} className={styles.actionButton} style={{ textAlign: "center" }}>
              {backTo.label}
            </Link>
          )}
        </form>
      </div>

      <div className={styles.panel}>
        <h2>Gastos lançados no período</h2>
        <div className={styles.formGrid}>
          <label>
            De
            <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} />
          </label>
          <label>
            Até
            <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)} />
          </label>
        </div>
        <div className={styles.approvalActions} style={{ marginTop: "0.8rem" }}>
          <button type="button" className={styles.actionButton} onClick={generateReport} disabled={generatingReport}>
            {generatingReport ? "Gerando..." : "Gerar PDF do período"}
          </button>
        </div>
        <MyExpensesList from={reportFrom} to={reportTo} categories={categories} />
      </div>
    </div>
  );
}

// Lista dos gastos que o próprio usuário lançou no período, com editar/excluir — o servidor
// só deixa mexer nos próprios (admin mexe em qualquer um) e nunca em lançamento automático.
function MyExpensesList({ from, to, categories }: { from: string; to: string; categories: string[] }) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ category: "", description: "", amount: "", occurredAt: "" });
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["my-expenses", from, to],
    queryFn: async () => {
      const res = await api.myExpenses(token!, { from, to });
      return { entries: res.entries as FinancialEntry[], total: res.total };
    },
    enabled: !!token && !!from && !!to,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["my-expenses"] });
  }

  function startEdit(entry: FinancialEntry) {
    setEditingId(entry.id);
    setEdit({
      category: entry.category,
      description: entry.description,
      amount: String(entry.amount),
      occurredAt: new Date(entry.occurredAt).toISOString().slice(0, 10),
    });
  }

  async function saveEdit(id: string) {
    if (!token) return;
    if (!edit.category.trim() || !edit.description.trim() || !(Number(edit.amount) >= 0)) {
      toast.error("Preencha categoria, descrição e valor.");
      return;
    }
    setSavingId(id);
    try {
      await api.updateExpense(
        id,
        {
          category: edit.category.trim(),
          description: edit.description.trim(),
          amount: Number(edit.amount),
          occurredAt: new Date(`${edit.occurredAt}T12:00:00`).toISOString(),
        },
        token
      );
      toast.success("Gasto atualizado.");
      setEditingId(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível atualizar o gasto.");
    } finally {
      setSavingId(null);
    }
  }

  async function remove(entry: FinancialEntry) {
    if (!token || !confirm(`Excluir o gasto "${entry.description}" de ${formatCurrencyBRL(entry.amount)}?`)) return;
    setSavingId(entry.id);
    try {
      await api.deleteExpense(entry.id, token);
      toast.success("Gasto excluído.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o gasto.");
    } finally {
      setSavingId(null);
    }
  }

  const entries = data?.entries ?? [];

  return (
    <div style={{ marginTop: "1rem", overflowX: "auto" }}>
      {isLoading && <p className={styles.tlSub}>Carregando...</p>}
      {!isLoading && entries.length === 0 && <p className={styles.tlSub}>Nenhum gasto lançado por você no período.</p>}
      {entries.length > 0 && (
        <table className={styles.usersTable}>
          <thead>
            <tr>
              <th>Data</th>
              <th>Categoria</th>
              <th>Descrição</th>
              <th>Valor</th>
              <th style={{ width: 150 }} />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) =>
              editingId === entry.id ? (
                <tr key={entry.id}>
                  <td>
                    <input type="date" value={edit.occurredAt} onChange={(e) => setEdit((p) => ({ ...p, occurredAt: e.target.value }))} />
                  </td>
                  <td>
                    <input list="gasto-categorias-edit" value={edit.category} onChange={(e) => setEdit((p) => ({ ...p, category: e.target.value }))} />
                    <datalist id="gasto-categorias-edit">
                      {categories.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </td>
                  <td>
                    <input value={edit.description} onChange={(e) => setEdit((p) => ({ ...p, description: e.target.value }))} />
                  </td>
                  <td>
                    <input type="number" min="0" step="0.01" value={edit.amount} onChange={(e) => setEdit((p) => ({ ...p, amount: e.target.value }))} style={{ width: 110 }} />
                  </td>
                  <td>
                    <button type="button" className={styles.linkButton} disabled={savingId === entry.id} onClick={() => saveEdit(entry.id)}>
                      {savingId === entry.id ? "Salvando..." : "Salvar"}
                    </button>
                    <button type="button" className={styles.linkButton} style={{ marginLeft: "0.6rem" }} onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={entry.id}>
                  <td>{new Date(entry.occurredAt).toLocaleDateString("pt-BR")}</td>
                  <td>{entry.category}</td>
                  <td>{entry.description}</td>
                  <td>{formatCurrencyBRL(entry.amount)}</td>
                  <td>
                    <button type="button" className={styles.linkButton} onClick={() => startEdit(entry)} aria-label="Editar gasto">
                      <Pencil size={14} /> Editar
                    </button>
                    <button
                      type="button"
                      className={styles.linkButton}
                      style={{ marginLeft: "0.6rem", color: "var(--critical)" }}
                      disabled={savingId === entry.id}
                      onClick={() => remove(entry)}
                      aria-label="Excluir gasto"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan={3}>Total do período</th>
              <th>{formatCurrencyBRL(data?.total ?? 0)}</th>
              <th />
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
