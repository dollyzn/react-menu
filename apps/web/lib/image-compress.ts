/** Longest side of a menu photo; the menu shows it at most ~450px wide (×2 for sharp screens, + zoom). */
const MAX_SIDE = 1600;
const QUALITY = 0.85;
/** What the browser accepts before shrinking (phone photos are big); the API takes up to 5 MB after. */
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export class ImageCompressError extends Error {}

/**
 * Resizes a photo to at most 1600px and re-encodes it as WebP (JPEG where
 * the browser can't encode WebP). Re-encoding also applies the camera's
 * orientation and drops EXIF metadata (phone photos may carry the GPS
 * location). The API is still the one that validates the file.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new ImageCompressError("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
  if (file.size > MAX_INPUT_BYTES) throw new ImageCompressError("Imagem muito grande: até 20 MB.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageCompressError("Não foi possível ler esta imagem. Tente uma foto em JPG ou PNG.");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ImageCompressError("Seu navegador não conseguiu processar a imagem.");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));
  // Browsers that can't encode WebP silently return PNG: fall back to JPEG then.
  const webp = await encode("image/webp");
  const blob = webp?.type === "image/webp" ? webp : await encode("image/jpeg");
  if (!blob) throw new ImageCompressError("Seu navegador não conseguiu processar a imagem.");
  return blob;
}
