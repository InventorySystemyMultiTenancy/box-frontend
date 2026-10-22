"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { api, API_URL } from "@/lib/api";
import { MAX_DAMAGE_PHOTOS, MAX_DAMAGE_VIDEOS, splitOversizedVideos, uploadDamageMediaInBatches } from "@/lib/damage-photos";
import type { Media } from "@/lib/types";
import { CameraOrGalleryPicker } from "@/components/ui/camera-or-gallery-picker";
import styles from "./dashboard.module.css";

function mediaUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
}

/**
 * Fotos e vídeos do checklist de entrada (avarias que o carro já tinha ao chegar), visíveis
 * em qualquer etapa do projeto. Staff pode adicionar mais (ou reenviar os que falharam na
 * criação do projeto), até 20 fotos e 5 vídeos.
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
  const images = photos.filter((m) => m.type !== "VIDEO");
  const videos = photos.filter((m) => m.type === "VIDEO");
  const remainingPhotos = MAX_DAMAGE_PHOTOS - images.length;
  const remainingVideos = MAX_DAMAGE_VIDEOS - videos.length;

  if (photos.length === 0 && !canAdd) return null;

  async function add(files: File[], kind: "photo" | "video") {
    if (!token || files.length === 0) return;
    let accepted = files;
    if (kind === "video") {
      const { ok, tooBig } = splitOversizedVideos(files);
      if (tooBig > 0) toast.error(`${tooBig} vídeo(s) acima de 100 MB foram ignorados — grave um vídeo mais curto.`);
      accepted = ok;
    }
    const limit = kind === "video" ? remainingVideos : remainingPhotos;
    const toSend = accepted.slice(0, limit);
    if (toSend.length < accepted.length) {
      toast.info(`Limite de ${kind === "video" ? `${MAX_DAMAGE_VIDEOS} vídeos` : `${MAX_DAMAGE_PHOTOS} fotos`} — só ${toSend.length} foram enviados.`);
    }
    if (toSend.length === 0) return;
    setBusy(true);
    try {
      const { uploaded, failed } = await uploadDamageMediaInBatches(orderId, toSend, token);
      // Recarrega a lista do servidor (a rota devolve as fotos de avaria, mas por lote).
      const { order } = await api.serviceOrder(orderId, token);
      onUploaded(((order as { media: Media[] }).media ?? []).filter((m) => m.isDamagePhoto));
      if (failed > 0) toast.error(`${failed} arquivo(s) não foram enviados — tente de novo.`);
      else if (uploaded > 0) toast.success(`${uploaded} arquivo(s) de avaria adicionado(s).`);
    } catch {
      toast.error("Não foi possível enviar os arquivos de avaria.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel} style={{ marginBottom: "1.6rem" }}>
      <h2>
        Checklist de entrada — {images.length}/{MAX_DAMAGE_PHOTOS} fotos · {videos.length}/{MAX_DAMAGE_VIDEOS} vídeos
      </h2>
      {photos.length === 0 ? (
        <p className={styles.tlSub}>Nenhuma foto ou vídeo de avaria registrado na entrada do veículo.</p>
      ) : (
        <div className={styles.mediaGrid}>
          {images.map((media) => (
            <a key={media.id} href={mediaUrl(media.url)} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mediaUrl(media.url)} alt={media.label ?? "Foto de avaria"} />
            </a>
          ))}
          {videos.map((media) => (
            <video key={media.id} src={mediaUrl(media.url)} controls preload="metadata" playsInline aria-label={media.label ?? "Vídeo de avaria"} />
          ))}
        </div>
      )}
      {canAdd && (remainingPhotos > 0 || remainingVideos > 0) && (
        <div className="grid gap-2" style={{ marginTop: "0.8rem" }}>
          {busy ? (
            <p className={styles.tlSub}>Enviando...</p>
          ) : (
            <>
              {remainingPhotos > 0 && (
                <CameraOrGalleryPicker multiple onFiles={(files) => add(files, "photo")} cameraLabel="Tirar foto de avaria" galleryLabel="Foto da galeria" />
              )}
              {remainingVideos > 0 && (
                <CameraOrGalleryPicker kind="video" multiple onFiles={(files) => add(files, "video")} cameraLabel="Gravar vídeo de avaria" galleryLabel="Vídeo da galeria" />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
