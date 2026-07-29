"use client";

import { useEffect, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import styles from "@/components/dashboard/dashboard.module.css";

const STAFF_TABS = [
  { href: "/dashboard", label: "Projetos" },
  { href: "/dashboard/solicitacoes", label: "Solicitações" },
  { href: "/dashboard/usuarios", label: "Usuários" },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !token) router.replace("/login");
  }, [loading, token, router]);

  if (loading || !user) {
    return <div className={styles.empty}>Carregando painel...</div>;
  }

  const isStaff = user.role === "MECHANIC" || user.role === "ADMIN";

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}>
          <span className={styles.brand}>BOX.</span>
          {isStaff && (
            <nav className={styles.tabs}>
              {STAFF_TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`${styles.tab} ${pathname === tab.href ? styles.tabActive : ""}`}
                >
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
    </div>
  );
}
