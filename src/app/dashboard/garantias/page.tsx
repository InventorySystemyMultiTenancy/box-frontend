"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { ExpiringWarrantyPart } from "@/lib/types";

export default function GarantiasPage() {
  const { user, token, hasPermission } = useAuth();
  const router = useRouter();
  const allowed = hasPermission("warranties", "view");

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  const [withinDays, setWithinDays] = useState("30");

  const { data: parts, isLoading } = useQuery({
    queryKey: ["expiring-warranties", withinDays],
    queryFn: async () => (await api.expiringWarranties(token!, Number(withinDays))).parts as ExpiringWarrantyPart[],
    enabled: !!token && allowed,
  });

  if (!allowed) return null;

  function isExpired(dateStr?: string | null) {
    return dateStr ? new Date(dateStr) < new Date() : false;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Garantias</h1>
          <p className="text-sm text-muted-foreground">Componentes com garantia vencendo ou já vencida.</p>
        </div>
        <Select value={withinDays} onValueChange={setWithinDays}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Vencendo em 7 dias</SelectItem>
            <SelectItem value="30">Vencendo em 30 dias</SelectItem>
            <SelectItem value="90">Vencendo em 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Componente</TableHead>
              <TableHead>OS</TableHead>
              <TableHead>Veículo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vence em</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (parts ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma garantia vencendo neste período.</TableCell></TableRow>
            )}
            {(parts ?? []).map((part) => (
              <TableRow key={part.id}>
                <TableCell className="font-medium">{part.name}</TableCell>
                <TableCell className="font-mono text-sm">{part.serviceOrder.code}</TableCell>
                <TableCell className="text-muted-foreground">
                  {part.serviceOrder.vehicle.brand} {part.serviceOrder.vehicle.model} {part.serviceOrder.vehicle.plate ? `(${part.serviceOrder.vehicle.plate})` : ""}
                </TableCell>
                <TableCell className="text-muted-foreground">{part.serviceOrder.vehicle.owner.name}</TableCell>
                <TableCell>{part.warrantyExpiresAt ? new Date(part.warrantyExpiresAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell>
                  <Badge variant={isExpired(part.warrantyExpiresAt) ? "destructive" : "outline"}>
                    {isExpired(part.warrantyExpiresAt) ? "Vencida" : "Vencendo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
