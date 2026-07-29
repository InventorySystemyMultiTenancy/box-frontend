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
    payload: { name: string; email: string; password: string; phone?: string; role: "CUSTOMER" | "MECHANIC" | "ADMIN" },
    token: string
  ) =>
    request<{ user: { id: string; name: string; email: string; role: string; phone?: string | null } }>(
      "/api/auth/users",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      token
    ),

  updateUser: (
    id: string,
    payload: { name?: string; email?: string; password?: string; phone?: string | null; role?: "CUSTOMER" | "MECHANIC" | "ADMIN" },
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
};

export { API_URL };
