"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AdminPartsPanel from "@/components/dashboard/AdminPartsPanel";

export default function PecasPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "ADMIN") router.replace("/dashboard");
  }, [user, router]);

  if (user?.role !== "ADMIN") return null;
  return <AdminPartsPanel />;
}
