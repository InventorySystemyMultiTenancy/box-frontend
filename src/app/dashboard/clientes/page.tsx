"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClientFormDialog } from "@/components/dashboard/clients/ClientFormDialog";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { Client } from "@/lib/types";

export default function ClientesPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", q, page],
    queryFn: async () => {
      const res = await api.clients(token!, { q, page, pageSize: 20 });
      return { items: res.items as Client[], pagination: res.pagination };
    },
    enabled: !!token,
  });

  const clients = useMemo(() => data?.items ?? [], [data]);
  const pagination = data?.pagination;

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-sm text-muted-foreground">Cadastro e histórico de clientes da oficina.</p>
        </div>
        {hasPermission("clients", "create") && (
          <ClientFormDialog
            onSaved={refetch}
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo cliente
              </Button>
            }
          />
        )}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF, telefone, placa..."
          className="pl-8"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum cliente encontrado.
                </TableCell>
              </TableRow>
            )}
            {clients.map((client) => (
              <TableRow key={client.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/dashboard/clientes/${client.id}`} className="hover:underline">
                    {client.name}
                  </Link>
                  {!client.active && (
                    <Badge variant="secondary" className="ml-2">
                      Arquivado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{client.email || client.phone || "—"}</TableCell>
                <TableCell>{client.clientType === "COMPANY" ? "Empresa" : "Pessoa física"}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(client.createdAt).toLocaleDateString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {pagination.page} de {pagination.totalPages} — {pagination.total} clientes
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
