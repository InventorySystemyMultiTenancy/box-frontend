import { api } from "@/lib/api";
import { compressImage } from "@/lib/image-compress";

/** Limite de fotos de avaria (checklist de entrada) por projeto — o backend aceita até 20 por envio. */
export const MAX_DAMAGE_PHOTOS = 20;

const BATCH_SIZE = 5;

/**
 * Envia as fotos de avaria comprimidas e em lotes de 5. Mandar as 20 fotos originais do
 * celular (5–15 MB cada) numa requisição só estourava o tempo limite em conexão ruim, e o
 * projeto ficava sem nenhuma foto. Um lote que falha não derruba os outros.
 */
export async function uploadDamagePhotosInBatches(orderId: string, files: File[], token: string) {
  const compressed = await Promise.all(files.map((file) => compressImage(file)));
  let uploaded = 0;
  let failed = 0;
  for (let i = 0; i < compressed.length; i += BATCH_SIZE) {
    const batch = compressed.slice(i, i + BATCH_SIZE);
    try {
      await api.uploadDamagePhotos(orderId, batch, token);
      uploaded += batch.length;
    } catch {
      failed += batch.length;
    }
  }
  return { uploaded, failed };
}
