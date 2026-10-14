const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.75;
// Já pequena o suficiente — recomprimir só adicionaria espera sem ganho real.
const SKIP_BELOW_BYTES = 600_000;

interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  skipBelowBytes?: number;
}

async function reencodeAsJpeg(file: File, maxDimension: number, quality: number): Promise<File | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return null;
  const newName = (file.name || "foto").replace(/\.\w+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * Fotos tiradas direto da câmera do celular costumam vir com vários MB. Numa
 * conexão ruim de pátio/oficina isso é o principal motivo de demora (ou até
 * timeout) ao salvar pilotagem/abastecimento. Reduz a imagem antes do envio;
 * se qualquer coisa der errado, devolve o arquivo original — nunca deve travar
 * quem está tentando salvar.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY, skipBelowBytes = SKIP_BELOW_BYTES } = options;
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return file;
  if (file.size <= skipBelowBytes) return file;

  try {
    const jpeg = await reencodeAsJpeg(file, maxDimension, quality);
    return jpeg && jpeg.size < file.size ? jpeg : file;
  } catch {
    return file;
  }
}

// Formatos que a IA de visão aceita — HEIC/HEIF (iPhone e vários Android) e arquivo sem
// tipo (algumas galerias de Android) são recusados por ela e pelo upload do servidor.
const AI_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class UnsupportedImageError extends Error {}

/**
 * Prepara a foto para leitura por IA (nota fiscal, veículo): sempre JPEG, em tamanho
 * suficiente para ler texto pequeno (2400px) e sem os 10–20 MB das câmeras de celular.
 * Se o aparelho não conseguir abrir uma foto num formato que a IA não aceita (ex.: HEIC
 * no Chrome do Android), lança UnsupportedImageError com o que fazer.
 */
export async function prepareImageForAi(file: File): Promise<File> {
  const supported = AI_IMAGE_TYPES.has(file.type.toLowerCase());
  if (supported && file.size <= 1_500_000) return file;

  try {
    const jpeg = await reencodeAsJpeg(file, 2400, 0.85);
    if (jpeg) return jpeg;
  } catch {
    // Cai no tratamento abaixo.
  }
  if (supported) return file;
  throw new UnsupportedImageError(
    'Não foi possível abrir esta foto (formato HEIC ou desconhecido). Use o botão "Tirar foto" ou ajuste a câmera do celular para salvar em JPEG.'
  );
}
