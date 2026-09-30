"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { api, ApiError, API_URL } from "@/lib/api";
import type { Approval, ProblemPartUsage, PublicServiceOrder } from "@/lib/types";
import StatusStrip from "@/components/dashboard/StatusStrip";
import Timeline from "@/components/dashboard/Timeline";
import VehicleSchematic from "@/components/dashboard/VehicleSchematic";
import styles from "@/components/dashboard/dashboard.module.css";

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

// VehicleSchematic espera Approval.partUsages no formato "cheio" (com InventoryPart
// completo) porque é o mesmo componente usado na tela autenticada — o link público só
// devolve o nome da peça (sem custo/estoque, que não são pra aparecer aqui). Só
// quantidade e nome são de fato lidos pelo componente, então o resto do objeto é
// preenchido de forma mínima só pra satisfazer o tipo.
function toDisplayApprovals(approvals: PublicServiceOrder["approvals"]): Approval[] {
  return approvals.map((a) => ({
    ...a,
    partUsages: a.partUsages.map((u) => ({
      id: u.id,
      quantity: u.quantity,
      inventoryPart: { name: u.partName },
    })) as unknown as ProblemPartUsage[],
  }));
}

export default function ShareLinkPage() {
  const params = useParams<{ token: string }>();
  const [order, setOrder] = useState<PublicServiceOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .publicShareOrder(params.token)
      .then(({ order }) => {
        if (!cancelled) setOrder(order as PublicServiceOrder);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Não foi possível abrir este link.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
          <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className="mx-auto mb-4 h-10 w-auto" priority />
          <p className="text-sm text-foreground">{error ?? "Link não encontrado."}</p>
        </div>
      </main>
    );
  }

  const isReady = order.status === "READY_FOR_PICKUP";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-lg gap-4">
        <div className="flex items-center justify-between">
          <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className="h-9 w-auto" priority />
          <span className="text-right text-xs font-medium text-muted-foreground">Acompanhamento do projeto</span>
        </div>

        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-1 text-sm text-muted-foreground">
            {order.vehicle.brand} {order.vehicle.model} {order.vehicle.year}
            {order.vehicle.plate ? ` · ${order.vehicle.plate}` : ""}
          </div>
          <div className="mb-3 font-mono text-xs text-muted-foreground">
            {order.code} · KM {order.vehicle.mileage.toLocaleString("pt-BR")}
            {order.vehicle.ownerName ? ` · ${order.vehicle.ownerName}` : ""}
          </div>

          <StatusStrip current={order.status} />

          <div className={styles.progressCard}>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${order.progress}%` }} />
            </div>
            <div className={styles.progressLabel}>
              <span>Progresso geral</span>
              <span>{order.progress}%</span>
            </div>
          </div>

          {isReady && (
            <div className={styles.readyBanner} style={{ marginTop: "0.8rem" }}>
              Veículo pronto e em ótimo estado — pode retirar!
            </div>
          )}
        </div>

        <div className={styles.panel}>
          <h2>Modelo do veículo</h2>
          <VehicleSchematic parts={order.parts} approvals={toDisplayApprovals(order.approvals)} canViewPrices />
        </div>

        {order.media.length > 0 && (
          <div className={styles.panel}>
            <h2>Fotos do veículo</h2>
            <div className={styles.mediaGrid}>
              {order.media
                .filter((m) => m.type === "PHOTO")
                .map((media) => (
                  <a key={media.id} href={mediaUrl(media.url)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(media.url)} alt={media.label ?? "Foto do veículo"} />
                  </a>
                ))}
            </div>
          </div>
        )}

        <div className={styles.panel}>
          <h2>Linha do tempo</h2>
          <Timeline events={order.timelineEvents} canViewPrices />
        </div>

        <p className="pb-4 text-center text-xs text-muted-foreground">
          Link só de visualização — não dá pra fazer login nem alterar nada por aqui. Válido até{" "}
          {new Date(order.linkExpiresAt).toLocaleDateString("pt-BR")}.
        </p>
      </div>
    </main>
  );
}
