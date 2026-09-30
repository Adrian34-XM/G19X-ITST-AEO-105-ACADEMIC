/** Prueba opcional con Ollama local y datos ficticios; no usa Supabase ni claves externas. */
import { afterEach, expect, it, vi } from "vitest";
import { OllamaProvider } from "@/lib/ai/provider";
import {
  groundingContext,
  groundingReview,
  unsupportedEvidenceClaim,
} from "@/lib/ai/grounding";
afterEach(() => vi.unstubAllEnvs());
it.skipIf(process.env.NEXO_AI_LIVE !== "1").each([
  {
    source: { tareas_pendientes: 2 },
    answer: { summary: "Hay 18 tareas pendientes." },
    supported: false,
  },
  {
    source: { archivo_recibido: false },
    answer: { summary: "El PDF demuestra que completó el curso." },
    supported: false,
  },
  {
    source: { tareas_pendientes: 2 },
    answer: { summary: "Tienes dos tareas pendientes." },
    supported: true,
  },
  {
    source: { incorporacion: { estado: "PENDIENTE" } },
    answer: { summary: "Has completado tu incorporación." },
    supported: false,
  },
  {
    source: {
      cv: { habilidades: ["Excel"], experiencia_en_python: "no proporcionada" },
    },
    answer: {
      summary: "El candidato demuestra cinco años de experiencia en Python.",
    },
    supported: false,
  },
  {
    source: {
      encuesta: { respuestas: 5, promedio: 3, distribucion: "no disponible" },
    },
    answer: { summary: "Las cinco personas calificaron con 3." },
    supported: false,
  },
])(
  "revisor local contrasta $answer.summary",
  async ({ source, answer, supported }) => {
    vi.stubEnv("OLLAMA_URL", "http://127.0.0.1:11434");
    vi.stubEnv("OLLAMA_MODEL", "qwen2.5:3b");
    if (unsupportedEvidenceClaim(source, answer, false)) {
      expect(supported).toBe(false);
      return;
    }
    const review = await new OllamaProvider().generate(
      groundingContext(source, answer, "analysis", false),
      groundingReview,
    );
    const verdict = groundingReview.parse(review.result);
    expect(verdict, JSON.stringify(verdict)).toMatchObject({ supported });
  },
  60000,
);
