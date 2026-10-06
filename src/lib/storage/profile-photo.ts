import "server-only";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { ApiError } from "@/lib/auth";
import { inspectFile } from "./files";

export const maxPhotoSize = 2 * 1024 * 1024;
/** Lee dimensiones antes de descomprimir para limitar imágenes que consuman demasiada memoria. */
function dimensions(bytes: Uint8Array, png: boolean) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (png && bytes.length >= 24)
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (!png) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset++] !== 255) break;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 8
      )
        return {
          height: view.getUint16(offset + 3),
          width: view.getUint16(offset + 5),
        };
      offset += length;
    }
  }
  throw new ApiError(
    422,
    "La imagen está dañada o no tiene un formato válido.",
  );
}
/** Reencodifica a PNG de 512px: elimina metadatos y conserva únicamente los píxeles de la foto. */
export async function normalizeProfilePhoto(file: File) {
  if (!file.size || file.size > maxPhotoSize)
    throw new ApiError(422, "La foto debe pesar como máximo 2 MB.");
  if (!["image/png", "image/jpeg"].includes(file.type))
    throw new ApiError(422, "Selecciona una foto PNG o JPG.");
  const { bytes, ext } = await inspectFile(file, "profile-photos");
  const size = dimensions(bytes, ext === "png");
  if (
    !size.width ||
    !size.height ||
    size.width > 6000 ||
    size.height > 6000 ||
    size.width * size.height > 16000000
  )
    throw new ApiError(
      422,
      "La foto es demasiado grande en dimensiones. Usa una imagen de hasta 16 megapíxeles y 6000 píxeles por lado.",
    );
  try {
    const image = await loadImage(Buffer.from(bytes));
    const canvas = createCanvas(512, 512),
      ctx = canvas.getContext("2d");
    const side = Math.min(image.width, image.height);
    ctx.drawImage(
      image,
      (image.width - side) / 2,
      (image.height - side) / 2,
      side,
      side,
      0,
      0,
      512,
      512,
    );
    return new Uint8Array(await canvas.encode("png"));
  } catch {
    throw new ApiError(
      422,
      "No se pudo leer la foto. Prueba con otro archivo PNG o JPG.",
    );
  }
}
