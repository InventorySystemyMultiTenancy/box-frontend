import { escapeHtml, formatCurrencyBRL, openPrintableReport } from "@/lib/printable-report";

// Relatório de abastecimentos (Caminhões > Abastecimentos > "Relatório"). As contas vêm
// prontas do backend (truck-refueling-report.service.ts); aqui só o tipo e o PDF.

type Summary = {
  refuelings: number;
  liters: number;
  amount: number;
  km: number;
  avgKmPerLiter: number | null;
  costPerKm: number | null;
  avgPricePerLiter: number | null;
  avgAmountPerRefueling: number | null;
  sharePct: number;
};

type PricePoint = { date: string; plate: string; pricePerLiter: number } | null;

export interface RefuelingReport {
  period: { from: string; to: string; days: number };
  totals: Summary & {
    trucks: number;
    drivers: number;
    daysWithRefueling: number;
    avgAmountPerDay: number;
    avgLitersPerRefueling: number | null;
    cheapest: PricePoint;
    priciest: PricePoint;
  };
  trucks: (Summary & {
    truckId: string;
    plate: string;
    label: string;
    avgKmBetweenRefuelings: number | null;
    bestKmPerLiter: number | null;
    worstKmPerLiter: number | null;
    minPricePerLiter: number;
    maxPricePerLiter: number;
    firstKm: number;
    lastKm: number;
    drivers: number;
    topDriver: { name: string; refuelings: number } | null;
  })[];
  drivers: (Summary & { driverId: string; name: string; trucks: string[] })[];
  days: (Summary & { date: string })[];
  topDays: (Summary & { date: string })[];
  weekdays: (Summary & { weekday: number; label: string })[];
  alerts: { date: string; plate: string; driver: string; message: string }[];
  entries: {
    id: string;
    date: string;
    day: string;
    plate: string;
    driver: string;
    currentKm: number;
    kmSincePrevious: number | null;
    liters: number;
    amount: number;
    pricePerLiter: number;
    kmPerLiter: number | null;
  }[];
}

const num = (value: number, digits = 0) => value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const km = (value: number | null) => (value == null ? "—" : `${num(value)} km`);
const kml = (value: number | null) => (value == null ? "—" : `${num(value, 2)} km/l`);
const money = (value: number | null) => (value == null ? "—" : formatCurrencyBRL(value));
const perLiter = (value: number | null) => (value == null ? "—" : `R$ ${num(value, 3)}`);
const liters = (value: number) => `${num(value, 2)} L`;
const dayLabel = (day: string) => day.split("-").reverse().join("/");
const dateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" });

// Barra horizontal simples (sai na impressão com print-color-adjust).
function bar(value: number, max: number) {
  const pct = max > 0 ? Math.max(1, Math.round((value / max) * 100)) : 0;
  return `<div class="bar"><span style="width:${pct}%"></span></div>`;
}

function card(label: string, value: string, hint?: string) {
  return `<div class="box"><div class="muted">${label}</div><div class="kpi">${value}</div>${hint ? `<div class="muted small">${hint}</div>` : ""}</div>`;
}

