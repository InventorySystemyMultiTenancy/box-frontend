"use client";

import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Paleta categórica fixa (slots 1/2/3 do palette.md) — nunca ciclada, mesma ordem em
// todo gráfico desta tela.
const COLOR_INCOME = "#2a78d6";
const COLOR_EXPENSES = "#eb6834";
const COLOR_PARTS = "#2a78d6";
const COLOR_PAYABLES = "#eb6834";
const COLOR_MANUAL = "#1baf7a";

export interface MonthlyPoint {
  month: string;
  income: number;
  expenses: number;
}

export interface CostBreakdown {
  partsCost: number;
  paidPayables: number;
  manualExpenses: number;
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatCompact(value: number) {
  return value >= 1000 ? `R$${(value / 1000).toFixed(1)}k` : `R$${value.toFixed(0)}`;
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  return label.replace(".", "");
}

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string | number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "0.5rem 0.7rem",
        fontSize: "0.78rem",
        boxShadow: "var(--shadow)",
      }}
    >
      {label && <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.8rem", color: "var(--text)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <i style={{ width: 8, height: 8, borderRadius: 999, background: p.color, display: "inline-block" }} />
            {p.name}
          </span>
          <strong>{formatCurrency(p.value ?? 0)}</strong>
        </div>
      ))}
    </div>
  );
}

/** Entradas x saídas nos últimos 6 meses — comparação de magnitude entre duas séries. */
export function FinanceTrendChart({ data }: { data: MonthlyPoint[] }) {
  const points = data.map((d) => ({ ...d, label: formatMonthLabel(d.month) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={points} barGap={4} barCategoryGap={24}>
        <CartesianGrid vertical={false} stroke="var(--grid-line)" />
        <XAxis dataKey="label" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={{ stroke: "var(--border-strong)" }} tickLine={false} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} width={56} tickFormatter={formatCompact} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--bg-panel)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }} iconType="circle" iconSize={8} />
        <Bar dataKey="income" name="Entradas" fill={COLOR_INCOME} radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="expenses" name="Saídas" fill={COLOR_EXPENSES} radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Composição das saídas — peças em projetos, compras/contas pagas e despesas manuais. */
export function FinanceCostBreakdownChart({ breakdown }: { breakdown: CostBreakdown }) {
  const data = [
    { key: "partsCost", name: "Peças em projetos", value: breakdown.partsCost, color: COLOR_PARTS },
    { key: "paidPayables", name: "Compras/contas pagas", value: breakdown.paidPayables, color: COLOR_PAYABLES },
    { key: "manualExpenses", name: "Despesas manuais", value: breakdown.manualExpenses, color: COLOR_MANUAL },
  ];
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 8 }}>
        <CartesianGrid horizontal={false} stroke="var(--grid-line)" />
        <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={formatCompact} />
        <YAxis type="category" dataKey="name" width={150} tick={{ fill: "var(--text)", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--bg-panel)" }} />
        <Bar
          dataKey="value"
          name="Valor"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          label={{ position: "right", formatter: (value) => formatCurrency(Number(value ?? 0)), fill: "var(--text)", fontSize: 12 }}
        >
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
