"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Bell,
  LogOut,
  Sparkles,
  ClipboardList,
  FileText,
  Users,
  Cog,
  Wallet,
  Search,
  UserRound,
  Layers,
  Truck,
  Shield,
  Package,
  ShoppingCart,
  Calendar,
  CreditCard,
  BadgeCheck,
  BarChart3,
  Percent,
  Store,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { AppNotification } from "@/lib/types";
import { Toaster } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import styles from "@/components/dashboard/dashboard.module.css";
import "../dashboard.css";

const STAFF_TABS = [
  { href: "/dashboard", label: "Projetos" },
  { href: "/dashboard/solicitacoes", label: "Solicitações" },
];

const ADMIN_TABS = [
  ...STAFF_TABS,
  { href: "/dashboard/usuarios", label: "Usuários" },
  { href: "/dashboard/pecas", label: "Peças" },
  { href: "/dashboard/financeiro", label: "Financeiro" },
];

const TAB_ICONS: Record<string, LucideIcon> = {
  "/dashboard": ClipboardList,
  "/dashboard/solicitacoes": FileText,
  "/dashboard/usuarios": Users,
  "/dashboard/pecas": Cog,
  "/dashboard/financeiro": Wallet,
  "/dashboard/busca": Search,
  "/dashboard/clientes": UserRound,
  "/dashboard/complementos": Layers,
  "/dashboard/alertas": Bell,
  "/dashboard/caminhoes": Truck,
  "/dashboard/seguradoras": Shield,
  "/dashboard/fornecedores": Package,
  "/dashboard/compras": ShoppingCart,
  "/dashboard/agenda": Calendar,
  "/dashboard/pdv": CreditCard,
  "/dashboard/garantias": BadgeCheck,
  "/dashboard/relatorios": BarChart3,
  "/dashboard/comissoes": Percent,
  "/dashboard/lojas": Store,
  "/dashboard/cargos": UserCog,
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MECHANIC: "Mecânico",
  CUSTOMER: "Cliente",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, token, loading, hasPermission, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  useEffect(() => {
    if (!loading && !token) router.replace("/login");
  }, [loading, token, router]);

  // Fecha o menu hambúrguer automaticamente ao trocar de página (padrão React de
  // "ajustar estado durante a renderização", sem precisar de useEffect).
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileNavOpen(false);
  }

  const isStaff = user?.role === "MECHANIC" || user?.role === "ADMIN";
  const tabs = [
    ...(user?.role === "ADMIN" ? ADMIN_TABS : STAFF_TABS),
    ...(isStaff ? [{ href: "/dashboard/busca", label: "Busca" }] : []),
    ...(hasPermission("clients", "view") ? [{ href: "/dashboard/clientes", label: "Clientes" }] : []),
    ...(isStaff ? [{ href: "/dashboard/complementos", label: "Complementos" }] : []),
    ...(isStaff ? [{ href: "/dashboard/alertas", label: "Alertas" }] : []),
    ...(isStaff ? [{ href: "/dashboard/caminhoes", label: "Caminhões" }] : []),
    ...(hasPermission("insurance", "view") ? [{ href: "/dashboard/seguradoras", label: "Seguradoras" }] : []),
    ...(hasPermission("suppliers", "view") ? [{ href: "/dashboard/fornecedores", label: "Fornecedores" }] : []),
    ...(hasPermission("purchases", "view") ? [{ href: "/dashboard/compras", label: "Compras" }] : []),
    ...(hasPermission("agenda", "view") ? [{ href: "/dashboard/agenda", label: "Agenda" }] : []),
    ...(hasPermission("pdv", "view") ? [{ href: "/dashboard/pdv", label: "PDV" }] : []),
    ...(hasPermission("warranties", "view") ? [{ href: "/dashboard/garantias", label: "Garantias" }] : []),
    ...(hasPermission("reports", "view") ? [{ href: "/dashboard/relatorios", label: "Relatórios" }] : []),
    ...(hasPermission("commissions", "view") ? [{ href: "/dashboard/comissoes", label: "Comissões" }] : []),
    ...(hasPermission("stores", "view") ? [{ href: "/dashboard/lojas", label: "Lojas" }] : []),
    ...(hasPermission("roles", "manage") ? [{ href: "/dashboard/cargos", label: "Cargos" }] : []),
  ];

  function updateScrollState() {
    const el = navRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateScrollState();
    const el = navRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [tabs.length]);

  // Contagem de alertas não lidos para o sininho do header — mesma fonte de dados
  // da página /dashboard/alertas, só filtrando por "read: false".
  useEffect(() => {
    if (!token || !isStaff) return;
    let cancelled = false;
    function load() {
      api
        .alerts(token!)
        .then(({ notifications }) => {
          if (cancelled) return;
          setUnreadAlerts((notifications as AppNotification[]).filter((n) => !n.read).length);
        })
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token, isStaff]);

  function scrollNav(direction: 1 | -1) {
    navRef.current?.scrollBy({ left: direction * 220, behavior: "smooth" });
  }

  if (loading || !user) {
    return <div className={styles.empty}>Carregando painel...</div>;
  }

  const navList = (
    <>
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.href];
        return (
          <Link key={tab.href} href={tab.href} title={tab.label} className={`${styles.tab} ${pathname === tab.href ? styles.tabActive : ""}`}>
            {Icon && <Icon size={16} />}
            <span className={styles.tabLabel}>{tab.label}</span>
            {tab.href === "/dashboard/alertas" && unreadAlerts > 0 && <span className={styles.navBadge}>{unreadAlerts}</span>}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.brand}>
          <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className={styles.brandLogo} priority />
        </span>

        {isStaff && (
          <div className={styles.navScrollerWrap}>
            <button
              type="button"
              className={styles.navArrow}
              aria-label="Rolar navegação para a esquerda"
              onClick={() => scrollNav(-1)}
              disabled={!canScrollLeft}
            >
              <ChevronLeft size={16} />
            </button>
            <nav className={styles.tabs} ref={navRef}>
              {navList}
            </nav>
            <button
              type="button"
              className={styles.navArrow}
              aria-label="Rolar navegação para a direita"
              onClick={() => scrollNav(1)}
              disabled={!canScrollRight}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <div className={styles.topbarRight}>
          {isStaff && (
            <button
              type="button"
              className={styles.hamburgerBtn}
              aria-label="Abrir menu de navegação"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={18} />
            </button>
          )}

          {isStaff && (
            <Link href="/dashboard/alertas" className={styles.notifBtn} aria-label="Alertas">
              <Bell size={18} />
              {unreadAlerts > 0 && <span className={styles.notifBadge}>{unreadAlerts > 9 ? "9+" : unreadAlerts}</span>}
            </Link>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={styles.userMenuBtn}>
                <span className={styles.userAvatar}>{(user.name?.[0] ?? "U").toUpperCase()}</span>
                <span className={styles.userMeta}>
                  <strong>{user.name}</strong>
                  <span>{ROLE_LABELS[user.role] ?? user.role}</span>
                </span>
                <ChevronDown size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={logout}>
                <LogOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className={styles.body}>
        {isStaff && (
          <aside className={styles.sidebar}>
            <nav className={styles.sidebarNav}>{navList}</nav>
            <div className={styles.sidebarPromo}>
              <div className={styles.sidebarPromoIcon}>
                <Sparkles size={18} />
              </div>
              <strong>Reblind ERP</strong>
              <p>Gestão completa da oficina em um só lugar.</p>
            </div>
          </aside>
        )}
        <div className={styles.mainArea}>{children}</div>
      </div>

      {isStaff && mobileNavOpen && (
        <div className={styles.mobileNavOverlay} onClick={() => setMobileNavOpen(false)}>
          <div className={styles.mobileNavDrawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileNavDrawerHeader}>
              <span className={styles.brand}>
                <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className={styles.brandLogo} />
              </span>
              <button type="button" className={styles.hamburgerBtn} aria-label="Fechar menu" onClick={() => setMobileNavOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <nav className={styles.sidebarNav}>{navList}</nav>
          </div>
        </div>
      )}

      <Toaster />
    </div>
  );
}
