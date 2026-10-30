"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InsuranceCompanyFormDialog } from "@/components/dashboard/insurance/InsuranceCompanyFormDialog";
import { useAuth } from "@/lib/auth-context";
import { ShowMoreButton, useShowMore } from "@/components/ui/show-more";
import { api, ApiError } from "@/lib/api";
import type { InsuranceCompany } from "@/lib/types";

export default function SeguradorasPage() {
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [accreditedOnly, setAccreditedOnly] = useState(false);
  // 10 seguradoras; "Ver mais" busca o resto (volta a 10 quando busca/filtro mudam).
  const { pageSize, showMore } = useShowMore(`${q}|${accreditedOnly}`);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["insurance-companies", q, accreditedOnly, pageSize],
    queryFn: async () => {
      const res = await api.insuranceCompanies(token!, { q, accredited: accreditedOnly ? "true" : undefined, pageSize });
      return { items: res.items as InsuranceCompany[], pagination: res.pagination };
    },
    enabled: !!token,
    placeholderData: keepPreviousData,
  });

  const companies = useMemo(() => data?.items ?? [], [data]);
  const pagination = data?.pagination;

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["insurance-companies"] });
  }

  async function handleArchive(company: InsuranceCompany) {
    if (!token || !confirm(`Arquivar a seguradora "${company.legalName}"?`)) return;
    try {
      await api.archiveInsuranceCompany(company.id, token);
      toast.success("Seguradora arquivada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível arquivar a seguradora.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Seguradoras</h1>
          <p className="text-sm text-muted-foreground">Cadastro de seguradoras vinculadas a OS, orçamentos e vistorias.</p>
        </div>
        {hasPermission("insurance", "manage") && (
          <InsuranceCompanyFormDialog
            onSaved={refetch}
            trigger={
              <Button>
                <Plus className="size-4" />
                Nova seguradora
              </Button>
            }
          />
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ..."
            className="pl-8"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="accredited-filter"
            checked={accreditedOnly}
            onCheckedChange={(v) => {
              setAccreditedOnly(v === true);
            }}
          />
          <Label htmlFor="accredited-filter" className="font-normal">Mostrar somente credenciadas</Label>
        </div>
      </div>

      <div className="min-w-0 rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Credenciamento</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Nome fantasia</TableHead>
              <TableHead>Cidade/UF</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Carregando...</TableCell>
              </TableRow>
            )}
            {!isLoading && companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">Nenhuma seguradora encontrada.</TableCell>
              </TableRow>
            )}
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell>
                  <Badge variant={company.accredited ? "default" : "secondary"}>
                    {company.accredited ? "Credenciada" : "Não credenciada"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {hasPermission("insurance", "manage") ? (
                    <InsuranceCompanyFormDialog
                      company={company}
                      onSaved={refetch}
                      trigger={<button className="hover:underline">{company.legalName}</button>}
                    />
                  ) : (
                    company.legalName
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{company.tradeName || "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {company.city ? `${company.city}${company.state ? `/${company.state}` : ""}` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={company.active ? "outline" : "secondary"}>{company.active ? "Ativa" : "Inativa"}</Badge>
                </TableCell>
                <TableCell>
                  {hasPermission("insurance", "manage") && (
                    <Trash2
                      className="size-4 cursor-pointer text-muted-foreground hover:text-destructive"
                      onClick={() => handleArchive(company)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ShowMoreButton
        shown={companies.length}
        total={pagination?.total ?? 0}
        loading={isFetching && !isLoading}
        onClick={showMore}
        noun="seguradoras"
      />
    </main>
  );
}
