"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AdminFinancePanel from "@/components/dashboard/AdminFinancePanel";

export default function FinanceiroPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "ADMIN") router.replace("/dashboard");
  }, [user, router]);

  if (user?.role !== "ADMIN") return null;
  return <AdminFinancePanel />;
}
