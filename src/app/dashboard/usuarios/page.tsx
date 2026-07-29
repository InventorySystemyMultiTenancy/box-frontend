"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import MechanicUsersPanel from "@/components/dashboard/MechanicUsersPanel";

export default function UsuariosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isStaff = user?.role === "MECHANIC" || user?.role === "ADMIN";

  useEffect(() => {
    if (user && !isStaff) router.replace("/dashboard");
  }, [user, isStaff, router]);

  if (!isStaff) return null;
  return <MechanicUsersPanel />;
}
