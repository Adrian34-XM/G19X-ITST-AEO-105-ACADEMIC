/** Prueba optativa con el servicio local real; no se ejecuta en la suite habitual. */
import { it, expect } from "vitest";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import {
  trainingOpinion as schema,
  reviewTrainingOpinion,
} from "@/lib/ai/training-opinion";
import { OllamaProvider } from "@/lib/ai/provider";
import { inspectFile } from "@/lib/storage/files";
const context = {
  task: "Verificar una evidencia de práctica. Entregable requerido: objetivo de prueba, pasos, resultado esperado y obtenido. Una captura de porcentaje registrado no demuestra cumplimiento. No apruebes automáticamente ni inventes texto no legible. Responde en español.",
  course: "Documentación de pruebas funcionales",
};
for (const kind of ["image", "scanned_pdf", "text_pdf"] as const) {
  it.skipIf(process.env.RUN_LOCAL_VISION !== "true")(
    `proveedor real local: ${kind}`,
    async () => {
      const path =
        kind === "image"
          ? process.env.VISION_TEST_IMAGE ||
            "tests/fixtures/vision/evidencia.png"
          : kind === "scanned_pdf"
            ? "tests/fixtures/vision/escaneado.pdf"
            : "tests/fixtures/vision/texto.pdf";
      const bytes = await readFile(path);
      const started = Date.now();
      const result =
        kind === "text_pdf"
          ? await new OllamaProvider().generate(
              {
                ...context,
                evidence: (
                  await inspectFile(
                    new File([bytes], "texto.pdf", { type: "application/pdf" }),
                    "task-evidence",
                  )
                ).text,
              },
              schema,
            )
          : await new OllamaProvider().generate(context, schema, {
              mimeType: kind === "image" ? "image/png" : "application/pdf",
              data: bytes.toString("base64"),
            });
      expect(schema.safeParse(result.result).success).toBe(true);
      result.result = reviewTrainingOpinion(result.result);
      if (kind === "image" && process.env.VISION_TEST_IMAGE)
        expect(
          (result.result as { recommendation: string }).recommendation,
        ).not.toBe("SUFFICIENT");
      await mkdir(".local", { recursive: true });
      await writeFile(
        `.local/vision-${kind}.json`,
        JSON.stringify(
          { ...result, elapsed_seconds: (Date.now() - started) / 1000 },
          null,
          2,
        ),
      );
      console.log(kind, JSON.stringify(result));
    },
    240000,
  );
}
