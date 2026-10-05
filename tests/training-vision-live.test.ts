import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { generate, OllamaProvider } from "@/lib/ai/provider";
import { trainingOpinion } from "@/lib/ai/training-opinion";
it.skipIf(process.env.RUN_TRAINING_VISION !== "1")(
  "imagen ficticia: generación y revisión factual completas",
  async () => {
    const bytes = await readFile("tests/fixtures/vision/evidencia.png");
    const readingSchema = z
      .object({
        visible_content: z.string().max(6000),
        limitations: z.array(z.string()).max(5),
      })
      .strict();
    const reading = await new OllamaProvider().generate(
      {
        task: "Lee solo el contenido visible de la imagen sin inferir aprendizaje. Responde en español.",
      },
      readingSchema,
      { mimeType: "image/png", data: bytes.toString("base64") },
    );
    const result = await generate(
      {
        task: "Contrasta las observaciones con los requisitos del curso. No certifiques aprendizaje por un porcentaje. Responde brevemente en español.",
        requirements_to_verify_not_completed_facts: {
          title: "Documentación de pruebas",
          content:
            "Entregar objetivo, pasos, resultado esperado y obtenido de una prueba.",
        },
        reported_progress: 100,
        evidence: reading.result,
      },
      trainingOpinion,
      undefined,
      "training-evidence",
      true,
      reading.model,
    );
    expect(trainingOpinion.safeParse(result.result).success).toBe(true);
  },
  600000,
);
