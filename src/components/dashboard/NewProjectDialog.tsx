"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SignaturePad, SignaturePadHandle } from "@/components/ui/signature-pad";
import { CameraOrGalleryPicker } from "@/components/ui/camera-or-gallery-picker";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import type { Client, PlateLookupResult, RecognizedVehicleData, ServiceOrderPriority, Vehicle } from "@/lib/types";
import { PRIORITY_LABELS, SERVICE_ORDER_PRIORITIES } from "@/lib/types";

const EMPTY_NEW_CLIENT = { name: "", phone: "", email: "" };
// color/version/fuelType/chassi só são preenchidos pela consulta de placa (vão no cadastro).
const EMPTY_NEW_VEHICLE = { brand: "", model: "", year: "", plate: "", mileage: "0", color: "", version: "", fuelType: "", chassi: "" };

// Placa antiga (ABC1234) ou Mercosul (ABC1D23), já sem traço/espaço.
const PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

function plateLookupSummary(r: PlateLookupResult) {
  return [
    [r.brand, r.model, r.version].filter(Boolean).join(" "),
    r.year || r.modelYear ? `${r.year ?? "?"}/${r.modelYear ?? "?"}` : null,
    r.color,
    r.fuelType,
    r.city && r.state ? `${r.city}/${r.state}` : r.state,
  ]
    .filter(Boolean)
    .join(" · ");
}
const MAX_DAMAGE_PHOTOS = 7;
// Enquanto não há integração com a Localiza: as fotos de avaria ficam salvas no aparelho e
// o botão abaixo do campo abre o acompanhamento de carros do portal para anexá-las lá.
const LOCALIZA_TRACKING_URL = "https://fornecedor.localiza.com/portal/#/operacional/acompanhamento-carros";

