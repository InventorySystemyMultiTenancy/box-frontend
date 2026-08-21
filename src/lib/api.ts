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
    payload: { name: string; email: string; password: string; phone?: string; role: "CUSTOMER" | "MECHANIC" | "ADMIN"; roleId?: string },
    token: string
  ) =>
    request<{ user: { id: string; name: string; email: string; role: string; roleId?: string | null; phone?: string | null } }>(
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
    },
    token: string
  ) =>
    request<{ user: unknown }>(
      `/api/auth/users/${id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
      token
    ),

  me: (token: string) => request<{ user: { id: string; name: string; email: string; role: string } }>("/api/auth/me", {}, token),

  serviceOrders: (token: string) => request<{ orders: unknown[] }>("/api/service-orders", {}, token),

  serviceOrder: (id: string, token: string) => request<{ order: unknown }>(`/api/service-orders/${id}`, {}, token),

  respondApproval: (orderId: string, approvalId: string, status: "APPROVED" | "REJECTED", token: string, responseNote?: string) =>
    request(`/api/service-orders/${orderId}/approvals/${approvalId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, responseNote }),
    }, token),

  updateOrderStatus: (orderId: string, status: string, token: string) =>
    request<{ order: unknown }>(`/api/service-orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }, token),

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
  payables: (token: string, params: { status?: string; category?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) =>
    request<{ items: unknown[]; pagination: Pagination }>(`/api/finance/payables${toQuery(params)}`, {}, token),

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

  // Notificações
  notifications: (token: string, params: { serviceOrderId?: string } = {}) =>
    request<{ notifications: unknown[] }>(`/api/notifications${toQuery(params)}`, {}, token),

  notifyServiceOrder: (orderId: string, token: string) =>
    request<{ ok: boolean }>(`/api/service-orders/${orderId}/notify`, { method: "POST" }, token),
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
