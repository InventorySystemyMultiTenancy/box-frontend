// Formas de pagamento oferecidas na entrega da OS. O campo no banco continua texto livre
// (PDV/contas a pagar/receber aceitam qualquer valor) — isto só padroniza a escolha.
export const PAYMENT_METHODS = ["PIX", "Dinheiro", "Cartão de débito", "Cartão de crédito", "Boleto", "Transferência"] as const;

// Formas que normalmente são pagas na hora — já sugerem "recebido agora".
export const PAID_ON_THE_SPOT = new Set<string>(["PIX", "Dinheiro", "Cartão de débito"]);
