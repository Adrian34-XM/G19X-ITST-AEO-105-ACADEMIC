/** Renderizado local y acotado: nunca se envía un PDF binario a un modelo de imágenes. */
import { ApiError } from "@/lib/auth";
export const maxVisionPdfPages = 6;
export async function pdfImages(data: Uint8Array): Promise<string[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const loading = getDocument({
    data: new Uint8Array(data),
    useSystemFonts: true,
  });
  try {
    const pdf = await loading.promise;
    if (pdf.numPages > maxVisionPdfPages)
      throw new ApiError(
        422,
        `El análisis visual admite hasta ${maxVisionPdfPages} páginas por PDF. Divide el documento; no se analizarán páginas de forma silenciosa.`,
      );
    const images: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: Math.min(2, 1600 / Math.max(base.width, base.height)),
      });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      try {
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          viewport,
        }).promise;
        images.push(canvas.toBuffer("image/png").toString("base64"));
      } finally {
        page.cleanup();
        canvas.width = 1;
        canvas.height = 1;
      }
    }
    return images;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      422,
      "No se pudo preparar el PDF para visión. Usa un PDF válido sin contraseña.",
    );
  } finally {
    await loading.destroy();
  }
}
