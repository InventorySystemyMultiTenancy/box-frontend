const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error || "Não foi possível completar a solicitação.", res.status);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: { id: string; name: string; email: string; role: string } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  registerCustomer: (payload: { name: string; email: string; password: string; phone?: string }) =>
    request<{ token: string; user: { id: string; name: string; email: string; role: string } }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  users: (token: string) => request<{ users: unknown[] }>("/api/auth/users", {}, token),

  createUser: (
    payload: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      role: "CUSTOMER" | "MECHANIC" | "ADMIN";
      roleId?: string;
      commissionRate?: number;
    },
    token: string
  ) =>
    request<{ user: { id: string; name: string; email: string; role: string; roleId?: string | null; phone?: string | null; commissionRate?: number | null } }>(
      "/api/auth/users",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    ),

  updateUser: (
    id: string,
    payload: {
      name?: string;
      email?: string;
      password?: string;
      phone?: string | null;
      role?: "CUSTOMER" | "MECHANIC" | "ADMIN";
      roleId?: string | null;
      commissionRate?: number | null;
    },
    token: string
  ) =>
    request<{ user: unknown }>(
      `/api/auth/users/${id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token
    ),

  me: (token: string) =>
    request<{ user: { id: string; name: string; email: string; role: string; avatarUrl?: string | null } }>("/api/auth/me", {}, token),

  updateMyAvatar: (file: File, token: string) => {
    const form = new FormData();
    form.append("avatar", file);
    return request<{ user: { id: string; name: string; email: string; role: string; avatarUrl?: string | null } }>(
      "/api/auth/me/avatar",
      { method: "PATCH", body: form },
      token
    );
  },

  team: () => request<{ team: { id: string; name: string; role: string; avatarUrl: string | null }[] }>("/api/team"),

  serviceOrders: (token: string) => request<{ orders: unknown[] }>("/api/service-orders", {}, token),

  serviceOrder: (id: string, token: string) => request<{ order: unknown }>(`/api/service-orders/${id}`, {}, token),

  respondApproval: (orderId: string, approvalId: string, status: "APPROVED" | "REJECTED", token: string, responseNote?: string) =>
    request(`/api/service-orders/${orderId}/approvals/${approvalId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, responseNote }),
    }, token),

  // Avança a etapa da OS — usado pelo drag do Kanban (sem foto) e pelo botão
  // "Avançar etapa" dentro do projeto (com foto opcional documentando a etapa).
  updateOrderStatus: (orderId: string, status: string, token: string, photo?: File | null) => {
    if (photo) {
      const form = new FormData();
      form.append("status", status);
      form.append("photo", photo);
      return request<{ order: unknown; event: unknown }>(`/api/service-orders/${orderId}/status`, { method: "PATCH", body: form }, token);
    }
    return request<{ order: unknown; event: unknown }>(`/api/service-orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }, token);
  },

  createProblem: (
    orderId: string,
    payload: {
      key: string;
      name: string;
      description: string;
      wearLevel?: string;
      estimatedValue?: string;
      laborValue?: string;
      partUsages?: { inventoryPartId: string; quantity: number }[];
      files: File[];
    },
    token: string
  ) => {
    const form = new FormData();
    form.append("key", payload.key);
    form.append("name", payload.name);
    form.append("description", payload.description);
    if (payload.wearLevel) form.append("wearLevel", payload.wearLevel);
    if (payload.estimatedValue) form.append("estimatedValue", payload.estimatedValue);
    if (payload.laborValue) form.append("laborValue", payload.laborValue);
    if (payload.partUsages) form.append("partUsages", JSON.stringify(payload.partUsages));
    payload.files.forEach((file) => form.append("files", file));

    return request<{ part: unknown; approval: unknown; event: unknown }>(
      `/api/service-orders/${orderId}/parts/problems`,
      { method: "POST", body: form },
      token
    );
  },

  updateProblemDetails: (
    orderId: string,
    approvalId: string,
    payload: { note?: string; partUsages?: { inventoryPartId: string; quantity: number }[]; files?: File[] },
    token: string
  ) => {
    const form = new FormData();
    if (payload.note !== undefined) form.append("note", payload.note);
    if (payload.partUsages && payload.partUsages.length > 0) form.append("partUsages", JSON.stringify(payload.partUsages));
    (payload.files ?? []).forEach((file) => form.append("files", file));

    return request<{ approval: unknown; event: unknown }>(
      `/api/service-orders/${orderId}/parts/problems/${approvalId}/updates`,
      { method: "POST", body: form },
      token
    );
  },

  finalizeOrder: (
    orderId: string,
    payload: { description?: string; extraValue?: string; photo?: File | null },
    token: string
  ) => {
    const form = new FormData();
    if (payload.description) form.append("description", payload.description);
    if (payload.extraValue) form.append("extraValue", payload.extraValue);
    if (payload.photo) form.append("photo", payload.photo);

    return request<{ order: unknown }>(
      `/api/service-orders/${orderId}/finalize`,
      { method: "PATCH", body: form },
      token
    );
  },

  archiveServiceOrder: (orderId: string, token: string) =>
    request<{ order: unknown }>(`/api/service-orders/${orderId}/archive`, { method: "PATCH" }, token),

  resolvePart: (orderId: string, partId: string, token: string) =>
    request<{ part: unknown; event: unknown }>(
      `/api/service-orders/${orderId}/parts/${partId}/resolve`,
      { method: "POST" },
      token
    ),

  startPart: (orderId: string, partId: string, token: string) =>
    request<{ part: unknown; event: unknown; order: unknown }>(
      `/api/service-orders/${orderId}/parts/${partId}/start`,
      { method: "POST" },
      token
    ),

  priceProblem: (
    orderId: string,
    approvalId: string,
    payload: { name?: string; description?: string; laborValue: number; partUsages: { inventoryPartId: string; quantity: number }[] },
    token: string
  ) =>
    request<{ approval: unknown; part: unknown; event: unknown }>(
      `/api/service-orders/${orderId}/parts/problems/${approvalId}/pricing`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token
    ),

  inventoryParts: (token: string) => request<{ parts: unknown[] }>("/api/inventory-parts", {}, token),

  saveInventoryPart: (
    payload: { id?: string; name: string; sku?: string; description?: string; unitCost: string; stockQty: string; active?: boolean; photo?: File | null },
    token: string
  ) => {
    const form = new FormData();
    form.append("name", payload.name);
    if (payload.sku) form.append("sku", payload.sku);
    if (payload.description) form.append("description", payload.description);
    form.append("unitCost", payload.unitCost);
    form.append("stockQty", payload.stockQty);
    if (payload.active != null) form.append("active", String(payload.active));
    if (payload.photo) form.append("photo", payload.photo);
    return request<{ part: unknown }>(
      payload.id ? `/api/inventory-parts/${payload.id}` : "/api/inventory-parts",
      { method: payload.id ? "PATCH" : "POST", body: form },
      token
    );
  },

  financeSummary: (token: string) => request<{ summary: unknown; entries: unknown[] }>("/api/finance/summary", {}, token),

  createExpense: (payload: { category: string; description: string; amount: number; occurredAt?: string }, token: string) =>
    request<{ entry: unknown }>("/api/finance/expenses", { method: "POST", body: JSON.stringify(payload) }, token),

  quoteRequests: (token: string, status?: string) =>
    request<{ requests: unknown[] }>(`/api/quote-requests${status ? `?status=${status}` : ""}`, {}, token),

  createQuoteRequest: (
    payload: {
      vehicle: { brand: string; model: string; year: number; engine?: string; plate?: string; mileage?: number };
      problemKey?: string;
      problemName?: string;
      problemDescription: string;
      preferredDates: string;
    },
    token: string
  ) => request<{ request: unknown }>("/api/quote-requests", { method: "POST", body: JSON.stringify(payload) }, token),

  acceptQuoteRequest: (id: string, payload: { scheduledAt: string; initialValue?: number }, token: string) =>
    request<{ request: unknown }>(
      `/api/quote-requests/${id}/accept`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token
    ),

  declineQuoteRequest: (id: string, payload: { declineReason?: string }, token: string) =>
    request<{ request: unknown }>(
      `/api/quote-requests/${id}/decline`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token
    ),

  mePermissions: (token: string) => request<{ permissions: string[] }>("/api/auth/me/permissions", {}, token),

  clients: (token: string, params: { q?: string; page?: number; pageSize?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.page) search.set("page", String(params.page));
    if (params.pageSize) search.set("pageSize", String(params.pageSize));
    const qs = search.toString();
    return request<{ items: unknown[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>(
      `/api/clients${qs ? `?${qs}` : ""}`,
      {},
      token
    );
  },

  client: (id: string, token: string) => request<{ client: unknown }>(`/api/clients/${id}`, {}, token),

  createClient: (payload: Record<string, unknown>, token: string) =>
    request<{ client: unknown }>("/api/clients", { method: "POST", body: JSON.stringify(payload) }, token),

  updateClient: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ client: unknown }>(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  archiveClient: (id: string, token: string) =>
    request<void>(`/api/clients/${id}`, { method: "DELETE" }, token),

  roles: (token: string) => request<{ roles: unknown[] }>("/api/roles", {}, token),

  createRole: (payload: { name: string; description?: string }, token: string) =>
    request<{ role: unknown }>("/api/roles", { method: "POST", body: JSON.stringify(payload) }, token),

  deleteRole: (id: string, token: string) => request<void>(`/api/roles/${id}`, { method: "DELETE" }, token),

  rolePermissions: (id: string, token: string) =>
    request<{ permissions: unknown[] }>(`/api/roles/${id}/permissions`, {}, token),

  setRolePermissions: (id: string, permissionIds: string[], token: string) =>
    request<{ permissions: unknown[] }>(
      `/api/roles/${id}/permissions`,
      { method: "PUT", body: JSON.stringify({ permissionIds }) },
      token
    ),

  permissionCatalog: (token: string) => request<{ permissions: unknown[] }>("/api/permissions", {}, token),

  // Financeiro — contas bancárias
  bankAccounts: (token: string) => request<{ accounts: unknown[] }>("/api/finance/bank-accounts", {}, token),

  createBankAccount: (payload: Record<string, unknown>, token: string) =>
    request<{ account: unknown }>("/api/finance/bank-accounts", { method: "POST", body: JSON.stringify(payload) }, token),

  updateBankAccount: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ account: unknown }>(`/api/finance/bank-accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  archiveBankAccount: (id: string, token: string) =>
    request<void>(`/api/finance/bank-accounts/${id}`, { method: "DELETE" }, token),

  // Financeiro — contas a pagar
  payables: (
    token: string,
    params: {
      status?: string;
      category?: string;
      from?: string;
      to?: string;
      payeeName?: string;
      invoiceNumber?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ) => request<{ items: unknown[]; pagination: Pagination }>(`/api/finance/payables${toQuery(params)}`, {}, token),

  createPayables: (payload: Record<string, unknown>, token: string) =>
    request<{ installments: unknown[] }>("/api/finance/payables", { method: "POST", body: JSON.stringify(payload) }, token),

  payPayable: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ payable: unknown }>(`/api/finance/payables/${id}/pay`, { method: "POST", body: JSON.stringify(payload) }, token),

  cancelPayable: (id: string, token: string) =>
    request<{ payable: unknown }>(`/api/finance/payables/${id}/cancel`, { method: "POST" }, token),

  // Financeiro — contas a receber
  receivables: (token: string, params: { status?: string; category?: string; clientId?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; pagination: Pagination }>(`/api/finance/receivables${toQuery(params)}`, {}, token),

  createReceivables: (payload: Record<string, unknown>, token: string) =>
    request<{ installments: unknown[] }>("/api/finance/receivables", { method: "POST", body: JSON.stringify(payload) }, token),

  createReceivableFromServiceOrder: (payload: { serviceOrderId: string; dueDate: string }, token: string) =>
    request<{ receivable: unknown }>("/api/finance/receivables/from-service-order", { method: "POST", body: JSON.stringify(payload) }, token),

  receiveReceivable: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ receivable: unknown }>(`/api/finance/receivables/${id}/receive`, { method: "POST", body: JSON.stringify(payload) }, token),

  cancelReceivable: (id: string, token: string) =>
    request<{ receivable: unknown }>(`/api/finance/receivables/${id}/cancel`, { method: "POST" }, token),

  // Financeiro — fluxo de caixa e DRE
  cashFlow: (token: string, params: { from?: string; to?: string } = {}) =>
    request<{ cashFlow: unknown }>(`/api/finance/cash-flow${toQuery(params)}`, {}, token),

  dre: (token: string, params: { from?: string; to?: string } = {}) =>
    request<{ dre: unknown }>(`/api/finance/dre${toQuery(params)}`, {}, token),

  // Fiscal — notas fiscais
  invoices: (token: string, params: { status?: string; type?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; pagination: Pagination }>(`/api/invoices${toQuery(params)}`, {}, token),

  createInvoice: (payload: Record<string, unknown>, token: string) =>
    request<{ invoice: unknown }>("/api/invoices", { method: "POST", body: JSON.stringify(payload) }, token),

  extractInvoice: (photo: File, token: string) => {
    const form = new FormData();
    form.append("photo", photo);
    return request<{
      extracted: {
        type: "NFE" | "NFSE" | "NFCE";
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
      };
      clientId: string | null;
      clientName: string | null;
      clientCreated: boolean;
    }>("/api/invoices/extract", { method: "POST", body: form }, token);
  },

  issueInvoice: (id: string, token: string) =>
    request<{ invoice: unknown }>(`/api/invoices/${id}/issue`, { method: "POST" }, token),

  cancelInvoice: (id: string, token: string) =>
    request<{ invoice: unknown }>(`/api/invoices/${id}/cancel`, { method: "POST" }, token),

  // Fornecedores
  suppliers: (token: string, params: { q?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; pagination: Pagination }>(`/api/suppliers${toQuery(params)}`, {}, token),

  supplier: (id: string, token: string) => request<{ supplier: unknown }>(`/api/suppliers/${id}`, {}, token),

  createSupplier: (payload: Record<string, unknown>, token: string) =>
    request<{ supplier: unknown }>("/api/suppliers", { method: "POST", body: JSON.stringify(payload) }, token),

  updateSupplier: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ supplier: unknown }>(`/api/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  archiveSupplier: (id: string, token: string) =>
    request<void>(`/api/suppliers/${id}`, { method: "DELETE" }, token),

  // Compras
  purchaseOrders: (token: string, params: { status?: string; supplierId?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; pagination: Pagination }>(`/api/purchase-orders${toQuery(params)}`, {}, token),

  purchaseOrder: (id: string, token: string) => request<{ order: unknown }>(`/api/purchase-orders/${id}`, {}, token),

  createPurchaseOrder: (payload: Record<string, unknown>, token: string) =>
    request<{ order: unknown }>("/api/purchase-orders", { method: "POST", body: JSON.stringify(payload) }, token),

  sendPurchaseOrder: (id: string, token: string) =>
    request<{ order: unknown }>(`/api/purchase-orders/${id}/send`, { method: "POST" }, token),

  receivePurchaseOrder: (id: string, payload: { items: { itemId: string; receivedQty: number }[] }, token: string) =>
    request<{ order: unknown }>(`/api/purchase-orders/${id}/receive`, { method: "POST", body: JSON.stringify(payload) }, token),

  cancelPurchaseOrder: (id: string, token: string) =>
    request<{ order: unknown }>(`/api/purchase-orders/${id}/cancel`, { method: "POST" }, token),

  replenishmentSuggestions: (token: string) =>
    request<{ suggestions: unknown[] }>("/api/purchase-orders/replenishment-suggestions", {}, token),

  createPurchaseOrdersFromSuggestions: (token: string) =>
    request<{ created: unknown[]; skippedWithoutSupplier: unknown[] }>("/api/purchase-orders/from-suggestions", { method: "POST" }, token),

  // Agenda
  bays: (token: string) => request<{ bays: unknown[] }>("/api/agenda/bays", {}, token),

  createBay: (payload: Record<string, unknown>, token: string) =>
    request<{ bay: unknown }>("/api/agenda/bays", { method: "POST", body: JSON.stringify(payload) }, token),

  updateBay: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ bay: unknown }>(`/api/agenda/bays/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  archiveBay: (id: string, token: string) => request<void>(`/api/agenda/bays/${id}`, { method: "DELETE" }, token),

  appointments: (token: string, params: { from?: string; to?: string; mechanicId?: string; bayId?: string; status?: string } = {}) =>
    request<{ appointments: unknown[] }>(`/api/agenda/appointments${toQuery(params)}`, {}, token),

  createAppointment: (payload: Record<string, unknown>, token: string) =>
    request<{ appointment: unknown }>("/api/agenda/appointments", { method: "POST", body: JSON.stringify(payload) }, token),

  updateAppointment: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ appointment: unknown }>(`/api/agenda/appointments/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  setAppointmentStatus: (id: string, status: string, token: string) =>
    request<{ appointment: unknown }>(`/api/agenda/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),

  mechanicWorkload: (token: string, params: { from?: string; to?: string } = {}) =>
    request<{ workload: unknown[] }>(`/api/agenda/appointments/workload${toQuery(params)}`, {}, token),

  bayOccupancy: (token: string, params: { from?: string; to?: string } = {}) =>
    request<{ occupancy: unknown[] }>(`/api/agenda/appointments/bay-occupancy${toQuery(params)}`, {}, token),

  // PDV / Balcão
  counterSales: (token: string, params: { status?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; pagination: Pagination }>(`/api/counter-sales${toQuery(params)}`, {}, token),

  createCounterSale: (payload: Record<string, unknown>, token: string) =>
    request<{ sale: unknown }>("/api/counter-sales", { method: "POST", body: JSON.stringify(payload) }, token),

  cancelCounterSale: (id: string, token: string) =>
    request<{ sale: unknown }>(`/api/counter-sales/${id}/cancel`, { method: "POST" }, token),

  // Relatórios
  dashboardReport: (token: string, params: { from?: string; to?: string } = {}) =>
    request<{ report: unknown }>(`/api/reports/dashboard${toQuery(params)}`, {}, token),

  // Garantias
  expiringWarranties: (token: string, withinDays = 30) =>
    request<{ parts: unknown[] }>(`/api/warranties/expiring${toQuery({ withinDays })}`, {}, token),

  setPartWarranty: (orderId: string, partId: string, payload: { months: number; startAt?: string }, token: string) =>
    request<{ part: unknown }>(
      `/api/service-orders/${orderId}/parts/${partId}/warranty`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token
    ),

  // Histórico de veículo
  vehicleHistory: (id: string, token: string) => request<{ history: unknown }>(`/api/vehicles/${id}/history`, {}, token),

  revisionAlerts: (token: string) => request<{ alerts: unknown[] }>("/api/vehicles/revision-alerts", {}, token),

  // Comissões
  commissions: (token: string, params: { mechanicId?: string; status?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; pagination: Pagination }>(`/api/commissions${toQuery(params)}`, {}, token),

  generateCommissions: (payload: { from: string; to: string }, token: string) =>
    request<{ created: unknown[] }>("/api/commissions/generate", { method: "POST", body: JSON.stringify(payload) }, token),

  payCommission: (id: string, payload: { bankAccountId?: string }, token: string) =>
    request<{ commission: unknown }>(`/api/commissions/${id}/pay`, { method: "POST", body: JSON.stringify(payload) }, token),

  cancelCommission: (id: string, token: string) =>
    request<{ commission: unknown }>(`/api/commissions/${id}/cancel`, { method: "POST" }, token),

  // Lojas
  stores: (token: string) => request<{ stores: unknown[] }>("/api/stores", {}, token),

  createStore: (payload: Record<string, unknown>, token: string) =>
    request<{ store: unknown }>("/api/stores", { method: "POST", body: JSON.stringify(payload) }, token),

  updateStore: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ store: unknown }>(`/api/stores/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  archiveStore: (id: string, token: string) => request<void>(`/api/stores/${id}`, { method: "DELETE" }, token),

  // Processo da OS (Fase 1) — consultor/orçamentista/técnico, prioridade, previsão,
  // setor, seguro/sinistro.
  updateServiceOrderProcess: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ order: unknown }>(`/api/service-orders/${id}/process`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  updateVehicle: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ vehicle: unknown }>(`/api/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  // Seguradoras
  insuranceCompanies: (token: string, params: { q?: string; accredited?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; pagination: Pagination }>(`/api/insurance-companies${toQuery(params)}`, {}, token),

  insuranceCompany: (id: string, token: string) => request<{ company: unknown }>(`/api/insurance-companies/${id}`, {}, token),

  createInsuranceCompany: (payload: Record<string, unknown>, token: string) =>
    request<{ company: unknown }>("/api/insurance-companies", { method: "POST", body: JSON.stringify(payload) }, token),

  updateInsuranceCompany: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ company: unknown }>(`/api/insurance-companies/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  archiveInsuranceCompany: (id: string, token: string) =>
    request<void>(`/api/insurance-companies/${id}`, { method: "DELETE" }, token),

  // Setores
  sectors: (token: string) => request<{ sectors: unknown[] }>("/api/sectors", {}, token),

  createSector: (payload: Record<string, unknown>, token: string) =>
    request<{ sector: unknown }>("/api/sectors", { method: "POST", body: JSON.stringify(payload) }, token),

  archiveSector: (id: string, token: string) => request<void>(`/api/sectors/${id}`, { method: "DELETE" }, token),

  // Catálogo de serviços
  serviceCatalog: (token: string, params: { q?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; pagination: Pagination }>(`/api/service-catalog${toQuery(params)}`, {}, token),

  createServiceCatalogItem: (payload: Record<string, unknown>, token: string) =>
    request<{ item: unknown }>("/api/service-catalog", { method: "POST", body: JSON.stringify(payload) }, token),

  updateServiceCatalogItem: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ item: unknown }>(`/api/service-catalog/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  archiveServiceCatalogItem: (id: string, token: string) =>
    request<void>(`/api/service-catalog/${id}`, { method: "DELETE" }, token),

  // Orçamento formal (Estimate)
  estimates: (token: string, params: { serviceOrderId?: string; status?: string; insuranceCompanyId?: string } = {}) =>
    request<{ estimates: unknown[] }>(`/api/estimates${toQuery(params)}`, {}, token),

  estimate: (id: string, token: string) => request<{ estimate: unknown }>(`/api/estimates/${id}`, {}, token),

  createEstimate: (payload: Record<string, unknown>, token: string) =>
    request<{ estimate: unknown }>("/api/estimates", { method: "POST", body: JSON.stringify(payload) }, token),

  updateEstimate: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ estimate: unknown }>(`/api/estimates/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  setEstimateStatus: (id: string, status: string, token: string) =>
    request<{ estimate: unknown }>(`/api/estimates/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),

  addEstimateItem: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ estimate: unknown }>(`/api/estimates/${id}/items`, { method: "POST", body: JSON.stringify(payload) }, token),

  removeEstimateItem: (id: string, itemId: string, token: string) =>
    request<{ estimate: unknown }>(`/api/estimates/${id}/items/${itemId}`, { method: "DELETE" }, token),

  // Complementos de mão de obra pendentes
  pendingSupplements: (token: string) => request<{ items: unknown[] }>("/api/supplements/pending", {}, token),

  // Vistorias
  inspections: (token: string, params: { status?: string; insuranceCompanyId?: string; inspectorId?: string; from?: string; to?: string } = {}) =>
    request<{ inspections: unknown[] }>(`/api/inspections${toQuery(params)}`, {}, token),

  inspectionsToSchedule: (token: string) => request<{ orders: unknown[] }>("/api/inspections/to-schedule", {}, token),

  regularizationList: (token: string) => request<{ items: unknown[] }>("/api/inspections/regularization", {}, token),

  inspection: (id: string, token: string) => request<{ inspection: unknown }>(`/api/inspections/${id}`, {}, token),

  createInspection: (payload: Record<string, unknown>, token: string) =>
    request<{ inspection: unknown }>("/api/inspections", { method: "POST", body: JSON.stringify(payload) }, token),

  updateInspection: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ inspection: unknown }>(`/api/inspections/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  createInspectionIssue: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ inspection: unknown }>(`/api/inspections/${id}/issues`, { method: "POST", body: JSON.stringify(payload) }, token),

  updateInspectionIssue: (id: string, issueId: string, payload: Record<string, unknown>, token: string) =>
    request<{ issue: unknown }>(`/api/inspections/${id}/issues/${issueId}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  // Apontamento de horas
  timeEntries: (token: string, params: { employeeId?: string; serviceOrderId?: string; status?: string } = {}) =>
    request<{ entries: unknown[] }>(`/api/time-entries${toQuery(params)}`, {}, token),

  startTimeEntry: (payload: Record<string, unknown>, token: string) =>
    request<{ entry: unknown }>("/api/time-entries", { method: "POST", body: JSON.stringify(payload) }, token),

  pauseTimeEntry: (id: string, token: string) => request<{ entry: unknown }>(`/api/time-entries/${id}/pause`, { method: "PATCH" }, token),

  resumeTimeEntry: (id: string, token: string) => request<{ entry: unknown }>(`/api/time-entries/${id}/resume`, { method: "PATCH" }, token),

  finishTimeEntry: (id: string, token: string) => request<{ entry: unknown }>(`/api/time-entries/${id}/finish`, { method: "PATCH" }, token),

  capacityPanel: (token: string) => request<unknown>("/api/time-entries/capacity", {}, token),

  // Auditoria
  auditLogs: (token: string, params: { entity?: string; entityId?: string; userId?: string } = {}) =>
    request<{ logs: unknown[] }>(`/api/audit-logs${toQuery(params)}`, {}, token),

  // Central de alertas
  alerts: (token: string) => request<{ notifications: unknown[] }>("/api/alerts", {}, token),

  markAlertRead: (id: string, token: string) => request<{ notification: unknown }>(`/api/alerts/${id}/read`, { method: "PATCH" }, token),

  // Documentos padronizados
  documentTemplates: (token: string) => request<{ templates: unknown[] }>("/api/document-templates", {}, token),

  renderDocument: (key: string, serviceOrderId: string, token: string) =>
    request<{ document: { name: string; html: string } }>(`/api/document-templates/${key}/render/${serviceOrderId}`, {}, token),

  // Busca global
  globalSearch: (q: string, token: string) => request<{ orders: unknown[]; estimates: unknown[] }>(`/api/search${toQuery({ q })}`, {}, token),

  // Caminhões
  trucks: (token: string) => request<{ trucks: unknown[] }>("/api/trucks", {}, token),

  trucksAssignedToMe: (token: string) => request<{ trucks: unknown[] }>("/api/trucks/assigned-to-me", {}, token),

  truck: (id: string, token: string) => request<{ truck: unknown }>(`/api/trucks/${id}`, {}, token),

  createTruck: (payload: Record<string, unknown>, token: string) =>
    request<{ truck: unknown }>("/api/trucks", { method: "POST", body: JSON.stringify(payload) }, token),

  updateTruck: (id: string, payload: Record<string, unknown>, token: string) =>
    request<{ truck: unknown }>(`/api/trucks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, token),

  archiveTruck: (id: string, token: string) => request<void>(`/api/trucks/${id}`, { method: "DELETE" }, token),

  truckTrips: (truckId: string, token: string) => request<{ trips: unknown[] }>(`/api/trucks/${truckId}/trips`, {}, token),

  truckMovements: (token: string) => request<{ trips: unknown[] }>("/api/trucks/movements", {}, token),

  startTruckTrip: (
    truckId: string,
    payload: { startKm: number; startFuelLevel: string; startCondition?: string; photo?: File | null },
    token: string
  ) => {
    const form = new FormData();
    form.append("startKm", String(payload.startKm));
    form.append("startFuelLevel", payload.startFuelLevel);
    if (payload.startCondition) form.append("startCondition", payload.startCondition);
    if (payload.photo) form.append("photo", payload.photo);
    return request<{ trip: unknown }>(`/api/trucks/${truckId}/trips/start`, { method: "POST", body: form }, token);
  },

  finishTruckTrip: (
    truckId: string,
    tripId: string,
    payload: { endKm: number; endFuelLevel: string; endCondition?: string; notes?: string; photo: File },
    token: string
  ) => {
    const form = new FormData();
    form.append("endKm", String(payload.endKm));
    form.append("endFuelLevel", payload.endFuelLevel);
    if (payload.endCondition) form.append("endCondition", payload.endCondition);
    if (payload.notes) form.append("notes", payload.notes);
    form.append("photo", payload.photo);
    return request<{ trip: unknown }>(`/api/trucks/${truckId}/trips/${tripId}/finish`, { method: "PATCH", body: form }, token);
  },

  recognizeTruckPanel: (photo: File, token: string) => {
    const form = new FormData();
    form.append("photo", photo);
    return request<{ recognized: unknown }>("/api/trucks/recognize-panel", { method: "POST", body: form }, token);
  },

  recognizeFuelPump: (photo: File, token: string) => {
    const form = new FormData();
    form.append("photo", photo);
    return request<{ recognized: unknown }>("/api/trucks/recognize-pump", { method: "POST", body: form }, token);
  },

  truckRefuelings: (truckId: string, token: string) => request<{ refuelings: unknown[] }>(`/api/trucks/${truckId}/refuelings`, {}, token),

  allTruckRefuelings: (token: string) => request<{ refuelings: unknown[] }>("/api/trucks/refuelings", {}, token),

  createTruckRefueling: (
    truckId: string,
    payload: { currentKm: number; liters: number; amountPaid: number; pricePerLiter?: number; notes?: string; photo: File },
    token: string
  ) => {
    const form = new FormData();
    form.append("currentKm", String(payload.currentKm));
    form.append("liters", String(payload.liters));
    form.append("amountPaid", String(payload.amountPaid));
    if (payload.pricePerLiter != null) form.append("pricePerLiter", String(payload.pricePerLiter));
    if (payload.notes) form.append("notes", payload.notes);
    form.append("photo", payload.photo);
    return request<{ refueling: unknown }>(`/api/trucks/${truckId}/refuelings`, { method: "POST", body: form }, token);
  },

  // Novo projeto sem solicitação
  recognizeVehiclePhoto: (photo: File, token: string) => {
    const form = new FormData();
    form.append("photo", photo);
    return request<{ recognized: unknown }>("/api/vehicles/recognize", { method: "POST", body: form }, token);
  },

  quickCreateClient: (payload: Record<string, unknown>, token: string) =>
    request<{ client: unknown; userId: string; generatedPassword: string }>(
      "/api/clients/quick-create",
      { method: "POST", body: JSON.stringify(payload) },
      token
    ),

  vehicles: (token: string, params: { ownerId?: string } = {}) =>
    request<{ vehicles: unknown[] }>(`/api/vehicles${toQuery(params)}`, {}, token),

  createVehicle: (payload: Record<string, unknown>, token: string) =>
    request<{ vehicle: unknown }>("/api/vehicles", { method: "POST", body: JSON.stringify(payload) }, token),

  createServiceOrder: (payload: Record<string, unknown>, token: string) =>
    request<{ order: unknown }>("/api/service-orders", { method: "POST", body: JSON.stringify(payload) }, token),
};

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function toQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export { API_URL };
