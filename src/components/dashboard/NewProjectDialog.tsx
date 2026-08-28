"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Client, RecognizedVehicleData, Vehicle } from "@/lib/types";

const EMPTY_NEW_CLIENT = { name: "", phone: "", email: "" };
const EMPTY_NEW_VEHICLE = { brand: "", model: "", year: "", plate: "", mileage: "0" };

export function NewProjectDialog({ trigger, onCreated }: { trigger: React.ReactNode; onCreated: (orderId: string) => void }) {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newClient, setNewClient] = useState(EMPTY_NEW_CLIENT);

  const [vehicleMode, setVehicleMode] = useState<"existing" | "new">("new");
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [newVehicle, setNewVehicle] = useState(EMPTY_NEW_VEHICLE);

  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<RecognizedVehicleData | null>(null);
  const [includeAiProblems, setIncludeAiProblems] = useState(true);

  const { data: clients } = useQuery({
    queryKey: ["clients-with-login", clientSearch],
    queryFn: async () => ((await api.clients(token!, { q: clientSearch, pageSize: 20 })).items as Client[]).filter((c) => c.userId),
    enabled: !!token && open && clientMode === "existing",
  });

  const selectedClient = clients?.find((c) => c.id === selectedClientId);

  const { data: clientVehicles } = useQuery({
    queryKey: ["vehicles-for-owner", selectedClient?.userId],
    queryFn: async () => (await api.vehicles(token!, { ownerId: selectedClient!.userId! })).vehicles as Vehicle[],
    enabled: !!token && !!selectedClient?.userId && vehicleMode === "existing",
  });

  function resetAll() {
    setClientMode("existing");
    setClientSearch("");
    setSelectedClientId("");
    setNewClient(EMPTY_NEW_CLIENT);
    setVehicleMode("new");
    setSelectedVehicleId("");
    setNewVehicle(EMPTY_NEW_VEHICLE);
    setAiResult(null);
    setIncludeAiProblems(true);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetAll();
    setOpen(next);
  }

  async function handleAiPhoto(file: File | null) {
    if (!file || !token) return;
    setAiBusy(true);
    try {
      const { recognized } = await api.recognizeVehiclePhoto(file, token);
      const data = recognized as RecognizedVehicleData;
      setAiResult(data);
      setVehicleMode("new");
      setNewVehicle((prev) => ({
        ...prev,
        brand: data.brand ?? prev.brand,
        model: data.model ?? prev.model,
        year: data.year ? String(data.year) : prev.year,
        plate: data.plate ?? prev.plate,
      }));
      if (data.visibleProblems.length === 0) {
        toast.info("Veículo identificado — nenhum problema visível encontrado na foto.");
      } else {
        toast.success(`Veículo identificado — ${data.visibleProblems.length} problema(s) visível(is) encontrado(s).`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível analisar a foto.");
    } finally {
      setAiBusy(false);
    }
  }

  async function handleCreate() {
    if (!token) return;
    if (clientMode === "existing" && !selectedClientId) {
      toast.error("Selecione um cliente.");
      return;
    }
    if (clientMode === "new" && (!newClient.name.trim() || !newClient.email.trim())) {
      toast.error("Informe nome e e-mail do novo cliente.");
      return;
    }
    if (vehicleMode === "existing" && !selectedVehicleId) {
      toast.error("Selecione um veículo.");
      return;
    }
    if (vehicleMode === "new" && (!newVehicle.brand.trim() || !newVehicle.model.trim() || !newVehicle.year)) {
      toast.error("Informe marca, modelo e ano do veículo.");
      return;
    }

    setCreating(true);
    try {
      let ownerId: string;
      if (clientMode === "existing") {
        ownerId = selectedClient!.userId!;
      } else {
        const { userId, generatedPassword } = await api.quickCreateClient(
          { name: newClient.name, phone: newClient.phone || undefined, email: newClient.email },
          token
        );
        ownerId = userId;
        toast.success(`Cliente cadastrado — senha gerada: ${generatedPassword}`, { duration: 15000 });
      }

      let vehicleId: string;
      if (vehicleMode === "existing") {
        vehicleId = selectedVehicleId;
      } else {
        const { vehicle } = await api.createVehicle(
          {
            brand: newVehicle.brand,
            model: newVehicle.model,
            year: Number(newVehicle.year),
            plate: newVehicle.plate || undefined,
            mileage: Number(newVehicle.mileage) || 0,
            ownerId,
          },
          token
        );
        vehicleId = (vehicle as Vehicle).id;
      }

      const { order } = await api.createServiceOrder({ vehicleId }, token);
      const orderId = (order as { id: string }).id;

      if (includeAiProblems && aiResult && aiResult.visibleProblems.length > 0) {
        for (const problem of aiResult.visibleProblems) {
          try {
            await api.createProblem(
              orderId,
              {
                key: guessPartKey(problem.location ?? problem.description),
                name: problem.location ?? "Avaria identificada por IA",
                description: problem.description,
                files: [],
              },
              token
            );
          } catch {
            // Um problema individual falhar não deve travar a criação do projeto —
            // o veículo já foi cadastrado, staff pode registrar manualmente depois.
          }
        }
      }

      toast.success("Projeto criado.");
      setOpen(false);
      resetAll();
      onCreated(orderId);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível criar o projeto.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5">
          {/* Cliente */}
          <section className="grid gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</Label>
            <div className="inline-flex w-fit rounded-md border p-0.5 text-sm">
              <button type="button" className={`rounded px-3 py-1 ${clientMode === "existing" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setClientMode("existing")}>
                Cliente existente
              </button>
              <button type="button" className={`rounded px-3 py-1 ${clientMode === "new" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setClientMode("new")}>
                Novo cliente
              </button>
            </div>

            {clientMode === "existing" ? (
              <div className="grid gap-2">
                <Input placeholder="Buscar cliente por nome, telefone..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} />
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente..." /></SelectTrigger>
                  <SelectContent>
                    {(clients ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `· ${c.phone}` : ""}</SelectItem>
                    ))}
                    {(clients ?? []).length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum cliente com acesso encontrado.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input placeholder="Nome *" value={newClient.name} onChange={(e) => setNewClient((p) => ({ ...p, name: e.target.value }))} />
                <Input placeholder="Telefone" value={newClient.phone} onChange={(e) => setNewClient((p) => ({ ...p, phone: e.target.value }))} />
                <Input
                  className="sm:col-span-2"
                  placeholder="E-mail *"
                  type="email"
                  value={newClient.email}
                  onChange={(e) => setNewClient((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
            )}
          </section>

          {/* Veículo */}
          <section className="grid gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Veículo</Label>
            <div className="inline-flex w-fit rounded-md border p-0.5 text-sm">
              <button type="button" className={`rounded px-3 py-1 ${vehicleMode === "new" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setVehicleMode("new")}>
                Novo veículo
              </button>
              <button
                type="button"
                className={`rounded px-3 py-1 ${vehicleMode === "existing" ? "bg-primary text-primary-foreground" : ""}`}
                disabled={clientMode === "new"}
                onClick={() => setVehicleMode("existing")}
              >
                Veículo já cadastrado
              </button>
            </div>

            {vehicleMode === "existing" ? (
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger><SelectValue placeholder="Selecione o veículo..." /></SelectTrigger>
                <SelectContent>
                  {(clientVehicles ?? []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} {v.year} {v.plate ? `· ${v.plate}` : ""}</SelectItem>
                  ))}
                  {(clientVehicles ?? []).length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Este cliente ainda não tem veículo cadastrado.</div>
                  )}
                </SelectContent>
              </Select>
            ) : (
              <>
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground">
                  <Sparkles className="size-4" />
                  {aiBusy ? "Analisando foto..." : "Tirar foto do carro (IA identifica veículo e problemas)"}
                  <input type="file" accept="image/*" capture="environment" className="hidden" disabled={aiBusy} onChange={(e) => handleAiPhoto(e.target.files?.[0] ?? null)} />
                </label>
                {aiResult && (
                  <div className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground">
                    {aiResult.visibleProblems.length > 0 ? (
                      <>
                        <p className="mb-1 font-medium text-foreground">Problemas visíveis identificados pela IA:</p>
                        <ul className="list-disc pl-4">
                          {aiResult.visibleProblems.map((p, i) => (
                            <li key={i}>{p.description}{p.location ? ` — ${p.location}` : ""}</li>
                          ))}
                        </ul>
                        <label className="mt-2 flex items-center gap-2">
                          <Checkbox checked={includeAiProblems} onCheckedChange={(v) => setIncludeAiProblems(v === true)} />
                          <span>Cadastrar estes problemas no projeto</span>
                        </label>
                      </>
                    ) : (
                      <p>Nenhum problema visível — o veículo foi cadastrado, o campo de problema fica pendente para diagnóstico.</p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input placeholder="Marca *" value={newVehicle.brand} onChange={(e) => setNewVehicle((p) => ({ ...p, brand: e.target.value }))} />
                  <Input placeholder="Modelo *" value={newVehicle.model} onChange={(e) => setNewVehicle((p) => ({ ...p, model: e.target.value }))} />
                  <Input placeholder="Ano *" type="number" value={newVehicle.year} onChange={(e) => setNewVehicle((p) => ({ ...p, year: e.target.value }))} />
                  <Input placeholder="Placa" value={newVehicle.plate} onChange={(e) => setNewVehicle((p) => ({ ...p, plate: e.target.value }))} />
                  <Input
                    className="sm:col-span-2"
                    placeholder="Quilometragem"
                    type="number"
                    value={newVehicle.mileage}
                    onChange={(e) => setNewVehicle((p) => ({ ...p, mileage: e.target.value }))}
                  />
                </div>
              </>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "Criando..." : "Criar projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const KEY_KEYWORDS: Record<string, string> = {
  "para-choque": "carroceria",
  parachoque: "carroceria",
  porta: "carroceria",
  capo: "carroceria",
  teto: "carroceria",
  lataria: "carroceria",
  pneu: "pneus",
  roda: "pneus",
  freio: "freios",
  farol: "eletrica",
  lanterna: "eletrica",
  bateria: "bateria",
  vidro: "carroceria",
  parabrisa: "carroceria",
  retrovisor: "carroceria",
};

function guessPartKey(text: string): string {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  for (const [keyword, key] of Object.entries(KEY_KEYWORDS)) {
    if (normalized.includes(keyword)) return key;
  }
  return "carroceria";
}
