import { ServiceOrderStatus, STATUS_LABELS } from "@/lib/types";

// Textos prontos das mensagens de WhatsApp — o envio continua manual (link wa.me, ver
// whatsapp.ts). Ficam num lugar só pra manter o mesmo tom e facilitar trocar por um envio
// automático (API de WhatsApp) no futuro: bastaria chamar essas mesmas funções no backend.

interface OrderForMessage {
  code: string;
  status: ServiceOrderStatus;
  vehicle: { brand: string; model: string; owner?: { name: string } | null };
}

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

const STATUS_TEXT: Partial<Record<ServiceOrderStatus, string>> = {
  SCHEDULED: "está agendado com a gente. Te esperamos no horário combinado!",
  RECEIVED: "chegou na oficina e já está na fila de atendimento.",
  AWAITING_DIAGNOSIS: "está aguardando o diagnóstico da nossa equipe.",
  DIAGNOSIS_DONE: "já foi diagnosticado. Em breve enviamos o orçamento para sua aprovação.",
  IN_PROGRESS: "está em reparo agora.",
  TESTING: "está na fase de testes — falta pouco!",
  FINISHED: "teve o serviço finalizado e está passando pela conferência final.",
  READY_FOR_PICKUP: "está PRONTO para retirada! 🚗✅",
};

/** Mensagem de acompanhamento de etapa (usada ao avançar etapa e no botão "Avisar cliente"). */
export function statusUpdateMessage(order: OrderForMessage, trackingUrl: string) {
  const name = firstName(order.vehicle.owner?.name);
  const what = STATUS_TEXT[order.status] ?? `está na etapa "${STATUS_LABELS[order.status]}".`;
  return [
    `Olá${name ? `, ${name}` : ""}! Aqui é da Reblind.`,
    `Seu ${order.vehicle.brand} ${order.vehicle.model} (OS ${order.code}) ${what}`,
    `Acompanhe fotos e o andamento em tempo real: ${trackingUrl}`,
  ].join("\n\n");
}

export function revisionReminderMessage(ownerName: string, vehicle: string, months: number) {
  return [
    `Olá, ${firstName(ownerName)}! Aqui é da Reblind.`,
    `Já faz ${months} meses desde a última revisão do seu ${vehicle}. Que tal agendar uma revisão preventiva? Evita surpresas e mantém o carro seguro.`,
    "É só responder esta mensagem que a gente marca o melhor horário pra você.",
  ].join("\n\n");
}

export function warrantyReminderMessage(ownerName: string, vehicle: string, partName: string, expiresAt: Date) {
  const expired = expiresAt.getTime() < Date.now();
  const date = expiresAt.toLocaleDateString("pt-BR");
  return [
    `Olá, ${firstName(ownerName)}! Aqui é da Reblind.`,
    expired
      ? `A garantia do serviço de ${partName} do seu ${vehicle} venceu em ${date}.`
      : `A garantia do serviço de ${partName} do seu ${vehicle} vence em ${date}.`,
    "Se notou qualquer coisa diferente, traga o carro para uma checagem antes do vencimento. É só responder esta mensagem.",
  ].join("\n\n");
}
