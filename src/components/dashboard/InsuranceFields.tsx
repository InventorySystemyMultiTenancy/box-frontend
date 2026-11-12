"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type InsuranceValue = {
  hasInsurance: boolean;
  /** Id da seguradora escolhida, ou NEW_INSURANCE para cadastrar uma nova pelo nome. */
  insuranceCompanyId: string;
  newInsuranceCompanyName: string;
  deductibleAmount: string;
};

export const NEW_INSURANCE = "__new__";

export const EMPTY_INSURANCE: InsuranceValue = { hasInsurance: false, insuranceCompanyId: "", newInsuranceCompanyName: "", deductibleAmount: "" };

export function insuranceFromOrder(order: { hasInsurance?: boolean; insuranceCompanyId?: string | null; deductibleAmount?: number | null }): InsuranceValue {
  return {
    hasInsurance: !!order.hasInsurance,
    insuranceCompanyId: order.insuranceCompanyId ?? "",
    newInsuranceCompanyName: "",
    deductibleAmount: order.deductibleAmount != null ? String(order.deductibleAmount) : "",
  };
}

/** Valida e converte para o payload do backend ({ error } quando inválido). */
export function insurancePayload(value: InsuranceValue): { error: string } | Record<string, unknown> {
  if (!value.hasInsurance) return { hasInsurance: false };
  const isNew = value.insuranceCompanyId === NEW_INSURANCE;
  if (isNew && !value.newInsuranceCompanyName.trim()) return { error: "Informe o nome da nova seguradora." };
  // "2.500,00" (formato BR) ou "2500.5" (sem vírgula, como vem do banco).
  const typed = value.deductibleAmount.trim().replace(/^R\$\s*/i, "");
  const raw = typed.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(typed) ? typed.replace(/\./g, "").replace(",", ".") : typed;
  const deductible = raw === "" ? null : Number(raw);
  if (deductible != null && (!Number.isFinite(deductible) || deductible < 0)) return { error: "Valor da franquia inválido." };
  return {
    hasInsurance: true,
    insuranceCompanyId: isNew ? null : value.insuranceCompanyId || null,
    ...(isNew ? { newInsuranceCompanyName: value.newInsuranceCompanyName.trim() } : {}),
    deductibleAmount: deductible,
  };
}

/** "Veículo tem seguro?" + seguradora (existente ou nova) + valor da franquia. */
export function InsuranceFields({ value, onChange, idPrefix }: { value: InsuranceValue; onChange: (value: InsuranceValue) => void; idPrefix: string }) {
  const { token } = useAuth();
  const { data } = useQuery({
    queryKey: ["insurance-options"],
    queryFn: () => api.insuranceOptions(token!),
    enabled: !!token && value.hasInsurance,
    staleTime: 60_000,
  });
  const companies = data?.companies ?? [];
  const set = (patch: Partial<InsuranceValue>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-3">
      <div className="inline-flex w-fit rounded-md border p-0.5 text-sm">
        {[
          { v: false, label: "Sem seguro" },
          { v: true, label: "Tem seguro" },
        ].map((opt) => (
          <button
            key={opt.label}
            type="button"
            className={`rounded px-3 py-1 ${value.hasInsurance === opt.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => set({ hasInsurance: opt.v })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {value.hasInsurance && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-insurer`}>Seguradora</Label>
            <Select value={value.insuranceCompanyId || undefined} onValueChange={(v) => set({ insuranceCompanyId: v })}>
              <SelectTrigger id={`${idPrefix}-insurer`}>
                <SelectValue placeholder="Selecione a seguradora" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tradeName || c.legalName}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_INSURANCE}>+ Cadastrar nova seguradora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${idPrefix}-deductible`}>Valor da franquia (R$)</Label>
            <Input
              id={`${idPrefix}-deductible`}
              inputMode="decimal"
              placeholder="Ex.: 2.500,00"
              value={value.deductibleAmount}
              onChange={(e) => set({ deductibleAmount: e.target.value })}
            />
          </div>
          {value.insuranceCompanyId === NEW_INSURANCE && (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor={`${idPrefix}-new-insurer`}>Nome da nova seguradora</Label>
              <Input
                id={`${idPrefix}-new-insurer`}
                maxLength={120}
                placeholder="Ex.: Porto Seguro"
                value={value.newInsuranceCompanyName}
                onChange={(e) => set({ newInsuranceCompanyName: e.target.value })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
