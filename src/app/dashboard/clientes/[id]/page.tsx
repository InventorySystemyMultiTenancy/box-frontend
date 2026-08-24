"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientFormDialog } from "@/components/dashboard/clients/ClientFormDialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { STATUS_LABELS } from "@/lib/types";
import type { ClientDetail } from "@/lib/types";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("pt-BR") : "—";
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { token, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const res = await api.client(id, token!);
      return res.client as ClientDetail;
    },
    enabled: !!token && !!id,
  });

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["client", id] });
    queryClient.invalidateQueries({ queryKey: ["clients"] });
  }

  async function handleArchive() {
    if (!token || !confirm("Arquivar este cliente? Ele deixará de aparecer na lista.")) return;
    try {
      await api.archiveClient(id, token);
      toast.success("Cliente arquivado.");
      router.push("/dashboard/clientes");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível arquivar o cliente.");
    }
  }

  if (isLoading || !client) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <p className="text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push("/dashboard/clientes")}>
        <ArrowLeft className="size-4" />
        Voltar
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
          <p className="text-sm text-muted-foreground">
            {client.clientType === "COMPANY" ? client.company || "Empresa" : "Pessoa física"} · Cliente desde{" "}
            {formatDate(client.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {hasPermission("clients", "edit") && (
            <ClientFormDialog client={client} onSaved={refetch} trigger={<Button variant="outline">Editar</Button>} />
          )}
          {hasPermission("clients", "delete") && (
            <Button variant="outline" onClick={handleArchive}>
              <Archive className="size-4" />
              Arquivar
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Total gasto</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatCurrency(client.totalSpent)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Última visita</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatDate(client.lastVisit)}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Veículos</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{client.vehicles.length}</CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <InfoRow label="CPF/CNPJ" value={client.cpfCnpj} />
          <InfoRow label="RG" value={client.rg} />
          <InfoRow label="Nascimento" value={formatDate(client.birthDate)} />
          <InfoRow label="E-mail" value={client.email} />
          <InfoRow label="Telefone" value={client.phone} />
          <InfoRow label="WhatsApp" value={client.whatsapp} />
          <InfoRow label="Endereço" value={client.addressLine} />
          <InfoRow label="CEP" value={client.zipCode} />
          <InfoRow label="Cidade/Estado" value={[client.city, client.state].filter(Boolean).join(" / ")} />
          {!client.userId && (
            <div className="col-span-2 mt-1">
              <Badge variant="secondary">Sem conta no portal — veículos e OS aparecem após vincular um login</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {client.vehicles.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Veículos</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {client.vehicles.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>
                  {v.brand} {v.model} {v.year}
                </span>
                <span className="text-muted-foreground">{v.plate || "sem placa"}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {client.serviceOrders.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Histórico de ordens de serviço</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {client.serviceOrders.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm">
                <span className="font-mono">{o.code}</span>
                <span className="text-muted-foreground">{STATUS_LABELS[o.status]}</span>
                <span className="text-muted-foreground">{formatDate(o.receivedAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {client.internalNotes && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Observação interna</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{client.internalNotes}</CardContent>
        </Card>
      )}
    </main>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span>{value || "—"}</span>
    </div>
  );
}
