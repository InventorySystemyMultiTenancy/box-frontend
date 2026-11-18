"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, AUTH_EXPIRED_EVENT, TOKEN_RENEWED_EVENT, tokenIssuedAt } from "@/lib/api";
import { FULL_ACCESS, ReportAccess } from "@/lib/access";
import { dashboardHomePath } from "@/lib/dashboard-home";

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
  /** Resolve com a primeira tela do painel para o cargo (ex.: só Caminhões → /dashboard/caminhoes). */
  login: (email: string, password: string) => Promise<string>;
  registerCustomer: (payload: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  logout: () => void;
  updateAvatar: (file: File) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "box.token";
/** Motivo do último "sessão expirada" (mostrado na tela de login para facilitar suporte). */
export const LOGOUT_REASON_KEY = "box.logoutReason";

type Access = { permissions: string[]; allowedTabs: string[]; reportAccess?: ReportAccess };
const NO_ACCESS: Access = { permissions: [], allowedTabs: [], reportAccess: FULL_ACCESS };

/**
 * Permissões do cargo. Falha de rede/servidor sem resposta → erro (quem chamou tenta de
 * novo; NUNCA abre o painel "sem restrição" por engano). Só se o servidor responder com
 * erro (ex.: rota indisponível) cai no padrão sem permissões extras, como antes.
 */
async function fetchPermissions(token: string): Promise<Access> {
  try {
    return await api.mePermissions(token);
  } catch (err) {
    if (err instanceof ApiError && err.status >= 400 && err.status !== 401) return NO_ACCESS;
    throw err;
  }
}

function readStoredToken() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [allowedTabs, setAllowedTabs] = useState<string[]>([]);
  const [reportAccess, setReportAccess] = useState<ReportAccess>(FULL_ACCESS);
  const [loading, setLoading] = useState(() => readStoredToken() !== null);
  const router = useRouter();

  // O token muda sozinho a cada renovação (sessão deslizante); o usuário/permissões só
  // precisam ser (re)carregados quando a SESSÃO muda (abrir o site, login, cadastro). Por
  // isso o carregamento depende de `sessionKey`, não do texto do token — antes, uma
  // renovação chegando no meio do carregamento o cancelava e o usuário nunca aparecia.
  const [sessionKey, setSessionKey] = useState(0);
  const tokenRef = useRef<string | null>(token);
  const applyToken = useCallback((next: string | null) => {
    tokenRef.current = next;
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, next);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sem armazenamento (modo privado/sem espaço): a sessão vale só nesta aba.
    }
    setToken(next);
  }, []);

  const applyAccess = useCallback((access: Access) => {
    setPermissions(new Set(access.permissions));
    setAllowedTabs(access.allowedTabs ?? []);
    setReportAccess(access.reportAccess ?? FULL_ACCESS);
  }, []);

  useEffect(() => {
    const sessionToken = tokenRef.current;
    if (!sessionToken) return;
    // Só sai do login quando o servidor RECUSA o token (401). Falha de rede (celular
    // voltando da tela apagada, 4G oscilando, servidor acordando) não desloga: tenta de
    // novo sozinho até conseguir.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const load = () => {
      timer = undefined;
      const current = tokenRef.current;
      if (!current) return;
      Promise.all([api.me(current), fetchPermissions(current)])
        .then(([{ user }, access]) => {
          if (cancelled) return;
          setUser(user as AuthUser);
          applyAccess(access);
          setLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          // 401: o evento AUTH_EXPIRED (lib/api) já encerra a sessão e leva pro login.
          if (err instanceof ApiError && err.status === 401) {
            // Recusado um token que já foi trocado (renovação no meio): tenta com o atual.
            if (tokenRef.current && tokenRef.current !== current) return load();
            setLoading(false);
            return;
          }
          attempt += 1;
          timer = setTimeout(load, Math.min(15000, 1000 * 2 ** attempt));
        });
    };
    const retryNow = () => {
      if (timer === undefined) return;
      clearTimeout(timer);
      load();
    };
    load();
    window.addEventListener("online", retryNow);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("online", retryNow);
    };
  }, [sessionKey, applyAccess]);

  // Uma chamada da API recebeu 401 (token vencido ou conta desativada pelo admin): encerra
  // a sessão e leva pro login com o motivo. Ignora respostas atrasadas de um token que já
  // não é o atual (ex.: requisição antiga voltando depois de um login novo) — antes isso
  // derrubava o login que a pessoa acabou de fazer.
  useEffect(() => {
    function onExpired(event: Event) {
      const detail = (event as CustomEvent<{ reason?: string; token?: string }>).detail;
      const current = tokenRef.current;
      if (!current || (detail?.token && detail.token !== current)) return;
      try {
        sessionStorage.setItem(LOGOUT_REASON_KEY, detail?.reason ?? "");
      } catch {
        // ignora
      }
      applyToken(null);
      setUser(null);
      setPermissions(new Set());
      setAllowedTabs([]);
      setReportAccess(FULL_ACCESS);
      setLoading(false);
      router.replace("/login?sessao=expirada");
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, [router, applyToken]);

  // Token renovado pelo servidor enquanto a pessoa usa o sistema: guarda e passa a usar —
  // só se veio de uma requisição feita com o token atual E se for mais novo que ele. Um
  // token "renovado" mais velho que o atual só pode ser resposta antiga reaproveitada (cache
  // do navegador): aceitar trocava a sessão boa por uma vencida e mandava pro login.
  useEffect(() => {
    function onRenewed(event: Event) {
      const detail = (event as CustomEvent<{ token: string; previous: string }>).detail;
      if (!detail?.token || !tokenRef.current || detail.previous !== tokenRef.current) return;
      if (tokenIssuedAt(detail.token) <= tokenIssuedAt(tokenRef.current)) return;
      applyToken(detail.token);
    }
    window.addEventListener(TOKEN_RENEWED_EVENT, onRenewed);
    return () => window.removeEventListener(TOKEN_RENEWED_EVENT, onRenewed);
  }, [applyToken]);

  const hasPermission = useCallback(
    (resource: string, action: string) => permissions.has(`${resource}.${action}`),
    [permissions]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const { token, user } = await api.login(email, password);
      try {
        sessionStorage.removeItem(LOGOUT_REASON_KEY);
      } catch {
        // ignora
      }
      applyToken(token);
      setUser(user as AuthUser);
      // O painel só abre com as permissões do cargo já carregadas — senão quem tem cargo
      // restrito (ex.: só Caminhões) via por um instante abas que não são dele.
      try {
        const access = await fetchPermissions(token);
        applyAccess(access);
        setLoading(false);
        setSessionKey((k) => k + 1);
        return dashboardHomePath(access.allowedTabs ?? []);
      } catch {
        // Rede falhou agora: "Carregando painel" segura a tela e o carregamento da sessão
        // tenta de novo sozinho até conseguir.
        applyAccess(NO_ACCESS);
        setLoading(true);
        setSessionKey((k) => k + 1);
        return "/dashboard";
      }
    },
    [applyToken, applyAccess]
  );

  const registerCustomer = useCallback(async (payload: { name: string; email: string; password: string; phone?: string }) => {
    const { token, user } = await api.registerCustomer(payload);
    applyToken(token);
    setUser(user as AuthUser);
    applyAccess(NO_ACCESS);
    setLoading(true);
    setSessionKey((k) => k + 1);
  }, [applyToken, applyAccess]);

  const logout = useCallback(() => {
    applyToken(null);
    setLoading(false);
    setUser(null);
    setPermissions(new Set());
    setAllowedTabs([]);
    setReportAccess(FULL_ACCESS);
    router.push("/");
  }, [router, applyToken]);

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
