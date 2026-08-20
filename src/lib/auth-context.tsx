"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  permissions: Set<string>;
  hasPermission: (resource: string, action: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  registerCustomer: (payload: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "box.token";

function readStoredToken() {
  return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(() => readStoredToken() !== null);
  const router = useRouter();

  useEffect(() => {
    if (!token) return;
    Promise.all([api.me(token), api.mePermissions(token).catch(() => ({ permissions: [] }))])
      .then(([{ user }, { permissions }]) => {
        setUser(user as AuthUser);
        setPermissions(new Set(permissions));
      })
      .catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const hasPermission = useCallback(
    (resource: string, action: string) => permissions.has(`${resource}.${action}`),
    [permissions]
  );

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    window.localStorage.setItem(STORAGE_KEY, token);
    setToken(token);
    setUser(user as AuthUser);
  }, []);

  const registerCustomer = useCallback(async (payload: { name: string; email: string; password: string; phone?: string }) => {
    const { token, user } = await api.registerCustomer(payload);
    window.localStorage.setItem(STORAGE_KEY, token);
    setToken(token);
    setUser(user as AuthUser);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
    setPermissions(new Set());
    router.push("/");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, token, loading, permissions, hasPermission, login, registerCustomer, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
