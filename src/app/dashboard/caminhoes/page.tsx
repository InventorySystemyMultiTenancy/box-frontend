"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Truck as TruckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TruckFormDialog } from "@/components/dashboard/trucks/TruckFormDialog";
import { StartTripDialog } from "@/components/dashboard/trucks/StartTripDialog";
import { FinishTripDialog } from "@/components/dashboard/trucks/FinishTripDialog";
import { RefuelingDialog } from "@/components/dashboard/trucks/RefuelingDialog";
import { TruckMovementsPanel } from "@/components/dashboard/trucks/TruckMovementsPanel";
import { TruckRefuelingsPanel } from "@/components/dashboard/trucks/TruckRefuelingsPanel";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Truck } from "@/lib/types";

export default function CaminhoesPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const [view, setView] = useState<"trucks" | "movements" | "refuelings">("trucks");

  const { data: trucks, isLoading } = useQuery({
    queryKey: ["trucks"],
    queryFn: async () => (await api.trucks(token!)).trucks as Truck[],
    enabled: !!token,
  });

  const myTrucks = useMemo(() => (trucks ?? []).filter((t) => t.assignedEmployeeId === user?.id), [trucks, user?.id]);

  function refetch() {
    queryClient.invalidateQueries({ queryKey: ["trucks"] });
  }

  async function handleArchive(truck: Truck) {
    if (!token || !confirm(`Excluir o caminhão ${truck.plate}?`)) return;
    try {
      await api.archiveTruck(truck.id, token);
      toast.success("Caminhão excluído.");
      refetch();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível excluir o caminhão.");
    }
  }

  const visibleTrucks = isAdmin ? trucks ?? [] : myTrucks;
  const noTrucksAssigned = !isAdmin && !isLoading && myTrucks.length === 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Caminhões</h1>
          <p className="text-sm text-muted-foreground">Controle de uso dos caminhões usados para buscar veículos de clientes.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && view === "trucks" && (
            <TruckFormDialog
              onSaved={refetch}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Novo caminhão
                </Button>
              }
            />
          )}
          <div className="inline-flex rounded-md border p-0.5 text-sm">
            <button
              type="button"
              className={`rounded px-3 py-1 ${view === "trucks" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setView("trucks")}
            >
              Caminhões
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 ${view === "movements" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setView("movements")}
            >
              Movimentações
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 ${view === "refuelings" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setView("refuelings")}
            >
              Abastecimentos
            </button>
          </div>
        </div>
      </div>

      {view === "movements" ? (
        <TruckMovementsPanel />
      ) : view === "refuelings" ? (
        <TruckRefuelingsPanel />
      ) : noTrucksAssigned ? (
        <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">
          Nenhum caminhão está atribuído a você no momento.
        </p>
      ) : (
        <>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {!isLoading && visibleTrucks.length === 0 && (
            <p className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nenhum caminhão cadastrado.</p>
          )}

          <div className="grid gap-3">
            {visibleTrucks.map((truck) => {
              const openTrip = truck.trips?.[0];
              const canOperate = isAdmin || truck.assignedEmployeeId === user?.id;
              return (
                <Card key={truck.id}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                      <span className="flex items-center gap-2">
                        <TruckIcon className="size-4 text-muted-foreground" />
                        {truck.plate}
                        {(truck.brand || truck.model) && (
                          <span className="text-sm font-normal text-muted-foreground">
                            {truck.brand} {truck.model} {truck.year}
                          </span>
                        )}
                      </span>
                      <Badge variant={openTrip ? "default" : "outline"}>{openTrip ? "Em uso" : "Disponível"}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-1 text-sm text-muted-foreground">
                      <span>Responsável: {truck.assignedEmployee?.name ?? "Nenhum funcionário atribuído"}</span>
                      {openTrip && (
                        <span>
                          Com {openTrip.driver?.name} desde {new Date(openTrip.startedAt).toLocaleString("pt-BR")} · km inicial{" "}
                          {openTrip.startKm.toLocaleString("pt-BR")}
                        </span>
                      )}
                      {truck.notes && <span>{truck.notes}</span>}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {canOperate && !openTrip && <StartTripDialog truck={truck} onSaved={refetch} />}
                      {canOperate && openTrip && <RefuelingDialog truck={truck} onSaved={refetch} />}
                      {canOperate && openTrip && <FinishTripDialog truck={truck} trip={openTrip} onSaved={refetch} />}
                      {isAdmin && (
                        <>
                          <TruckFormDialog truck={truck} onSaved={refetch} trigger={<Button size="sm" variant="ghost">Editar</Button>} />
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleArchive(truck)}>
                            <Trash2 className="size-4" />
                            Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
