"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, API_URL } from "@/lib/api";
import { MAX_DAMAGE_PHOTOS, uploadDamagePhotosInBatches } from "@/lib/damage-photos";
import type { Media } from "@/lib/types";
import { CameraOrGalleryPicker } from "@/components/ui/camera-or-gallery-picker";
import styles from "./dashboard.module.css";

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

/**
 * Fotos do checklist de entrada (avarias que o carro já tinha ao chegar), visíveis em
 * qualquer etapa do projeto — antes ficavam atrás de um botão discreto. Staff pode
 * adicionar mais (ou reenviar as que falharam na criação do projeto), até o limite.
 */
export default function DamagePhotosPanel({
  orderId,
  photos,
  canAdd,
  onUploaded,
}: {
  orderId: string;
  photos: Media[];
  canAdd: boolean;
  onUploaded: (photos: Media[]) => void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const remaining = MAX_DAMAGE_PHOTOS - photos.length;

  if (photos.length === 0 && !canAdd) return null;

  async function add(files: File[]) {
    if (!token || files.length === 0) return;
    const toSend = files.slice(0, remaining);
    if (toSend.length < files.length) toast.info(`Limite de ${MAX_DAMAGE_PHOTOS} fotos — só ${toSend.length} foram enviadas.`);
    setBusy(true);
    try {
      const { uploaded, failed } = await uploadDamagePhotosInBatches(orderId, toSend, token);
      // Recarrega a lista do servidor (a rota devolve as fotos de avaria, mas por lote).
      const { order } = await api.serviceOrder(orderId, token);
      onUploaded(((order as { media: Media[] }).media ?? []).filter((m) => m.isDamagePhoto));
      if (failed > 0) toast.error(`${failed} foto(s) não foram enviadas — tente de novo.`);
      else if (uploaded > 0) toast.success(`${uploaded} foto(s) de avaria adicionada(s).`);
    } catch {
      toast.error("Não foi possível enviar as fotos de avaria.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel} style={{ marginBottom: "1.6rem" }}>
      <h2>
        Fotos do checklist de entrada ({photos.length}/{MAX_DAMAGE_PHOTOS})
      </h2>
      {photos.length === 0 ? (
        <p className={styles.tlSub}>Nenhuma foto de avaria registrada na entrada do veículo.</p>
      ) : (
        <div className={styles.mediaGrid}>
          {photos.map((media) => (
            <a key={media.id} href={mediaUrl(media.url)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(media.url)} alt={media.label ?? "Foto de avaria"} />
            </a>
          ))}
        </div>
      )}
      {canAdd && remaining > 0 && (
        <div style={{ marginTop: "0.8rem" }}>
          {busy ? (
            <p className={styles.tlSub}>Enviando fotos...</p>
          ) : (
            <CameraOrGalleryPicker multiple onFiles={add} cameraLabel="Tirar foto de avaria" galleryLabel="Adicionar da galeria" />
          )}
        </div>
      )}
    </div>
  );
}
