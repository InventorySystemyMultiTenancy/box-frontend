// Mesmo padrão já usado em OrderDetail.tsx (generateServicePdf): monta um HTML simples,
// abre um popup e chama window.print() — o usuário salva como PDF pelo diálogo de
// impressão do navegador. Não há nenhuma lib de PDF no projeto, então esse é o único
// mecanismo usado — aqui só uma versão compartilhada pras telas novas do financeiro.
export function openPrintableReport(title: string, bodyHtml: string) {
  const popup = window.open("", "_blank", "width=960,height=720");
  if (!popup) return;

  popup.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; margin: 32px; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          h2 { margin-top: 26px; font-size: 16px; }
          .muted { color: #555; font-size: 13px; }
          .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 18px; margin-top: 18px; }
          .box { border: 1px solid #ddd; padding: 10px; border-radius: 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #f4f4f4; }
          .total { margin-top: 18px; text-align: right; font-size: 18px; font-weight: 700; }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
    </html>
  `);
  popup.document.close();
  popup.focus();
  popup.print();
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatCurrencyBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
