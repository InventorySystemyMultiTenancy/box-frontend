"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { api, API_URL } from "@/lib/api";
import type { TruckTrip } from "@/lib/types";

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("pt-BR");
}

function MovementPhoto({ label, url }: { label: string; url: string }) {
  return (
    <a href={mediaUrl(url)} target="_blank" rel="noreferrer" className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mediaUrl(url)} alt={label} className="h-28 w-40 rounded-md border object-cover" />
    </a>
  );
}

function MovementCard({ trip }: { trip: TruckTrip }) {
  const inProgress = trip.status === "IN_PROGRESS";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span>
            {trip.truck?.plate}
            {(trip.truck?.brand || trip.truck?.model) && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {trip.truck?.brand} {trip.truck?.model}
              </span>
            )}
          </span>
          <Badge variant={inProgress ? "default" : "outline"}>{inProgress ? "Em andamento" : "Concluída"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saída</span>
          <span>Motorista: {trip.driver?.name ?? "—"}</span>
          <span>Data: {formatDate(trip.startedAt)}</span>
          <span>Km: {trip.startKm.toLocaleString("pt-BR")}</span>
          <span>Combustível: {trip.startFuelLevel}</span>
          {trip.startCondition && <span>Estado do caminhão: {trip.startCondition}</span>}
          {trip.startPhotoUrl && <MovementPhoto label="Foto na saída" url={trip.startPhotoUrl} />}
        </div>

        <div className="grid gap-1.5 text-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Devolução</span>
          {inProgress ? (
            <span className="text-muted-foreground">Ainda não devolvido.</span>
          ) : (
            <>
              <span>Data: {formatDate(trip.endedAt)}</span>
              <span>Km: {trip.endKm?.toLocaleString("pt-BR")}</span>
              <span>Combustível: {trip.endFuelLevel}</span>
              {trip.endCondition && <span>Estado do caminhão: {trip.endCondition}</span>}
              {trip.notes && <span>Observações: {trip.notes}</span>}
              {trip.endPhotoUrl && <MovementPhoto label="Foto na devolução" url={trip.endPhotoUrl} />}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function TruckMovementsPanel() {
  const { token } = useAuth();

  const { data: trips, isLoading } = useQuery({
    queryKey: ["truck-movements"],
    queryFn: async () => (await api.truckMovements(token!)).trips as TruckTrip[],
    enabled: !!token,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  if (!trips || trips.length === 0) {
    return <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>;
  }

  return (
    <div className="grid gap-3">
      {trips.map((trip) => (
        <MovementCard key={trip.id} trip={trip} />
      ))}
    </div>
  );
}
