"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { NotificationLog } from "@/lib/types";

export default function NotificacoesPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const allowed = user?.role === "ADMIN" || user?.role === "MECHANIC";

  useEffect(() => {
    if (user && !allowed) router.replace("/dashboard");
  }, [user, allowed, router]);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.notifications(token!)).notifications as NotificationLog[],
    enabled: !!token && allowed,
  });

  if (!allowed) return null;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
        <p className="text-sm text-muted-foreground">
          Histórico de SMS/WhatsApp disparados automaticamente a cada mudança de status de OS (provider MOCK — sem envio real; troque
          o provider em <code>src/services/notifications</code> no backend para conectar uma operadora).
        </p>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Canal</TableHead>
              <TableHead>Para</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && (notifications ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhuma notificação enviada.</TableCell></TableRow>
            )}
            {(notifications ?? []).map((n) => (
              <TableRow key={n.id}>
                <TableCell>{n.channel === "WHATSAPP" ? "WhatsApp" : "SMS"}</TableCell>
                <TableCell className="text-muted-foreground">{n.to}</TableCell>
                <TableCell className="max-w-sm truncate">{n.message}</TableCell>
                <TableCell>
                  <Badge variant={n.status === "SENT" ? "default" : "destructive"}>{n.status === "SENT" ? "Enviada" : "Falhou"}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(n.createdAt).toLocaleString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
