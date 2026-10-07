"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SuggestInput } from "@/components/ui/suggest-input";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { ALERT_TYPE_OPTIONS, REPORT_SECTIONS } from "@/lib/access";
import type { ExpenseClassifications, Role } from "@/lib/types";

// Tela Cargos → "Relatórios e alertas": o que quem tem este cargo vê na aba Relatórios
// (blocos + setores de despesa) e na aba Alertas (tipos). Tudo desmarcado = vê tudo.
// Montado com key={role.id}: trocar de cargo recomeça do que está salvo nele.
export function RoleReportAlertAccess({ role, onSaved }: { role: Role; onSaved: () => void }) {
  const { token } = useAuth();
  const [sections, setSections] = useState(() => new Set(role.reportSections ?? []));
  const [sectors, setSectors] = useState<string[]>(() => role.expenseSectors ?? []);
  const [alertTypes, setAlertTypes] = useState(() => new Set(role.alertTypes ?? []));
  const [newSector, setNewSector] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: classifications } = useQuery({
    queryKey: ["expense-classifications"],
    queryFn: async () => (await api.expenseClassifications(token!)) as ExpenseClassifications,
    enabled: !!token,
  });
  const knownSectors = classifications?.sectors ?? [];

  function toggle(set: Set<string>, key: string, apply: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    apply(next);
  }

  function toggleSector(sector: string) {
    setSectors((prev) => (prev.some((s) => s.toLowerCase() === sector.toLowerCase()) ? prev.filter((s) => s.toLowerCase() !== sector.toLowerCase()) : [...prev, sector]));
  }

  function addSector() {
    const value = newSector.trim();
    if (!value) return;
    if (!sectors.some((s) => s.toLowerCase() === value.toLowerCase())) setSectors((prev) => [...prev, value]);
    setNewSector("");
  }

  async function handleSave() {
    if (!token) return;
    setSaving(true);
    try {
      await api.updateRole(role.id, { reportSections: [...sections], expenseSectors: sectors, alertTypes: [...alertTypes] }, token);
      toast.success("Relatórios e alertas do cargo atualizados.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  // Setores já usados nas despesas + os que estão no cargo (mesmo que ainda sem despesa).
  const sectorOptions = [...new Set([...knownSectors, ...sectors])].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const alertGroups = [...new Set(ALERT_TYPE_OPTIONS.map((a) => a.group))];

  return (
    <div className="grid gap-4 border-t pt-4">
      <div>
        <p className="text-sm font-medium">Relatórios e alertas</p>
        <p className="text-xs text-muted-foreground">
          Deixe uma lista toda desmarcada para não restringir (vê tudo). Marcando algum item, quem tiver este cargo passa a ver{" "}
          <strong>só</strong> o que foi marcado.
        </p>
      </div>

      <div className="grid gap-1.5">
        <p className="text-sm">Blocos da aba Relatórios</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {REPORT_SECTIONS.map((s) => (
            <label key={s.key} className="flex items-center gap-2 text-sm">
              <Checkbox checked={sections.has(s.key)} onCheckedChange={() => toggle(sections, s.key, setSections)} />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-1.5">
        <p className="text-sm">Setores de despesa</p>
        <p className="text-xs text-muted-foreground">
          Com setores marcados, o PDF financeiro mostra só as despesas desses setores (sem receitas e saldos, que não têm setor) e os
          alertas de conta vencida também ficam só desses setores.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {sectorOptions.map((sector) => (
            <label key={sector} className="flex items-center gap-2 text-sm">
              <Checkbox checked={sectors.some((s) => s.toLowerCase() === sector.toLowerCase())} onCheckedChange={() => toggleSector(sector)} />
              {sector}
            </label>
          ))}
          {sectorOptions.length === 0 && <span className="text-xs text-muted-foreground">Nenhum setor cadastrado nas despesas ainda.</span>}
        </div>
        <div className="flex max-w-sm items-center gap-2">
          <SuggestInput options={knownSectors} value={newSector} onChange={(e) => setNewSector(e.target.value)} placeholder="Adicionar outro setor" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSector())} />
          <Button type="button" size="sm" variant="outline" onClick={addSector}>
            <Plus className="size-4" />
          </Button>
        </div>
        {sectors.length > 0 && (
          <div className="flex flex-wrap gap-1.5 text-xs">
            {sectors.map((s) => (
              <span key={s} className="flex items-center gap-1 rounded-full border px-2 py-0.5">
                {s}
                <button type="button" aria-label={`Remover ${s}`} onClick={() => toggleSector(s)}>
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <p className="text-sm">Alertas que este cargo vê</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {alertGroups.map((group) => (
            <div key={group} className="rounded-md border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
              <div className="flex flex-col gap-1.5">
                {ALERT_TYPE_OPTIONS.filter((a) => a.group === group).map((a) => (
                  <label key={a.key} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={alertTypes.has(a.key)} onCheckedChange={() => toggle(alertTypes, a.key, setAlertTypes)} />
                    {a.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Button className="w-fit" variant="outline" onClick={handleSave} disabled={saving}>
        {saving ? "Salvando..." : "Salvar relatórios e alertas"}
      </Button>
    </div>
  );
}
