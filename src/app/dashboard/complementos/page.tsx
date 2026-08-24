"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { PendingSupplement } from "@/lib/types";

export default function ComplementosPendentesPage() {
  const { token } = useAuth();

  const { data: items, isLoading } = useQuery({
    queryKey: ["pending-supplements"],
    queryFn: async () => (await api.pendingSupplements(token!)).items as PendingSupplement[],
    enabled: !!token,
  });

  const overdueCount = (items ?? []).filter((i) => i.overdue).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Complementos pendentes</h1>
        <p className="text-sm text-muted-foreground">
          Serviços adicionais solicitados depois do orçamento inicial, ainda sem resposta do cliente.
          {overdueCount > 0 && <span className="ml-1 font-medium text-destructive">{overdueCount} atrasado(s).</span>}
        </p>
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Veículo</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Seguradora</TableHead>
              <TableHead>Complemento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Dias aguardando</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            )}
            {!isLoading && (items ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum complemento pendente.</TableCell>
              </TableRow>
            )}
            {(items ?? []).map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  <Link href={`/dashboard?order=${item.serviceOrder.id}`} className="hover:underline">
                    {item.vehicle.brand} {item.vehicle.model} {item.vehicle.plate ? `(${item.vehicle.plate})` : ""}
                  </Link>
                  <div className="text-xs text-muted-foreground">{item.owner?.name}</div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{item.serviceOrder.code}</TableCell>
                <TableCell className="text-muted-foreground">{item.insuranceCompany?.tradeName ?? "—"}</TableCell>
                <TableCell>
                  <div className="font-medium">{item.title}</div>
                  {item.justification && <div className="text-xs text-muted-foreground">{item.justification}</div>}
                </TableCell>
                <TableCell>{item.estimatedValue != null ? `R$ ${item.estimatedValue.toFixed(2)}` : "—"}</TableCell>
                <TableCell>
                  <Badge variant={item.overdue ? "destructive" : "outline"}>{item.daysWaiting} dia(s)</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
