"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import CustomerDashboard from "@/components/dashboard/CustomerDashboard";
import MechanicDashboard from "@/components/dashboard/MechanicDashboard";
import styles from "@/components/dashboard/dashboard.module.css";

export default function DashboardPage() {
  const { user, token, loading, logout } = useAuth();
  const router = useRouter();

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
        <span className={styles.brand}>BOX.</span>
        <div className={styles.topbarRight}>
          <span>{user.name}</span>
          <button className={styles.logout} onClick={logout}>
            Sair
          </button>
        </div>
      </header>

      {isStaff ? <MechanicDashboard /> : <CustomerDashboard />}
    </div>
  );
}
