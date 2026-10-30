"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SupplierFormDialog } from "@/components/dashboard/suppliers/SupplierFormDialog";
import { useAuth } from "@/lib/auth-context";
import { ShowMoreButton, useShowMore } from "@/components/ui/show-more";
import { api, ApiError } from "@/lib/api";
import type { Supplier } from "@/lib/types";

export default function FornecedoresPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  // 10 fornecedores; "Ver mais" busca o resto (volta a 10 quando a busca muda).
  const { pageSize, showMore } = useShowMore(q);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["suppliers", q, pageSize],
    queryFn: async () => {
      const res = await api.suppliers(token!, { q, pageSize });
      return { items: res.items as Supplier[], pagination: res.pagination };
    },
    enabled: !!token,
    placeholderData: keepPreviousData,
  });

  const suppliers = useMemo(() => data?.items ?? [], [data]);
  const pagination = data?.pagination;

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["suppliers"] });
  }

  async function handleArchive(supplier: Supplier) {
    if (!token || !confirm(`Arquivar o fornecedor "${supplier.name}"?`)) return;
    try {
      await api.archiveSupplier(supplier.id, token);
      toast.success("Fornecedor arquivado.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível arquivar o fornecedor.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
          <p className="text-sm text-muted-foreground">Cadastro de fornecedores para pedidos de compra.</p>
        </div>
        {hasPermission("suppliers", "manage") && (
          <SupplierFormDialog
            onSaved={() => void refetch()}
            trigger={
              <Button>
                <Plus className="size-4" />
                Novo fornecedor
              </Button>
            }
          />
        )}
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail, CNPJ..."
          className="pl-8"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
          }}
        />
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead className="w-10" />
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
            {!isLoading && suppliers.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum fornecedor encontrado.
                </TableCell>
              </TableRow>
            )}
            {suppliers.map((supplier) => (
              <TableRow key={supplier.id}>
                <TableCell className="font-medium">
                  {hasPermission("suppliers", "manage") ? (
                    <SupplierFormDialog
                      supplier={supplier}
                      onSaved={() => void refetch()}
                      trigger={<button className="hover:underline">{supplier.name}</button>}
                    />
                  ) : (
                    supplier.name
                  )}
                  {!supplier.active && (
                    <Badge variant="secondary" className="ml-2">
                      Arquivado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {supplier.contactName || supplier.email || supplier.phone || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {supplier.city ? `${supplier.city}${supplier.state ? `/${supplier.state}` : ""}` : "—"}
                </TableCell>
                <TableCell>
                  {hasPermission("suppliers", "manage") && (
                    <Trash2
                      className="size-4 cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => handleArchive(supplier)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ShowMoreButton
        shown={suppliers.length}
        total={pagination?.total ?? 0}
        loading={isFetching && !isLoading}
        onClick={showMore}
        noun="fornecedores"
      />
    </main>
  );
}
