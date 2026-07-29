"use client";

import { useAuth } from "@/lib/auth-context";
import CustomerDashboard from "@/components/dashboard/CustomerDashboard";
import MechanicProjectsPanel from "@/components/dashboard/MechanicProjectsPanel";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const isStaff = user.role === "MECHANIC" || user.role === "ADMIN";
  return isStaff ? <MechanicProjectsPanel /> : <CustomerDashboard />;
}
