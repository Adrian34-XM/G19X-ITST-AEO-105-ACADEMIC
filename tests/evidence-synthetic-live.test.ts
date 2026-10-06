/** Pruebas opcionales contra modelos locales usando exclusivamente documentos ficticios. */
import { afterEach, expect, it, vi } from "vitest";
import { generate, OllamaProvider } from "@/lib/ai/provider";
import {
  verification,
  evidenceOpinion,
  recruitmentOpinion,
} from "@/lib/ai/schemas";
import { recruitmentContext } from "@/lib/ai/recruitment-context";
import {
  groundingContext,
  professionalFactualReview,
} from "@/lib/ai/grounding";
afterEach(() => vi.unstubAllEnvs());
const enabled = process.env.NEXO_SYNTHETIC_LIVE === "1";
const source = {
  task: {
    description:
      "Documenta tu configuración inicial y lo aprendido en la inducción.",
  },
  evidence: "Currículum ficticio: experiencia en desarrollo Java, React y SQL.",
};
it.skipIf(!enabled)(
  "genera un análisis de insuficiencia sin confundirlo con un fallo del analizador",
  async () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    const answer = await generate(
      {
        ...source,
        writing_instructions:
          "Si el archivo no demuestra la tarea, recomienda NEEDS_REVIEW y explica qué falta sin inventar requisitos.",
      },
      verification,
      undefined,
      "professional-evidence",
      true,
    );
    expect(verification.parse(answer.result).status).toBe("NEEDS_REVIEW");
  },
  240000,
);
it.skipIf(!enabled)(
  "evalúa datos declarados del candidato sin confundirlos con verificación del CV",
  async () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    const context = recruitmentContext(
      {
        skills: ["TypeScript"],
        experience_years: 2,
        cv_text:
          "Currículum ficticio: declaro dos años desarrollando aplicaciones con TypeScript.",
      },
      {
        skills: ["TypeScript"],
        experience_required: 1,
        requirements:
          "Conocimiento de TypeScript y un año de experiencia general.",
      },
    );
    const answer = await generate(
      context,
      recruitmentOpinion,
      undefined,
      "professional-evidence",
      true,
    );
    expect(
      recruitmentOpinion.parse(answer.result).score,
    ).toBeGreaterThanOrEqual(0);
  },
  240000,
);
it.skipIf(!enabled)(
  "rechaza una carencia que contradice el CV y los requisitos",
  async () => {
    const context = recruitmentContext(
      {
        skills: ["TypeScript"],
        experience_years: 2,
        cv_text: "Dos años desarrollando aplicaciones con TypeScript.",
      },
      {
        skills: ["TypeScript"],
        experience_required: 1,
        requirements:
          "Conocimiento de TypeScript y un año de experiencia general.",
      },
    );
    const reviewer = new OllamaProvider(
      process.env.OLLAMA_REVIEW_MODEL || "qwen2.5:3b",
    );
    const review = await reviewer.generate(
      groundingContext(
        context,
        {
          summary:
            "La experiencia no está relacionada con la tecnología solicitada.",
        },
        "professional-evidence",
        false,
      ),
      professionalFactualReview,
    );
    expect(
      professionalFactualReview.parse(review.result).contains_fabrication,
    ).toBe(true);
  },
  120000,
);
it.skipIf(!enabled).each([
  {
    reason:
      "El currículum enumera experiencia profesional, pero no documenta la configuración inicial ni lo aprendido en la inducción.",
    status: "NEEDS_REVIEW",
    supported: true,
  },
  {
    reason:
      "La evidencia demuestra que la instalación se realizó correctamente y que terminó la inducción.",
    status: "APPROVED",
    supported: false,
  },
  {
    reason:
      "El documento demuestra diez años de experiencia y cinco cursos completados.",
    status: "NEEDS_REVIEW",
    supported: false,
  },
])(
  "revisa afirmaciones, no el cumplimiento: $status / $supported",
  async ({ reason, status, supported }) => {
    const reviewer = new OllamaProvider(
      process.env.OLLAMA_REVIEW_MODEL || "qwen2.5:3b",
    );
    const review = await reviewer.generate(
      groundingContext(
        source,
        { reason, status, confidence: 0.9, observations: [] },
        "professional-evidence",
        false,
      ),
      professionalFactualReview,
    );
    expect(
      !professionalFactualReview.parse(review.result).contains_fabrication,
    ).toBe(supported);
  },
  120000,
);
it.skipIf(!enabled)(
  "analiza un archivo genérico sin inventar una entrega completada",
  async () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    const context = {
      task: { description: "Validar una entrega sintética" },
      evidence: "Documento sintético de prueba. Sin información personal.",
      writing_instructions:
        "status es una recomendación, confidence debe estar entre 0 y 1. Si el archivo no acredita lo solicitado usa NEEDS_REVIEW. No inventes contenido.",
    };
    const answer = await generate(
      context,
      evidenceOpinion,
      undefined,
      "professional-evidence",
      true,
    );
    expect(verification.parse(answer.result).status).not.toBe("APPROVED");
  },
  240000,
);
