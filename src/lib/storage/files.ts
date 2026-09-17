/**
 * Inspecciona tamaño, extensión, MIME y cabeceras antes de subir. Extrae texto UTF-8 o de PDF con límites de páginas y caracteres. Las cabeceras de imágenes no equivalen a un análisis antivirus.
 */
import { ApiError } from "@/lib/auth";
export const maxFileSize = 5 * 1024 * 1024;
/** Devuelve bytes para Storage y texto acotado para IA; lanza ApiError si no es válido. */
export async function inspectFile(file: File, bucket: string) {
  if (!file.size || file.size > maxFileSize)
    throw new ApiError(422, "El archivo debe pesar entre 1 byte y 5 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase();
  const allowed: Record<string, string> = {
    pdf: "application/pdf",
    txt: "text/plain",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  if (
    !ext ||
    allowed[ext] !== file.type ||
    (bucket === "cvs" && !["pdf", "txt"].includes(ext))
  )
    throw new ApiError(
      422,
      "Formato no permitido. Usa PDF o TXT; para evidencias también PNG o JPG.",
    );
  if (ext === "pdf" && new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new ApiError(422, "PDF inválido.");
  if (
    ext === "png" &&
    ![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
  )
    throw new ApiError(422, "PNG inválido.");
  if (
    ["jpg", "jpeg"].includes(ext) &&
    (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255)
  )
    throw new ApiError(422, "JPEG inválido.");
  let text = "";
  if (ext === "txt") {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new ApiError(422, "El texto debe estar codificado en UTF-8.");
    }
    if (text.includes("\0"))
      throw new ApiError(422, "Archivo de texto inválido.");
  }
  if (ext === "pdf") {
    try {
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const loading = getDocument({
        data: bytes.slice(),
        useSystemFonts: true,
      });
      const pdf = await loading.promise;
      try {
        for (
          let n = 1;
          n <= Math.min(pdf.numPages, 20) && text.length < 14000;
          n++
        ) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          text +=
            content.items.map((i) => ("str" in i ? i.str : "")).join(" ") +
            "\n";
        }
      } finally {
        await loading.destroy();
      }
    } catch {
      throw new ApiError(
        422,
        "No se pudo leer el PDF. Usa un PDF sin contraseña o un archivo TXT.",
      );
    }
  }
  return { bytes, ext, text: text.slice(0, 14000) };
}
