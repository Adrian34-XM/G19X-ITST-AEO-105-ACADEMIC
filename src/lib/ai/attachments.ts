/**
 * @file Obtiene imágenes y PDF mediante el cliente autorizado y los prepara en base64 para el
 * proveedor. Comprueba formato, tamaño y configuración visual; la descarga conserva las políticas
 * de Storage.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Descarga con la sesión del solicitante: conserva RLS y las reglas de Storage. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/auth";
import type { Attachment } from "./provider";
/**
 * Descarga con el cliente de sesión recibido; no sustituirlo por adminDb para evitar RLS.
 * Devuelve el binario codificado, no una URL pública. La conversión de PDF a páginas
 * ocurre después en el proveedor que la necesite.
 */
export async function authorizedAttachment(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<Attachment> {
  const ext = path.split(".").pop()?.toLowerCase();
  const mime: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  if (!ext || !mime[ext])
    throw new ApiError(
      422,
      "El análisis visual admite PDF, PNG y JPG. Para texto utiliza TXT.",
    );
  if (process.env.AI_PROVIDER !== "gemini" && !process.env.OLLAMA_VISION_MODEL)
    throw new ApiError(
      422,
      "Configura OLLAMA_VISION_MODEL para analizar imágenes y PDF escaneados.",
    );
  const { data: file, error } = await client.storage
    .from(bucket)
    .download(path);
  if (error || !file)
    throw new ApiError(502, "No se pudo leer el archivo autorizado.");
  if (!file.size || file.size > 5242880)
    throw new ApiError(422, "El archivo debe pesar entre 1 byte y 5 MB.");
  return {
    mimeType: mime[ext],
    data: Buffer.from(await file.arrayBuffer()).toString("base64"),
  };
}
