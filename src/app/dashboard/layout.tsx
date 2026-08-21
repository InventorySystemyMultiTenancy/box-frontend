"use client";

import { useEffect, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, token, loading, hasPermission, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !token) router.replace("/login");
  }, [loading, token, router]);

  if (loading || !user) {
    return <div className={styles.empty}>Carregando painel...</div>;
  }

  const isStaff = user.role === "MECHANIC" || user.role === "ADMIN";
  const tabs = [
    ...(user.role === "ADMIN" ? ADMIN_TABS : STAFF_TABS),
    ...(hasPermission("clients", "view") ? [{ href: "/dashboard/clientes", label: "Clientes" }] : []),
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

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.brand}>
            <Image src="/reblindlogo.jpeg" alt="Reblind" width={124} height={124} className={styles.brandLogo} priority />
          </span>
          {isStaff && (
            <nav className={styles.tabs}>
              {tabs.map((tab) => (
                <Link key={tab.href} href={tab.href} className={`${styles.tab} ${pathname === tab.href ? styles.tabActive : ""}`}>
                  {tab.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
        <div className={styles.topbarRight}>
          <span>{user.name}</span>
          <button className={styles.logout} onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      {children}
      <Toaster />
    </div>
  );
}
