// Espelha src/lib/constants.ts do backendmecanic — mudar em um lado exige mudar no outro.

export const SERVICE_ORDER_STATUSES = [
  "SCHEDULED",
  "RECEIVED",
  "AWAITING_DIAGNOSIS",
  "DIAGNOSIS_DONE",
  "AWAITING_APPROVAL",
  "PARTS_REQUESTED",
  "PARTS_RECEIVED",
  "IN_PROGRESS",
  "TESTING",
  "WASHING",
  "FINISHED",
  "READY_FOR_PICKUP",
] as const;
export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

export const STATUS_LABELS: Record<ServiceOrderStatus, string> = {
  SCHEDULED: "Agendado — aguardando veículo",
  RECEIVED: "Veículo recebido",
  AWAITING_DIAGNOSIS: "Aguardando diagnóstico",
  DIAGNOSIS_DONE: "Diagnóstico concluído",
  AWAITING_APPROVAL: "Aguardando aprovação",
  PARTS_REQUESTED: "Peças solicitadas",
  PARTS_RECEIVED: "Peças recebidas",
  IN_PROGRESS: "Manutenção em andamento",
  TESTING: "Testes",
  WASHING: "Lavagem",
  FINISHED: "Finalizado",
  READY_FOR_PICKUP: "Pronto para retirada",
};

// Tom visual de cada status: neutro (recebido), info (em progresso), alerta (parado
// esperando o cliente) ou sucesso (concluído) — mesma regra de 4 cores do dashboard.
export const STATUS_TONE: Record<ServiceOrderStatus, "muted" | "info" | "warn" | "ok"> = {
  SCHEDULED: "warn",
  RECEIVED: "muted",
  AWAITING_DIAGNOSIS: "info",
  DIAGNOSIS_DONE: "info",
  AWAITING_APPROVAL: "warn",
  PARTS_REQUESTED: "info",
  PARTS_RECEIVED: "info",
  IN_PROGRESS: "info",
  TESTING: "info",
  WASHING: "info",
  FINISHED: "ok",
  READY_FOR_PICKUP: "ok",
};

export type PartStatus = "NOT_INSPECTED" | "IN_PROGRESS" | "WARNING" | "CRITICAL" | "DONE";

export const PART_STATUS_LABELS: Record<PartStatus, string> = {
  NOT_INSPECTED: "Não inspecionado",
  IN_PROGRESS: "Em andamento",
  WARNING: "Aguardando aprovação",
  CRITICAL: "Problema encontrado",
  DONE: "Concluído",
};

export const PART_STATUS_TONE: Record<PartStatus, "muted" | "info" | "warn" | "ok" | "crit"> = {
  NOT_INSPECTED: "muted",
  IN_PROGRESS: "info",
  WARNING: "warn",
  CRITICAL: "crit",
  DONE: "ok",
};

export interface User {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "MECHANIC" | "ADMIN";
  phone?: string | null;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  engine?: string | null;
  plate?: string | null;
  mileage: number;
}

export interface Media {
  id: string;
  url: string;
  type: "PHOTO" | "VIDEO" | "AUDIO" | "DOCUMENT";
  label?: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string | null;
  occurredAt: string;
  done: boolean;
  media: Media[];
  author?: { name: string } | null;
}

export interface VehiclePart {
  id: string;
  key: string;
  name: string;
  status: PartStatus;
  note?: string | null;
  wearLevel?: number | null;
  warranty?: string | null;
  updatedAt: string;
  responsible?: { name: string } | null;
  media: Media[];
}

export interface Approval {
  id: string;
  title: string;
  description: string;
  estimatedValue?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  responseNote?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  media: Media[];
}

export interface ServiceOrder {
  id: string;
  code: string;
  status: ServiceOrderStatus;
  progress: number;
  estimatedMin?: number | null;
  estimatedMax?: number | null;
  scheduledAt?: string | null;
  receivedAt: string;
  completedAt?: string | null;
  vehicle: Vehicle;
  timelineEvents: TimelineEvent[];
  parts: VehiclePart[];
  approvals: Approval[];
  media: Media[];
}

export type QuoteRequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface QuoteRequest {
  id: string;
  problemDescription: string;
  preferredDates: string;
  status: QuoteRequestStatus;
  scheduledAt?: string | null;
  initialValue?: number | null;
  declineReason?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  customer: { id: string; name: string; email: string; phone?: string | null };
  mechanic?: { id: string; name: string } | null;
  vehicle: Vehicle;
  serviceOrder?: { id: string; code: string; status: ServiceOrderStatus } | null;
}
