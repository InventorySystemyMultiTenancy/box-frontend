"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { BankAccount, Commission, CommissionStatus } from "@/lib/types";

const STATUS_LABELS: Record<CommissionStatus, string> = { PENDING: "Pendente", PAID: "Paga", CANCELLED: "Cancelada" };
const STATUS_VARIANTS: Record<CommissionStatus, "default" | "secondary" | "outline"> = {
  PENDING: "outline",
  PAID: "default",
  CANCELLED: "secondary",
};

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function ComissoesPage() {
  const { user, token, hasPermission } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const allowed = hasPermission("commissions", "view");
  const canManage = hasPermission("commissions", "manage");

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: commissions, isLoading } = useQuery({
    queryKey: ["commissions", status],
    queryFn: async () => (await api.commissions(token!, { status: status || undefined, pageSize: 50 })).items as Commission[],
    enabled: !!token && allowed,
  });

  const { data: accounts } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => (await api.bankAccounts(token!)).accounts as BankAccount[],
    enabled: !!token && canManage,
  });

  if (!allowed) return null;

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["commissions"] });
  }

  async function handleGenerate() {
    if (!token) return;
    setGenerating(true);
    try {
      const res = await api.generateCommissions({ from, to }, token);
      toast.success(`${res.created.length} comissão(ões) gerada(s).`);
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível gerar comissões.");
    } finally {
      setGenerating(false);
    }
  }

  async function handlePay(commission: Commission, bankAccountId?: string) {
    if (!token) return;
    try {
      await api.payCommission(commission.id, { bankAccountId }, token);
      toast.success("Comissão paga — conta a pagar gerada.");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["payables"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível pagar a comissão.");
    }
  }

  async function handleCancel(commission: Commission) {
    if (!token || !confirm("Cancelar esta comissão?")) return;
    try {
      await api.cancelCommission(commission.id, token);
      toast.success("Comissão cancelada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível cancelar.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Comissões</h1>
        <p className="text-sm text-muted-foreground">
          Comissão calculada sobre reparos aprovados atribuídos ao mecânico responsável, usando o percentual cadastrado em{" "}
          <strong>Usuários</strong>.
        </p>
      </div>

      {canManage && (
        <div className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
          <div className="grid gap-1.5">
            <Label htmlFor="com-from">De</Label>
            <Input id="com-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="com-to">Até</Label>
            <Input id="com-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? "Gerando..." : "Gerar comissões do período"}
          </Button>
        </div>
      )}

      <div className="mb-4">
        <Select value={status || "ALL"} onValueChange={(v) => setStatus(v === "ALL" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mecânico</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Reparo</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Taxa</TableHead>
              <TableHead>Comissão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-48" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (commissions ?? []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma comissão encontrada.</TableCell></TableRow>
            )}
            {(commissions ?? []).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.mechanic.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.serviceOrder.code}</TableCell>
                <TableCell className="text-muted-foreground">{c.approval.title}</TableCell>
                <TableCell>R$ {c.baseAmount.toFixed(2)}</TableCell>
                <TableCell>{(c.rate * 100).toFixed(1)}%</TableCell>
                <TableCell className="font-medium">R$ {c.amount.toFixed(2)}</TableCell>
                <TableCell><Badge variant={STATUS_VARIANTS[c.status]}>{STATUS_LABELS[c.status]}</Badge></TableCell>
                <TableCell>
                  {canManage && c.status === "PENDING" && (
                    <div className="flex justify-end gap-2">
                      <Select onValueChange={(v) => handlePay(c, v === "NONE" ? undefined : v)}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Pagar..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">Sem conta</SelectItem>
                          {(accounts ?? []).map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleCancel(c)}>
                        Cancelar
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
