const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
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

  me: (token: string) => request<{ user: { id: string; name: string; email: string; role: string } }>("/api/auth/me", {}, token),

  serviceOrders: (token: string) => request<{ orders: unknown[] }>("/api/service-orders", {}, token),

  serviceOrder: (id: string, token: string) => request<{ order: unknown }>(`/api/service-orders/${id}`, {}, token),

  respondApproval: (orderId: string, approvalId: string, status: "APPROVED" | "REJECTED", token: string) =>
    request(`/api/service-orders/${orderId}/approvals/${approvalId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }, token),
};

export { API_URL };
