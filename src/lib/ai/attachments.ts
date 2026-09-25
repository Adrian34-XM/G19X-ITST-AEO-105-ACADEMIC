/** Descarga con la sesión del solicitante: conserva RLS y las reglas de Storage. */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/auth";
import type { Attachment } from "./provider";
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
