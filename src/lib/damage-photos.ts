import { api } from "@/lib/api";
import { compressImage } from "@/lib/image-compress";

/** Limites do checklist de entrada por projeto (o backend confere os mesmos). */
export const MAX_DAMAGE_PHOTOS = 20;
export const MAX_DAMAGE_VIDEOS = 5;
/** Tamanho máximo de cada vídeo (mesmo limite do backend). */
export const MAX_DAMAGE_VIDEO_BYTES = 100 * 1024 * 1024;

const PHOTO_BATCH_SIZE = 5;

const isVideo = (file: File) => file.type.startsWith("video/");

/**
 * Envia fotos e vídeos de avaria. Fotos comprimidas e em lotes de 5 (as 20 originais numa
 * requisição só estouravam o tempo limite); vídeos um por requisição, sem compressão. Um
 * envio que falha não derruba os outros.
 */
export async function uploadDamageMediaInBatches(orderId: string, files: File[], token: string) {
  const photos = await Promise.all(files.filter((f) => !isVideo(f)).map((file) => compressImage(file)));
  const videos = files.filter(isVideo);
  const batches = [
    ...Array.from({ length: Math.ceil(photos.length / PHOTO_BATCH_SIZE) }, (_, i) => photos.slice(i * PHOTO_BATCH_SIZE, (i + 1) * PHOTO_BATCH_SIZE)),
    ...videos.map((video) => [video]),
  ];
  let uploaded = 0;
  let failed = 0;
  for (const batch of batches) {
    try {
      await api.uploadDamagePhotos(orderId, batch, token);
      uploaded += batch.length;
    } catch {
      failed += batch.length;
    }
  }
  return { uploaded, failed };
}

/** Separa os vídeos grandes demais (acima do limite) antes de aceitar. */
export function splitOversizedVideos(files: File[]) {
  const ok = files.filter((f) => f.size <= MAX_DAMAGE_VIDEO_BYTES);
  return { ok, tooBig: files.length - ok.length };
}

/**
 * Abre o "Compartilhar" do celular com os arquivos — no iPhone/Android tem "Salvar imagem/
 * vídeo", que grava direto na galeria (o download comum vai para Arquivos/Downloads).
 * Precisa ser chamado num clique. Devolve false se o aparelho não suporta.
 */
export async function shareFilesToGallery(files: File[]) {
  if (typeof navigator === "undefined" || !navigator.canShare || !navigator.canShare({ files })) return false;
  try {
    await navigator.share({ files });
  } catch {
    // Usuário fechou o compartilhamento — nada a fazer.
  }
  return true;
}
