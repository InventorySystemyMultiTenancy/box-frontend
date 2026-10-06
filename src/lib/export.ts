import { escapeHtml, openPrintableReport } from "@/lib/printable-report";

export type ExportValue = string | number | Date | null | undefined;

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => ExportValue;
  /** "money" formata como R$ no PDF e com vírgula decimal na planilha. */
  type?: "text" | "money" | "date" | "number";
}

function formatForCsv(value: ExportValue, type: ExportColumn<unknown>["type"]) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  if (type === "date" && typeof value === "string") return new Date(value).toLocaleDateString("pt-BR");
  // Excel em pt-BR espera vírgula decimal e sem separador de milhar pra reconhecer número.
  if (typeof value === "number") return value.toFixed(type === "money" ? 2 : Number.isInteger(value) ? 0 : 2).replace(".", ",");
  return String(value);
}

function formatForPdf(value: ExportValue, type: ExportColumn<unknown>["type"]) {
  if (value === null || value === undefined || value === "") return "—";
  if (type === "money" && typeof value === "number") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (value instanceof Date) return value.toLocaleDateString("pt-BR");
  if (type === "date" && typeof value === "string") return new Date(value).toLocaleDateString("pt-BR");
  if (typeof value === "number") return value.toLocaleString("pt-BR");
  return String(value);
}

function csvCell(text: string) {
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Baixa uma planilha .csv que abre direto no Excel (pt-BR): separador ";", vírgula
 * decimal e BOM UTF-8 pra acentuação sair certa.
 */
export function exportCsv<T>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const lines = [
    columns.map((c) => csvCell(c.header)).join(";"),
    ...rows.map((row) => columns.map((c) => csvCell(formatForCsv(c.value(row), c.type))).join(";")),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Abre a mesma tabela num relatório imprimível (o usuário salva como PDF). */
export function exportPdf<T>(title: string, columns: ExportColumn<T>[], rows: T[], subtitle?: string) {
  const moneyTotals = columns.map((c) =>
    c.type === "money" ? rows.reduce((sum, row) => sum + (Number(c.value(row)) || 0), 0) : null
  );
  const hasTotals = moneyTotals.some((t) => t !== null);
  const body = `
    <h1>${escapeHtml(title)}</h1>
    <div class="muted">${escapeHtml(subtitle ?? "")} Gerado em ${new Date().toLocaleString("pt-BR")} · ${rows.length} registro(s)</div>
    <table>
      <thead><tr>${columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("")}</tr></thead>
      <tbody>
        ${rows
          .map((row) => `<tr>${columns.map((c) => `<td>${escapeHtml(formatForPdf(c.value(row), c.type))}</td>`).join("")}</tr>`)
          .join("")}
      </tbody>
      ${
        hasTotals
          ? `<tfoot><tr>${moneyTotals
              .map((t, i) => `<th>${t === null ? (i === 0 ? "Total" : "") : escapeHtml(formatForPdf(t, "money"))}</th>`)
              .join("")}</tr></tfoot>`
          : ""
      }
    </table>`;
  openPrintableReport(title, body);
}

/** Nome de arquivo seguro com a data de hoje, ex.: "contas-a-receber-2026-10-06". */
export function exportFilename(base: string) {
  return `${base}-${new Date().toISOString().slice(0, 10)}`;
}
