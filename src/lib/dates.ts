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
