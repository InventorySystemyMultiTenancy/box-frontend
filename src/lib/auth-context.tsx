"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, AUTH_EXPIRED_EVENT } from "@/lib/api";
import { FULL_ACCESS, ReportAccess } from "@/lib/access";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  roleId?: string | null;
  avatarUrl?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  permissions: Set<string>;
  hasPermission: (resource: string, action: string) => boolean;
  // Vazio = sem restrição extra de abas (cai no role/hasPermission de sempre); quando o
  // cargo do usuário define allowedTabs, só essas abas aparecem na navegação.
  allowedTabs: string[];
  // O que o cargo libera na aba Relatórios (blocos/setores) e na aba Alertas (tipos).
  reportAccess: ReportAccess;
  login: (email: string, password: string) => Promise<void>;
  registerCustomer: (payload: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => void;
  updateAvatar: (file: File) => Promise<void>;
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
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [reportAccess, setReportAccess] = useState<ReportAccess>(FULL_ACCESS);
  const [loading, setLoading] = useState(() => readStoredToken() !== null);
  const router = useRouter();

  useEffect(() => {
    if (!token) return;
    Promise.all([api.me(token), api.mePermissions(token).catch(() => ({ permissions: [] as string[], allowedTabs: [] as string[], reportAccess: FULL_ACCESS }))])
      .then(([{ user }, { permissions, allowedTabs, reportAccess }]) => {
        setUser(user as AuthUser);
        setPermissions(new Set(permissions));
        setAllowedTabs(allowedTabs ?? []);
        setReportAccess(reportAccess ?? FULL_ACCESS);
      })
      .catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Qualquer chamada da API que receba 401 com sessão aberta (token vencido ou conta
  // desativada pelo admin) encerra a sessão e leva pro login, com o motivo na URL.
  useEffect(() => {
    function onExpired() {
      if (!window.localStorage.getItem(STORAGE_KEY)) return;
      window.localStorage.removeItem(STORAGE_KEY);
      setToken(null);
      setUser(null);
      setPermissions(new Set());
      setAllowedTabs([]);
      setReportAccess(FULL_ACCESS);
      router.replace("/login?sessao=expirada");
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [router]);

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
    setAllowedTabs([]);
    setReportAccess(FULL_ACCESS);
    router.push("/");
  }, [router]);

  const updateAvatar = useCallback(
    async (file: File) => {
      if (!token) throw new Error("Não autenticado.");
      const { user } = await api.updateMyAvatar(file, token);
      setUser(user as AuthUser);
    },
    [token]
  );

  return (
    <AuthContext.Provider value={{ user, token, loading, permissions, hasPermission, allowedTabs, reportAccess, login, registerCustomer, logout, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}
