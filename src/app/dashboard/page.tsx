"use client";

import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth-context";

// Cada perfil baixa só a sua tela: o cliente não carrega o kanban/detalhe de projeto da
// oficina, e o funcionário não carrega o painel do cliente.
const CustomerDashboard = dynamic(() => import("@/components/dashboard/CustomerDashboard"), { ssr: false });
const MechanicProjectsPanel = dynamic(() => import("@/components/dashboard/MechanicProjectsPanel"), { ssr: false });

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const isStaff = user.role === "MECHANIC" || user.role === "ADMIN";
  return isStaff ? <MechanicProjectsPanel /> : <CustomerDashboard />;
}
