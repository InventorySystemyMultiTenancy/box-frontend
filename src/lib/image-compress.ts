const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;
// Já pequena o suficiente — recomprimir só adicionaria espera sem ganho real.
const SKIP_BELOW_BYTES = 600_000;

/**
 * Fotos tiradas direto da câmera do celular costumam vir com vários MB. Numa
 * conexão ruim de pátio/oficina isso é o principal motivo de demora (ou até
 * timeout) ao salvar pilotagem/abastecimento. Reduz a imagem antes do envio;
 * se qualquer coisa der errado, devolve o arquivo original — nunca deve travar
 * quem está tentando salvar.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return file;
  if (file.size <= SKIP_BELOW_BYTES) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
