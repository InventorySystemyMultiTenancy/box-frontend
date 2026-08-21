"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import DayAgendaPanel from "@/components/dashboard/agenda/DayAgendaPanel";
import BaysPanel from "@/components/dashboard/agenda/BaysPanel";
import WorkloadPanel from "@/components/dashboard/agenda/WorkloadPanel";

const TABS = [
  { key: "day", label: "Agenda do dia" },
  { key: "workload", label: "Carga de trabalho" },
  { key: "bays", label: "Boxes/Elevadores" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AgendaPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("day");
  const allowed = hasPermission("agenda", "view");

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  if (!allowed) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
        <p className="text-sm text-muted-foreground">Calendário de agendamentos, ocupação de box/elevador e carga de trabalho por mecânico.</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "day" && <DayAgendaPanel />}
      {tab === "workload" && <WorkloadPanel />}
      {tab === "bays" && <BaysPanel />}
    </main>
  );
}
