// PDFs do sistema (projeto, relatórios, exportações): monta um HTML simples e abre o
// diálogo de impressão do navegador, onde o usuário salva como PDF. Não há lib de PDF no
// projeto, então esse é o único mecanismo.
//
// Tudo acontece NA MESMA ABA, num quadro invisível: antes abria uma aba nova, e no app
// instalado no celular (atalho na tela inicial) essa aba abria no navegador comum, sem o
// login — voltar não levava de volta ao site logado. Também não sofre bloqueio de pop-up.
export function printHtml(fullHtmlDocument: string) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);

  const win = frame.contentWindow;
  const doc = frame.contentDocument ?? win?.document;
  if (!win || !doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(fullHtmlDocument);
  doc.close();

  // Espera a logo carregar antes de imprimir — chamar print() logo em seguida tira a imagem
  // do PDF na maioria das vezes. Timeout como rede de segurança caso o load nunca dispare.
  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    win.focus();
    win.print();
    // O quadro some depois da impressão (ou, se o evento não vier, depois de um tempo).
    const cleanup = () => setTimeout(() => frame.remove(), 1000);
    win.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(() => frame.remove(), 5 * 60 * 1000);
  };
  const images = Array.from(doc.images);
  if (images.length === 0 || images.every((img) => img.complete)) setTimeout(doPrint, 50);
  else images.forEach((img) => img.addEventListener("load", () => images.every((i) => i.complete) && doPrint()));
  setTimeout(doPrint, 1500);
}

export function openPrintableReport(title: string, bodyHtml: string) {
  printHtml(`
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
