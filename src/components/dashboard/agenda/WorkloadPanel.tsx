"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { MechanicWorkload } from "@/lib/types";

function firstDayOfWeek() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().slice(0, 10);
}

export default function WorkloadPanel() {
  const { token } = useAuth();
  const [from, setFrom] = useState(firstDayOfWeek());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data: workload, isLoading } = useQuery({
    queryKey: ["mechanic-workload", from, to],
    queryFn: async () => (await api.mechanicWorkload(token!, { from, to })).workload as MechanicWorkload[],
    enabled: !!token,
  });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="wl-from">De</Label>
          <Input id="wl-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wl-to">Até</Label>
          <Input id="wl-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mecânico</TableHead>
              <TableHead>Agendamentos</TableHead>
              <TableHead>Horas estimadas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (workload ?? []).length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Nenhum agendamento no período.</TableCell></TableRow>
            )}
            {(workload ?? []).map((w) => (
              <TableRow key={w.mechanicId}>
                <TableCell className="font-medium">{w.mechanicName}</TableCell>
                <TableCell>{w.appointments}</TableCell>
                <TableCell>{(w.totalMinutes / 60).toFixed(1)}h</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
