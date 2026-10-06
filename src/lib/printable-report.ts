// Mesmo padrão já usado em OrderDetail.tsx (generateServicePdf): monta um HTML simples,
// abre um popup e chama window.print() — o usuário salva como PDF pelo diálogo de
// impressão do navegador. Não há nenhuma lib de PDF no projeto, então esse é o único
// mecanismo usado — aqui só uma versão compartilhada pras telas novas do financeiro.
/**
 * Quando o conteúdo depende de buscar dados antes, abra a janela já no clique com
 * openReportWindow() e passe-a aqui — window.open depois de um await costuma ser
 * bloqueado como pop-up pelo navegador.
 */
export function openReportWindow() {
  const popup = window.open("", "_blank", "width=960,height=720");
  popup?.document.write('<p style="font-family: Arial, sans-serif; margin: 32px">Gerando relatório...</p>');
  return popup;
}

export function openPrintableReport(title: string, bodyHtml: string, existingPopup?: Window | null) {
  const popup = existingPopup ?? window.open("", "_blank", "width=960,height=720");
  if (!popup) return;
  popup.document.open();

  popup.document.write(`
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; margin: 32px; }
          .brand { margin-bottom: 18px; }
          .brand img { height: 40px; }
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
        <div class="brand"><img src="${window.location.origin}/reblind-logo-transparent.png" alt="Reblind" /></div>
        ${bodyHtml}
      </body>
    </html>
  `);
  popup.document.close();
  // Espera a logo carregar antes de imprimir — chamar print() logo em seguida (sem
  // esperar) tira a imagem do PDF na maioria das vezes, já que ela ainda não terminou
  // de carregar. Timeout como rede de segurança caso o load nunca dispare.
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    popup.focus();
    popup.print();
  };
  popup.onload = doPrint;
  setTimeout(doPrint, 1200);
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
