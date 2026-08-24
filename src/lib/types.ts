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
  IN_PROGRESS: "Reparação em andamento",
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
  roleId?: string | null;
  phone?: string | null;
  commissionRate?: number | null;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  year: number;
  engine?: string | null;
  plate?: string | null;
  mileage: number;
  owner?: { id: string; name: string; email?: string; phone?: string | null };
}

export interface Media {
  id: string;
  url: string;
  type: "PHOTO" | "VIDEO" | "AUDIO" | "DOCUMENT";
  label?: string | null;
  isDeliveryPhoto?: boolean;
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
  warrantyMonths?: number | null;
  warrantyStartAt?: string | null;
  warrantyExpiresAt?: string | null;
  updatedAt: string;
  responsible?: { name: string } | null;
  media: Media[];
}

export interface ExpiringWarrantyPart extends VehiclePart {
  serviceOrder: {
    id: string;
    code: string;
    vehicle: { id: string; brand: string; model: string; plate?: string | null; owner: { id: string; name: string; phone?: string | null } };
  };
}

export interface Approval {
  id: string;
  partId?: string | null;
  title: string;
  description: string;
  note?: string | null;
  laborValue?: number | null;
  partsValue?: number | null;
  estimatedValue?: number | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  responseNote?: string | null;
  stockAppliedAt?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  media: Media[];
  partUsages?: ProblemPartUsage[];
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
  deliveryDescription?: string | null;
  deliveryExtraValue?: number | null;
  vehicle: Vehicle;
  timelineEvents: TimelineEvent[];
  parts: VehiclePart[];
  approvals: Approval[];
  media: Media[];