export function printRefuelingReport(report: RefuelingReport, truckLabel?: string) {
  const t = report.totals;
  const title = "Relatório de abastecimentos";
  const period = `${dayLabel(report.period.from)} a ${dayLabel(report.period.to)} (${report.period.days} ${report.period.days === 1 ? "dia" : "dias"})`;

  if (t.refuelings === 0) {
    openPrintableReport(
      title,
      `<h1>${title}</h1><div class="muted">Período: ${period}${truckLabel ? ` · Caminhão: ${escapeHtml(truckLabel)}` : ""} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
       <p style="margin-top:24px">Nenhum abastecimento registrado no período.</p>`
    );
    return;
  }

  const maxTruck = Math.max(...report.trucks.map((x) => x.amount));
  const maxDriver = Math.max(...report.drivers.map((x) => x.refuelings));
  const maxDay = Math.max(...report.days.map((x) => x.amount));
  const maxWeekday = Math.max(...report.weekdays.map((x) => x.amount));
  const topTruck = report.trucks[0];
  const topDriver = report.drivers[0];
  const bestEfficiency = [...report.trucks].filter((x) => x.avgKmPerLiter != null).sort((a, b) => b.avgKmPerLiter! - a.avgKmPerLiter!);
  const busiestWeekday = [...report.weekdays].sort((a, b) => b.refuelings - a.refuelings || b.amount - a.amount)[0];

  const highlights = [
    `Caminhão com maior gasto: <b>${escapeHtml(topTruck.plate)}</b> — ${money(topTruck.amount)} (${num(topTruck.sharePct, 1)}% do total).`,
    `Quem mais abasteceu: <b>${escapeHtml(topDriver.name)}</b> — ${topDriver.refuelings} abastecimento(s), ${money(topDriver.amount)}.`,
    bestEfficiency.length
      ? `Melhor consumo: <b>${escapeHtml(bestEfficiency[0].plate)}</b> (${kml(bestEfficiency[0].avgKmPerLiter)})${
          bestEfficiency.length > 1 ? `; pior: <b>${escapeHtml(bestEfficiency[bestEfficiency.length - 1].plate)}</b> (${kml(bestEfficiency[bestEfficiency.length - 1].avgKmPerLiter)})` : ""
        }.`
      : "",
    `Dia com maior gasto: <b>${dayLabel(report.topDays[0].date)}</b> — ${money(report.topDays[0].amount)} em ${report.topDays[0].refuelings} abastecimento(s).`,
    `Dia da semana com mais abastecimentos: <b>${busiestWeekday.label}</b> (${busiestWeekday.refuelings}).`,
    t.cheapest && t.priciest
      ? `Litro mais barato: ${perLiter(t.cheapest.pricePerLiter)} (${escapeHtml(t.cheapest.plate)}, ${dateTime(t.cheapest.date)}); mais caro: ${perLiter(t.priciest.pricePerLiter)} (${escapeHtml(t.priciest.plate)}, ${dateTime(t.priciest.date)}).`
      : "",
    report.alerts.length ? `<b>${report.alerts.length}</b> ponto(s) de atenção — veja a seção "Pontos de atenção".` : "Nenhum ponto de atenção no período.",
  ].filter(Boolean);

  const body = `
    <style>
      .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 16px; }
      .kpi { font-size: 17px; font-weight: 700; margin-top: 2px; }
      .small { font-size: 11px; }
      .bar { background: #eee; height: 9px; border-radius: 4px; min-width: 80px; }
      .bar span { display: block; height: 100%; background: #c2410c; border-radius: 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      td.n, th.n { text-align: right; white-space: nowrap; }
      table { font-size: 11px; }
      th, td { padding: 5px 6px; }
      tr { break-inside: avoid; }
      h2 { break-after: avoid; }
      ul.hl { margin: 8px 0 0; padding-left: 18px; font-size: 13px; line-height: 1.6; }
      .alert td { color: #9a3412; }
    </style>
    <h1>${title}</h1>
    <div class="muted">Período: ${period}${truckLabel ? ` · Caminhão: ${escapeHtml(truckLabel)}` : ""} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>

    <div class="grid4">
      ${card("Gasto total", money(t.amount), `${t.refuelings} abastecimento(s)`)}
      ${card("Litros abastecidos", liters(t.liters), `média ${t.avgLitersPerRefueling != null ? liters(t.avgLitersPerRefueling) : "—"} por abastecimento`)}
      ${card("Km rodados", km(t.km), "entre abastecimentos")}
      ${card("Consumo médio da frota", kml(t.avgKmPerLiter))}
      ${card("Preço médio do litro", perLiter(t.avgPricePerLiter))}
      ${card("Custo por km", t.costPerKm != null ? `R$ ${num(t.costPerKm, 3)}` : "—")}
      ${card("Gasto médio por dia", money(t.avgAmountPerDay), `${t.daysWithRefueling} dia(s) com abastecimento`)}
      ${card("Gasto médio por abastecimento", money(t.avgAmountPerRefueling), `${t.trucks} caminhão(ões) · ${t.drivers} motorista(s)`)}
    </div>

    <h2>Destaques</h2>
    <ul class="hl">${highlights.map((h) => `<li>${h}</li>`).join("")}</ul>

    <h2>Por caminhão</h2>
    <table>
      <thead><tr>
        <th>Caminhão</th><th class="n">Abast.</th><th class="n">Litros</th><th class="n">Gasto</th><th>Participação</th>
        <th class="n">Km rodados</th><th class="n">Km médio entre abast.</th><th class="n">Consumo médio</th><th class="n">Melhor / pior</th>
        <th class="n">Custo/km</th><th class="n">Preço médio/L</th><th class="n">Km no período</th><th>Quem mais usou</th>
      </tr></thead>
      <tbody>${report.trucks
        .map(
          (x) => `<tr>
            <td><b>${escapeHtml(x.plate)}</b>${x.label ? `<br><span class="muted small">${escapeHtml(x.label)}</span>` : ""}</td>
            <td class="n">${x.refuelings}</td><td class="n">${liters(x.liters)}</td><td class="n">${money(x.amount)}</td>
            <td>${bar(x.amount, maxTruck)}<span class="small">${num(x.sharePct, 1)}%</span></td>
            <td class="n">${km(x.km)}</td><td class="n">${km(x.avgKmBetweenRefuelings)}</td><td class="n">${kml(x.avgKmPerLiter)}</td>
            <td class="n">${x.bestKmPerLiter != null ? `${num(x.bestKmPerLiter, 2)} / ${num(x.worstKmPerLiter!, 2)}` : "—"}</td>
            <td class="n">${x.costPerKm != null ? `R$ ${num(x.costPerKm, 3)}` : "—"}</td><td class="n">${perLiter(x.avgPricePerLiter)}</td>
            <td class="n">${num(x.firstKm)} → ${num(x.lastKm)}</td>
            <td>${x.topDriver ? `${escapeHtml(x.topDriver.name)} (${x.topDriver.refuelings})` : "—"}${x.drivers > 1 ? `<br><span class="muted small">${x.drivers} motoristas</span>` : ""}</td>
          </tr>`
        )
        .join("")}</tbody>
      <tfoot><tr>
        <th>Total</th><th class="n">${t.refuelings}</th><th class="n">${liters(t.liters)}</th><th class="n">${money(t.amount)}</th><th>100%</th>
        <th class="n">${km(t.km)}</th><th></th><th class="n">${kml(t.avgKmPerLiter)}</th><th></th>
        <th class="n">${t.costPerKm != null ? `R$ ${num(t.costPerKm, 3)}` : "—"}</th><th class="n">${perLiter(t.avgPricePerLiter)}</th><th></th><th></th>
      </tr></tfoot>
    </table>

    <h2>Por motorista (quem mais utilizou)</h2>
    <table>
      <thead><tr><th>Motorista</th><th class="n">Abast.</th><th></th><th class="n">Litros</th><th class="n">Gasto</th><th class="n">% do gasto</th><th class="n">Km rodados</th><th class="n">Consumo médio</th><th>Caminhões</th></tr></thead>
      <tbody>${report.drivers
        .map(
          (x) => `<tr>
            <td><b>${escapeHtml(x.name)}</b></td><td class="n">${x.refuelings}</td><td>${bar(x.refuelings, maxDriver)}</td>
            <td class="n">${liters(x.liters)}</td><td class="n">${money(x.amount)}</td><td class="n">${num(x.sharePct, 1)}%</td>
            <td class="n">${km(x.km)}</td><td class="n">${kml(x.avgKmPerLiter)}</td><td>${x.trucks.map(escapeHtml).join(", ")}</td>
          </tr>`
        )
        .join("")}</tbody>
    </table>

    <h2>Dias com mais abastecimento</h2>
    <table>
      <thead><tr><th>Dia</th><th class="n">Abast.</th><th class="n">Litros</th><th class="n">Gasto</th></tr></thead>
      <tbody>${report.topDays
        .map((x) => `<tr><td>${dayLabel(x.date)} (${weekdayOf(x.date)})</td><td class="n">${x.refuelings}</td><td class="n">${liters(x.liters)}</td><td class="n">${money(x.amount)}</td></tr>`)
        .join("")}</tbody>
    </table>

    <h2>Por dia da semana</h2>
    <table>
      <thead><tr><th>Dia</th><th class="n">Abast.</th><th class="n">Litros</th><th class="n">Gasto</th><th></th></tr></thead>
      <tbody>${report.weekdays
        .map((x) => `<tr><td>${x.label}</td><td class="n">${x.refuelings}</td><td class="n">${liters(x.liters)}</td><td class="n">${money(x.amount)}</td><td>${bar(x.amount, maxWeekday)}</td></tr>`)
        .join("")}</tbody>
    </table>

    <h2>Gasto por dia</h2>
    <table>
      <thead><tr><th>Dia</th><th class="n">Abast.</th><th class="n">Litros</th><th class="n">Gasto</th><th></th></tr></thead>
      <tbody>${report.days
        .map(
          (x) => `<tr><td>${dayLabel(x.date)} (${weekdayOf(x.date)})</td><td class="n">${x.refuelings}</td><td class="n">${liters(x.liters)}</td><td class="n">${money(x.amount)}</td><td>${bar(x.amount, maxDay)}</td></tr>`
        )
        .join("")}</tbody>
    </table>

    <h2>Pontos de atenção</h2>
    ${
      report.alerts.length
        ? `<table><thead><tr><th>Data</th><th>Caminhão</th><th>Motorista</th><th>Observação</th></tr></thead><tbody>${report.alerts
            .map((a) => `<tr class="alert"><td>${dateTime(a.date)}</td><td>${escapeHtml(a.plate)}</td><td>${escapeHtml(a.driver)}</td><td>${escapeHtml(a.message)}</td></tr>`)
            .join("")}</tbody></table>`
        : `<p class="muted">Nenhum consumo fora do padrão, preço acima da média ou leitura de km inconsistente no período.</p>`
    }

    <h2>Todos os abastecimentos do período</h2>
    <table>
      <thead><tr><th>Data</th><th>Caminhão</th><th>Motorista</th><th class="n">Km</th><th class="n">Km desde o anterior</th><th class="n">Litros</th><th class="n">R$/L</th><th class="n">Valor</th><th class="n">Consumo</th></tr></thead>
      <tbody>${report.entries
        .map(
          (e) => `<tr><td>${dateTime(e.date)}</td><td>${escapeHtml(e.plate)}</td><td>${escapeHtml(e.driver)}</td><td class="n">${num(e.currentKm)}</td>
            <td class="n">${km(e.kmSincePrevious)}</td><td class="n">${liters(e.liters)}</td><td class="n">${perLiter(e.pricePerLiter)}</td><td class="n">${money(e.amount)}</td><td class="n">${kml(e.kmPerLiter)}</td></tr>`
        )
        .join("")}</tbody>
    </table>
    <p class="muted small" style="margin-top:14px">
      Km rodados = km do abastecimento − km do abastecimento anterior do mesmo caminhão (o primeiro de cada caminhão usa o último antes do período ou o km de início da pilotagem).
      Consumo = km rodados ÷ litros abastecidos. Abastecimentos com km menor que o anterior ficam fora das médias de consumo.
    </p>
  `;

  openPrintableReport(title, body);
}
