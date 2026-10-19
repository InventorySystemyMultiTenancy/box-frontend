/** Hoje no fuso local, no formato do <input type="date"> ("2026-10-07"). */
export function todayInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * Data escolhida no formulário de "Pagar"/"Receber": se for hoje, não envia nada (o servidor
 * grava o momento exato); senão envia só a data — o servidor guarda ao meio-dia dela.
 */
export function settlementDateParam(value: string) {
  return value && value !== todayInputValue() ? value : undefined;
}

/**
 * Data gravada (ISO) -> valor do <input type="date"> no fuso local. Não dá para só cortar o
 * texto: o prazo de 20/10 fica gravado como 20/10 23:59 de Brasília, que em UTC já é 21/10.
 */
export function toLocalDateInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