  // Gaps SIGMA (Fase 1) — todos opcionais para não quebrar telas que já consomem ServiceOrder.
  consultantId?: string | null;
  consultant?: { id: string; name: string } | null;
  estimatorId?: string | null;
  estimator?: { id: string; name: string } | null;
  technicianId?: string | null;
  technician?: { id: string; name: string } | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  deliveryForecastAt?: string | null;
  deliveryForecastReason?: string | null;
  currentSectorId?: string | null;
  currentSector?: Sector | null;
  insuranceCompanyId?: string | null;
  insuranceCompany?: InsuranceCompany | null;
  claimNumber?: string | null;
  deductibleAmount?: number | null;
  serviceType?: string | null;
  authorizationNumber?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// --- Gaps SIGMA (fases 1-8) -------------------------------------------------

export const SERVICE_ORDER_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type ServiceOrderPriority = (typeof SERVICE_ORDER_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<ServiceOrderPriority, string> = {
  LOW: "Baixa",
  NORMAL: "Normal",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export interface InsuranceCompany {
  id: string;
  legalName: string;
  tradeName?: string | null;
  cnpj?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  email?: string | null;
  contactName?: string | null;
  accredited: boolean;
  active: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface Sector {
  id: string;
  name: string;
  storeId?: string | null;
  isSystem: boolean;
  active: boolean;
}

export interface ServiceCatalogItem {
  id: string;
  code?: string | null;
  category?: string | null;
  name: string;
  description?: string | null;
  standardTimeMin?: number | null;
  hourlyRate?: number | null;
  standardPrice?: number | null;
  sector?: string | null;
  active: boolean;
}

export const ESTIMATE_STATUSES = [
  "DRAFT",
  "AWAITING_APPROVAL",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "SUPPLEMENT_REQUESTED",
  "CANCELLED",
  "CONVERTED",
] as const;
export type EstimateStatus = (typeof ESTIMATE_STATUSES)[number];

export const ESTIMATE_STATUS_LABELS: Record<EstimateStatus, string> = {
  DRAFT: "Rascunho",
  AWAITING_APPROVAL: "Aguardando aprovação",
  APPROVED: "Aprovado",
  PARTIALLY_APPROVED: "Parcialmente aprovado",
  REJECTED: "Recusado",
  SUPPLEMENT_REQUESTED: "Complemento solicitado",
  CANCELLED: "Cancelado",
  CONVERTED: "Convertido em OS",
};

export interface EstimateItem {
  id: string;
  description: string;
  classification: "REPAIR" | "REPLACE" | "REUSE" | "PENDING";
  quantity: number;
  unitValue: number;
  totalValue: number;
  approvalId?: string | null;
}

export interface Estimate {
  id: string;
  code: string;
  serviceOrderId: string;
  serviceOrder?: { id: string; code: string; vehicle: Vehicle };
  insuranceCompanyId?: string | null;
  insuranceCompany?: InsuranceCompany | null;
  status: EstimateStatus;
  validUntil?: string | null;
  laborTotal: number;
  partsTotal: number;
  materialsTotal: number;
  thirdPartyTotal: number;
  discountAmount: number;
  taxAmount: number;
  deductibleAmount: number;
  totalAmount: number;
  notes?: string | null;
  items: EstimateItem[];
  createdAt: string;
}

export const INSPECTION_STATUSES = ["TO_SCHEDULE", "SCHEDULED", "DONE", "RESCHEDULED", "CANCELLED", "ADJUSTMENT_PENDING"] as const;
export type InspectionStatus = (typeof INSPECTION_STATUSES)[number];

export const INSPECTION_STATUS_LABELS: Record<InspectionStatus, string> = {
  TO_SCHEDULE: "A marcar",
  SCHEDULED: "Marcada",
  DONE: "Realizada",
  RESCHEDULED: "Reagendada",
  CANCELLED: "Cancelada",
  ADJUSTMENT_PENDING: "Pendente de ajuste",
};

export interface InspectionIssue {
  id: string;
  item: string;
  description?: string | null;
  responsible?: { id: string; name: string } | null;
  dueDate?: string | null;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
}

export interface Inspection {
  id: string;
  serviceOrder: { id: string; code: string; vehicle: Vehicle };
  insuranceCompany?: InsuranceCompany | null;
  inspector?: { id: string; name: string } | null;
  scheduledAt?: string | null;
  location?: string | null;
  type?: string | null;
  status: InspectionStatus;
  result?: string | null;
  notes?: string | null;
  issues: InspectionIssue[];
}

export interface PendingSupplement {
  id: string;
  title: string;
  description: string;
  justification?: string | null;
  extraHours?: number | null;
  estimatedValue?: number | null;
  createdAt: string;
  daysWaiting: number;
  overdue: boolean;
  serviceOrder: { id: string; code: string; status: ServiceOrderStatus };
  vehicle: { brand: string; model: string; plate?: string | null };
  owner?: { id: string; name: string } | null;
  insuranceCompany?: { id: string; tradeName: string } | null;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  employee?: { id: string; name: string };
  serviceOrderId?: string | null;
  serviceOrder?: { id: string; code: string } | null;
  serviceId?: string | null;
  service?: { id: string; name: string; standardTimeMin?: number | null } | null;
  sector?: string | null;
  startedAt: string;
  endedAt?: string | null;
  pausedMinutes: number;
  status: "RUNNING" | "PAUSED" | "DONE";
  notes?: string | null;
}

export interface CapacityPanel {
  byEmployee: { employeeId: string; name: string; weeklyHours: number; allocatedHours: number; freeHours: number }[];
  bySector: { sector: string; allocatedHours: number }[];
}

export interface AppNotification {
  id: string;
  type: string;
  entity?: string | null;
  entityId?: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  before?: string | null;
  after?: string | null;
  user?: { id: string; name: string } | null;
  createdAt: string;
}

export interface InventoryPart {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  unitCost: number;
  stockQty: number;
  minStockQty: number;
  reorderQty: number;
  preferredSupplierId?: string | null;
  photoUrl?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemPartUsage {
  id: string;
  inventoryPartId: string;
  quantity: number;
  unitCostSnapshot: number;
  inventoryPart: InventoryPart;
}

export interface FinancialEntry {
  id: string;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
  amount: number;
  occurredAt: string;
  createdAt: string;
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string | null;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isSystem: boolean;
  createdAt: string;
  _count?: { users: number };
}

export interface Client {
  id: string;
  userId?: string | null;
  name: string;
  cpfCnpj?: string | null;
  rg?: string | null;
  birthDate?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  addressLine?: string | null;
  zipCode?: string | null;
  city?: string | null;
  state?: string | null;
  company?: string | null;
  clientType: "INDIVIDUAL" | "COMPANY";
  notes?: string | null;
  internalNotes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// Versões resumidas — o endpoint de detalhe do cliente não inclui os relacionamentos
// aninhados completos (timeline, peças, aprovações) que o ServiceOrder/QuoteRequest
// completos têm, só os campos próprios da OS/solicitação.
export interface ClientServiceOrderSummary {
  id: string;
  code: string;
  status: ServiceOrderStatus;
  progress: number;
  receivedAt: string;
  completedAt?: string | null;
  vehicleId: string;
}

export interface ClientQuoteRequestSummary {
  id: string;
  problemDescription: string;
  status: QuoteRequestStatus;
  scheduledAt?: string | null;
  createdAt: string;
  vehicleId: string;
}

export interface ClientDetail extends Client {
  vehicles: Vehicle[];
  serviceOrders: ClientServiceOrderSummary[];
  quoteRequests: ClientQuoteRequestSummary[];
  totalSpent: number;
  lastVisit?: string | null;
}

// Financeiro
export interface BankAccount {
  id: string;
  name: string;
  bank?: string | null;
  agency?: string | null;
  accountNumber?: string | null;
  initialBalance: number;
  currentBalance: number;
  active: boolean;
}

export type PayableStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";
export type ReceivableStatus = "PENDING" | "RECEIVED" | "OVERDUE" | "CANCELLED";

export interface AccountPayable {
  id: string;
  description: string;
  category: string;
  payeeName: string;
  amount: number;
  dueDate: string;
  paidAt?: string | null;
  paidAmount?: number | null;
  status: PayableStatus;
  paymentMethod?: string | null;
  bankAccountId?: string | null;
  bankAccount?: BankAccount | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  notes?: string | null;
}

export interface AccountReceivable {
  id: string;
  description: string;
  category: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  serviceOrderId?: string | null;
  serviceOrder?: { id: string; code: string } | null;
  amount: number;
  dueDate: string;
  receivedAt?: string | null;
  receivedAmount?: number | null;
  status: ReceivableStatus;
  paymentMethod?: string | null;
  bankAccountId?: string | null;
  bankAccount?: BankAccount | null;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  notes?: string | null;
}

export interface CashFlowTimelinePoint {
  date: string;
  in: number;
  out: number;
  balance: number;
}

export interface CashFlow {
  initialBalance: number;
  totalIn: number;
  totalOut: number;
  finalBalance: number;
  timeline: CashFlowTimelinePoint[];
}

export interface DRE {
  grossRevenue: number;
  totalExpenses: number;
  netResult: number;
  revenueByCategory: { category: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
}

// Fiscal
export type InvoiceType = "NFE" | "NFSE" | "NFCE";
export type InvoiceStatus = "DRAFT" | "PENDING" | "ISSUED" | "CANCELLED" | "ERROR";

export interface Invoice {
  id: string;
  type: InvoiceType;
  status: InvoiceStatus;
  number?: string | null;
  series?: string | null;
  accessKey?: string | null;
  operationNature?: string | null;
  provider: string;
  issuerName?: string | null;
  issuerDocument?: string | null;
  recipientName?: string | null;
  recipientDocument?: string | null;
  paymentMethod?: string | null;
  description?: string | null;
  totalAmount: number;
  discountAmount?: number | null;
  taxAmount?: number | null;
  issueDate?: string | null;
  cancelledAt?: string | null;
  errorMessage?: string | null;
  client?: { id: string; name: string } | null;
  serviceOrder?: { id: string; code: string } | null;
  createdAt: string;
}

export interface ExtractedInvoiceData {
  type: InvoiceType;
  number: string | null;
  series: string | null;
  accessKey: string | null;
  operationNature: string | null;
  issuerName: string | null;
  issuerDocument: string | null;
  recipientName: string | null;
  recipientDocument: string | null;
  paymentMethod: string | null;
  description: string;
  totalAmount: number | null;
  discountAmount: number | null;
  taxAmount: number | null;
  issueDate: string | null;
}

// Compras e fornecedores
export interface Supplier {
  id: string;
  name: string;
  cpfCnpj?: string | null;
  contactName?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
}

export type PurchaseOrderStatus = "DRAFT" | "SENT" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";

export interface PurchaseOrderItem {
  id: string;
  inventoryPartId: string;
  inventoryPart: InventoryPart;
  quantity: number;
  unitCost: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  supplier: Supplier;
  status: PurchaseOrderStatus;
  notes?: string | null;
  expectedDate?: string | null;
  sentAt?: string | null;
  createdAt: string;
  items: PurchaseOrderItem[];
}

export interface ReplenishmentSuggestion extends InventoryPart {
  suggestedQty: number;
  preferredSupplier?: Supplier | null;
}

// Agenda
export type BayType = "BAY" | "LIFT";

export interface Bay {
  id: string;
  name: string;
  type: BayType;
  active: boolean;
}

export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "DONE" | "CANCELLED" | "NO_SHOW";

export interface Appointment {
  id: string;
  title: string;
  vehicleId?: string | null;
  vehicle?: Vehicle | null;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  serviceOrderId?: string | null;
  serviceOrder?: { id: string; code: string; status: string } | null;
  mechanicId?: string | null;
  mechanic?: { id: string; name: string } | null;
  bayId?: string | null;
  bay?: Bay | null;
  startAt: string;
  estimatedDurationMin: number;
  status: AppointmentStatus;
  notes?: string | null;
}

export interface MechanicWorkload {
  mechanicId: string;
  mechanicName: string;
  appointments: number;
  totalMinutes: number;
}

export interface BayOccupancy {
  bay: Bay;
  appointments: Appointment[];
}

// PDV / Balcão
export type CounterSaleStatus = "COMPLETED" | "CANCELLED";

export interface CounterSaleItem {
  id: string;
  inventoryPartId: string;
  inventoryPart: InventoryPart;
  quantity: number;
  unitPrice: number;
}

export interface CounterSale {
  id: string;
  code: string;
  clientId?: string | null;
  client?: { id: string; name: string } | null;
  customerName?: string | null;
  status: CounterSaleStatus;
  paymentMethod?: string | null;
  bankAccountId?: string | null;
  bankAccount?: BankAccount | null;
  totalAmount: number;
  createdAt: string;
  cancelledAt?: string | null;
  items: CounterSaleItem[];
}

// Relatórios / Dashboard
export interface DashboardReport {
  revenue: { total: number; count: number; ticketMedio: number };
  approvalStats: { approved: number; rejected: number; total: number; rate: number };
  quoteStats: { accepted: number; declined: number; total: number; rate: number };
  mechanicProductivity: { mechanicId: string; mechanicName: string; completedParts: number }[];
  turnover: { cogs: number; inventoryValue: number; turnoverRatio: number };
  lowStock: number;
}

// Histórico de veículo
export interface VehicleHistory {
  vehicle: { id: string; brand: string; model: string; year: number; plate?: string | null; mileage: number; owner: { id: string; name: string; phone?: string | null } };
  serviceOrders: ClientServiceOrderSummary[];
  totalSpent: number;
  lastServiceAt?: string | null;
  monthsSinceLastService: number | null;
  revisionDue: boolean;
}

export interface RevisionAlert {
  vehicle: { id: string; brand: string; model: string; year: number; plate?: string | null };
  owner: { id: string; name: string; phone?: string | null };
  lastServiceAt: string;
  monthsSinceLastService: number;
}

// Comissão de mecânico
export type CommissionStatus = "PENDING" | "PAID" | "CANCELLED";

export interface Commission {
  id: string;
  mechanicId: string;
  mechanic: { id: string; name: string; commissionRate?: number | null };
  approvalId: string;
  approval: { id: string; title: string; estimatedValue?: number | null };
  serviceOrderId: string;
  serviceOrder: { id: string; code: string };
  baseAmount: number;
  rate: number;
  amount: number;
  status: CommissionStatus;
  paidAt?: string | null;
  createdAt: string;
}

// Lojas (multi-loja)
export interface Store {
  id: string;
  name: string;
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  active: boolean;
}

export type QuoteRequestStatus = "PENDING" | "ACCEPTED" | "DECLINED";

export interface QuoteRequest {
  id: string;
  problemDescription: string;
  problemKey?: string | null;
  problemName?: string | null;
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
