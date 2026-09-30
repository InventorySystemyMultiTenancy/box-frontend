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
// Tailwind + tokens shadcn (bg-card, text-muted-foreground, etc.) só são carregados
// pelo layout do /dashboard normalmente — esta página fica fora dessa árvore de rotas
// (link público, sem login), então precisa importar isso ela mesma.
import "../../dashboard.css";

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
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--shell-bg)" }}>
        <p className="text-sm" style={{ color: "var(--shell-text-muted)" }}>
          Carregando...
        </p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--shell-bg)" }}>
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
          <div className="mb-4 flex justify-center">
            <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className={styles.brandLogo} priority />
          </div>
          <p className="text-sm text-foreground">{error ?? "Link não encontrado."}</p>
        </div>
      </div>
    );
  }

  const isReady = order.status === "READY_FOR_PICKUP";

  return (
    <div className="min-h-screen" style={{ background: "var(--shell-bg)" }}>
      <div className={styles.topbar}>
        <div className={styles.brand}>
          <Image src="/reblind-logo-transparent.png" alt="Reblind" width={655} height={340} className={styles.brandLogo} priority />
        </div>
        <span className="ml-auto text-xs font-medium" style={{ color: "var(--shell-text-muted)" }}>
          Acompanhamento do projeto
        </span>
      </div>

      {/* Hero escuro (mesmo tom do header/sidebar) com o essencial em texto claro —
          o card branco abaixo é só pra progresso/etapa, que já tem cor própria. */}
      <div className="px-4 pb-12 pt-5 sm:pt-8">
        <div className="mx-auto w-full max-w-lg">
          <h1 className="text-xl font-bold leading-tight sm:text-2xl" style={{ color: "var(--shell-text)" }}>
            {order.vehicle.brand} {order.vehicle.model} {order.vehicle.year}
          </h1>
          <p className="mt-1.5 font-mono text-xs" style={{ color: "var(--shell-text-muted)" }}>
            {order.code}
            {order.vehicle.plate ? ` · ${order.vehicle.plate}` : ""} · KM {order.vehicle.mileage.toLocaleString("pt-BR")}
          </p>
          {order.vehicle.ownerName && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--shell-text-muted)" }}>
              {order.vehicle.ownerName}
            </p>
          )}
        </div>
      </div>

      <main className="mx-auto grid w-full max-w-lg gap-4 px-4 pb-10 sm:pb-14" style={{ marginTop: "-1rem" }}>
        <div className={styles.progressCard} style={{ marginBottom: 0 }}>
          <StatusStrip current={order.status} />

          <div className={styles.progressBar} style={{ marginTop: "1rem" }}>
            <div className={styles.progressFill} style={{ width: `${order.progress}%` }} />
          </div>
          <div className={styles.progressLabel}>
            <span>Progresso geral</span>
            <span>{order.progress}%</span>
          </div>

          {isReady && (
            <div className={styles.readyBanner} style={{ marginTop: "0.8rem", marginBottom: 0 }}>
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

        <p className="pb-4 text-center text-xs" style={{ color: "var(--shell-text-muted)" }}>
          Link só de visualização — não dá pra fazer login nem alterar nada por aqui. Válido até{" "}
          {new Date(order.linkExpiresAt).toLocaleDateString("pt-BR")}.
        </p>
      </main>
    </div>
  );
}
