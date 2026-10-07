"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import GastosPanel from "@/components/dashboard/GastosPanel";

// useSearchParams exige um Suspense acima dele para a página poder ser pré-renderizada.
export default function GastosPage() {
  return (
    <Suspense>
      <GastosPageContent />
    </Suspense>
  );
}

function GastosPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const isStaff = user?.role === "MECHANIC" || user?.role === "ADMIN";
  // Veio do botão "Lançar gastos" da aba Caminhões → mostra o "Voltar aos caminhões".
  const fromTrucks = useSearchParams().get("de") === "caminhoes";

  useEffect(() => {
    if (user && !isStaff) router.replace("/dashboard");
  }, [user, isStaff, router]);

  if (!isStaff) return null;
  return <GastosPanel backTo={fromTrucks ? { href: "/dashboard/caminhoes", label: "Voltar aos caminhões" } : undefined} />;
}
