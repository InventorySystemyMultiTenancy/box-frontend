// Link wa.me — abre o WhatsApp Web (computador) ou o app (celular) automaticamente,
// já com o número do cliente e a mensagem preenchidos. Não envia nada por conta
// própria: só monta a URL, quem manda é o próprio usuário clicando em "Enviar".
export function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Sem DDI (código do país) — assume Brasil (55), único mercado deste sistema.
  if (digits.length <= 11) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