/** Baixa as fotos para o dispositivo (pasta de downloads / galeria, conforme o aparelho). */
function saveFilesToDevice(files: File[], prefix: string, startIndex: number) {
  files.forEach((file, i) => {
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".jpg";
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${prefix}-${startIndex + i + 1}${ext}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  });
}

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
  const [plateResult, setPlateResult] = useState<PlateLookupResult | null>(null);

  const [priority, setPriority] = useState<ServiceOrderPriority>("NORMAL");
  const [damagePhotos, setDamagePhotos] = useState<File[]>([]);
  const checkinSignatureRef = useRef<SignaturePadHandle>(null);

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
    setPlateResult(null);
    setPriority("NORMAL");
    setDamagePhotos([]);
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
        color: data.color ?? prev.color,
      }));
      // Placa lida na foto já é consultada no backend — marca/modelo/ano acima vêm de lá.
      // Se a consulta não funcionou (sem token, não achou, erro), segue só com a IA, sem aviso.
      if (data.plateLookup) applyPlateLookup(data.plateLookup);
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

  function applyPlateLookup(result: PlateLookupResult) {
    setPlateResult(result);
    setNewVehicle((prev) => ({
      ...prev,
      plate: result.plate,
      brand: result.brand ?? prev.brand,
      model: result.model ?? prev.model,
      year: result.modelYear ?? result.year ? String(result.modelYear ?? result.year) : prev.year,
      color: result.color ?? prev.color,
      version: result.version ?? prev.version,
      fuelType: result.fuelType ?? prev.fuelType,
      chassi: result.chassi ?? prev.chassi,
    }));
  }

  // Placa digitada à mão: consulta ao sair do campo. Silenciosa — se a consulta não
  // estiver configurada, não achar ou falhar, o formulário só segue como está.
  async function handlePlateBlur() {
    const plate = newVehicle.plate.replace(/[^a-z0-9]/gi, "").toUpperCase();
    if (!token || !PLATE_PATTERN.test(plate) || plateResult?.plate === plate) return;
    try {
      const { status, result } = await api.lookupPlate(plate, token);
      if (status === "FOUND" && result) applyPlateLookup(result as PlateLookupResult);
    } catch {
      // Sem aviso: a consulta de placa é só um complemento.
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
            color: newVehicle.color || undefined,
            version: newVehicle.version || undefined,
            fuelType: newVehicle.fuelType || undefined,
            chassi: newVehicle.chassi || undefined,
            ownerId,
          },
          token
        );
        vehicleId = (vehicle as Vehicle).id;
      }

      const { order } = await api.createServiceOrder({ vehicleId, priority }, token);
      const orderId = (order as { id: string }).id;

      if (damagePhotos.length > 0) {
        try {
          await api.uploadDamagePhotos(orderId, damagePhotos, token);
        } catch {
          // Projeto já foi criado — não trava o fluxo se o upload das fotos falhar,
          // staff pode reenviar depois (não há tela dedicada ainda, mas evita perder o projeto).
          toast.error("Projeto criado, mas não foi possível enviar as fotos de avaria.");
        }
      }

      const signature = await checkinSignatureRef.current?.toBlob();
      if (signature) {
        try {
          await api.uploadSignature(orderId, "CHECKIN", signature, token);
        } catch {
          toast.error("Projeto criado, mas não foi possível salvar a assinatura do cliente.");
        }
      }

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
      <DialogContent className="sm:max-w-xl">
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
                <div className="grid gap-1.5 rounded-md border border-dashed px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="size-4" />
                    {aiBusy ? "Analisando foto..." : "Foto do carro (IA identifica veículo e problemas)"}
                  </span>
                  <CameraOrGalleryPicker disabled={aiBusy} onFiles={(files) => handleAiPhoto(files[0] ?? null)} />
                </div>
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
                  <Input
                    placeholder="Placa"
                    value={newVehicle.plate}
                    onBlur={handlePlateBlur}
                    onChange={(e) => {
                      // Placa mudou: dados da consulta anterior não valem mais para este carro.
                      setNewVehicle((p) => ({ ...p, plate: e.target.value, version: "", fuelType: "", chassi: "" }));
                      setPlateResult(null);
                    }}
                  />
                  {plateResult && (
                    <div className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground sm:col-span-2">
                      <span className="font-medium text-foreground">Confirmado pela placa {plateResult.plate}:</span> {plateLookupSummary(plateResult)}
                    </div>
                  )}
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

          {/* Prioridade */}
          <section className="grid gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as ServiceOrderPriority)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICE_ORDER_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          {/* Checklist de fotos de avaria pré-existente */}
          <section className="grid gap-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fotos de avarias já existentes (até {MAX_DAMAGE_PHOTOS})
            </Label>
            <CameraOrGalleryPicker
              multiple
              disabled={damagePhotos.length >= MAX_DAMAGE_PHOTOS}
              onFiles={(selected) => {
                const files = selected.slice(0, MAX_DAMAGE_PHOTOS - damagePhotos.length);
                setDamagePhotos((prev) => [...prev, ...files].slice(0, MAX_DAMAGE_PHOTOS));
                // Cópia no aparelho, para anexar também no portal da Localiza.
                const vehiclePlate = vehicleMode === "new" ? newVehicle.plate : clientVehicles?.find((v) => v.id === selectedVehicleId)?.plate;
                const plate = vehiclePlate?.replace(/[^a-z0-9]/gi, "").toUpperCase();
                saveFilesToDevice(files, `avaria-${plate || new Date().toISOString().slice(0, 10)}`, damagePhotos.length);
              }}
            />
            {damagePhotos.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {damagePhotos.map((file, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-md border px-2 py-1">
                    {file.name}
                    <button
                      type="button"
                      className="text-destructive"
                      onClick={() => setDamagePhotos((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              As fotos também são salvas neste aparelho. Para colocá-las na Localiza, abra o veículo em
              &quot;Em serviço&quot;, clique em &quot;Imagens&quot; e anexe as fotos salvas.
            </p>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href={LOCALIZA_TRACKING_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Enviar fotos também na Localiza
              </a>
            </Button>
          </section>

          {/* Assinatura do cliente no laudo de entrada — confirma o estado em que o carro
              chegou (avarias acima). Opcional: o cliente pode não estar presente. */}
          <section className="grid gap-2">
            <SignaturePad ref={checkinSignatureRef} label="Assinatura do cliente na entrada (opcional)" />
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
