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

  createUser: (
    payload: { name: string; email: string; password: string; phone?: string; role: "CUSTOMER" | "MECHANIC" },
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

  me: (token: string) => request<{ user: { id: string; name: string; email: string; role: string } }>("/api/auth/me", {}, token),

  serviceOrders: (token: string) => request<{ orders: unknown[] }>("/api/service-orders", {}, token),

  serviceOrder: (id: string, token: string) => request<{ order: unknown }>(`/api/service-orders/${id}`, {}, token),

  respondApproval: (orderId: string, approvalId: string, status: "APPROVED" | "REJECTED", token: string, responseNote?: string) =>
    request(`/api/service-orders/${orderId}/approvals/${approvalId}`, {
      method: "PATCH",
      body: JSON.stringify({ status, responseNote }),
    }, token),

  createProblem: (
    orderId: string,
    payload: { key: string; name: string; description: string; wearLevel?: string; estimatedValue?: string; files: File[] },
    token: string
  ) => {
    const form = new FormData();
    form.append("key", payload.key);
    form.append("name", payload.name);
    form.append("description", payload.description);
    if (payload.wearLevel) form.append("wearLevel", payload.wearLevel);
    if (payload.estimatedValue) form.append("estimatedValue", payload.estimatedValue);
    payload.files.forEach((file) => form.append("files", file));

    return request<{ part: unknown; approval: unknown; event: unknown }>(
      `/api/service-orders/${orderId}/parts/problems`,
      { method: "POST", body: form },
      token
    );
  },
};

export { API_URL };
