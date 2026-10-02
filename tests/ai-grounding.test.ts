import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { generate } from "@/lib/ai/provider";
import {
  groundingContext,
  groundingSystemPrompt,
  unsupportedEvidenceClaim,
} from "@/lib/ai/grounding";
const schema = z.object({ summary: z.string() });
it("compara números escritos en letras sin modificar la respuesta original ni nombres", () => {
  const answer = {
    summary:
      "Tienes dos tareas pendientes en Dos Santos. Sugiero revisar un curso.",
  };
  const context = groundingContext(
    { tareas_pendientes: 2 },
    answer,
    "analysis",
    false,
  );
  expect(context.proposed_answer).toEqual({
    summary:
      "Tienes 2 tareas pendientes en Dos Santos. Sugiero revisar 1 curso.",
  });
  expect(answer.summary).toBe(
    "Tienes dos tareas pendientes en Dos Santos. Sugiero revisar un curso.",
  );
  expect(context.sources).toEqual({ tareas_pendientes: 2 });
});
const response = (content: unknown) =>
  Response.json({ message: { content: JSON.stringify(content) } });
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("bloquea contenido afirmado sobre un archivo no leído sin depender del revisor", async () => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      response({ summary: "El PDF demuestra que completó el curso." }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    generate({ evidence: { contentAnalyzed: false } }, schema),
  ).rejects.toThrow("no fue leído");
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(
    unsupportedEvidenceClaim(
      { contentAnalyzed: false },
      { summary: "No puedo confirmar lo que contiene el PDF." },
      false,
    ),
  ).toBe(false);
  expect(
    unsupportedEvidenceClaim(
      { contentAnalyzed: false },
      { summary: "El PDF contiene una tabla." },
      true,
    ),
  ).toBe(false);
});
it.each([
  ["cifras inventadas", "Hay 18 pendientes", "Solo hay 2 pendientes"],
  [
    "estado incorrecto",
    "La tarea está completada",
    "La tarea sigue en progreso",
  ],
  [
    "archivo no leído",
    "El PDF demuestra cumplimiento",
    "No se recibió el contenido del PDF",
  ],
  [
    "causas inventadas",
    "El atraso se debe a falta de motivación",
    "No hay evidencia de motivos personales",
  ],
  [
    "políticas inexistentes",
    "La empresa ofrece 30 días de vacaciones",
    "No hay una política de vacaciones proporcionada",
  ],
])(
  "rechaza %s antes de entregar la respuesta",
  async (_label, summary, issue) => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ summary }))
      .mockResolvedValueOnce(response({ supported: false, issues: [issue] }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      generate({ pending: 2, status: "IN_PROGRESS" }, schema),
    ).rejects.toThrow("no pudo respaldarse");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const review = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(review.messages.at(-1).content).toContain("proposed_answer");
    expect(review.messages.at(-1).content).toContain("sources");
    expect(review.messages[0].content).toBe(groundingSystemPrompt);
  },
);
it("falla de forma cerrada si el revisor se contradice o no responde", async () => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  for (const verdict of [
    { supported: true, issues: ["Dato sin respaldo"] },
    { invalid: true },
  ]) {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(response({ summary: "Texto" }))
        .mockResolvedValueOnce(response(verdict)),
    );
    await expect(generate({}, schema)).rejects.toThrow();
  }
});

it("separa requisitos y recomendación de hechos sin ocultar una propuesta de aprobación", () => {
  const source = {
    task: { description: "Documentar instalación" },
    evidence: "CV ficticio",
    evidence_text_truncated: true,
  };
  for (const status of ["NEEDS_REVIEW", "APPROVED"]) {
    const result = {
      status,
      confidence: 0.8,
      reason: "Comentario del modelo",
      observations: [],
    };
    const review = groundingContext(source, result, "analysis", false);
    expect(review.sources).toEqual({
      requirements_to_verify_not_completed_facts: source.task,
      submitted_document: source.evidence,
      text_truncated: true,
      attachment_available: false,
    });
    expect(review.proposed_answer).toMatchObject({
      reason: result.reason,
      observations: [],
    });
    expect(review.proposed_answer).not.toHaveProperty("confidence");
    expect(review.proposed_answer).not.toHaveProperty("status");
    expect(JSON.stringify(review.proposed_answer)).toContain(
      status === "APPROVED"
        ? "acredita lo solicitado"
        : "No se propone aprobar",
    );
    expect(result.status).toBe(status);
  }
});
it("conserva la redacción del modelo solo tras pasar revisión y comparte el adjunto autorizado", async () => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  vi.stubEnv("OLLAMA_VISION_MODEL", "test-vision");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      response({ summary: "Se observa una tabla; no acredita finalización." }),
    )
    .mockResolvedValueOnce(response({ supported: true, issues: [] }));
  vi.stubGlobal("fetch", fetcher);
  const result = await generate({ description: "Ejercicio" }, schema, {
    mimeType: "image/png",
    data: "fixture",
  });
  expect(result.result).toEqual({
    summary: "Se observa una tabla; no acredita finalización.",
  });
  expect(
    JSON.parse(fetcher.mock.calls[1][1].body).messages.at(-1).images,
  ).toEqual(["fixture"]);
});
it("el borrador se revisa como propuesta, la selección determinista no solicita revisión narrativa", async () => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({ summary: "Propuesta de actividad" }))
    .mockResolvedValueOnce(response({ supported: true, issues: [] }));
  vi.stubGlobal("fetch", fetcher);
  await generate({ topic: "Bienvenida" }, schema, undefined, "draft");
  expect(
    JSON.parse(fetcher.mock.calls[1][1].body).messages.at(-1).content,
  ).toContain("BORRADOR");
  fetcher.mockClear().mockResolvedValue(response({ summary: "tasks" }));
  await generate({}, schema, undefined, "selection");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([true, false])(
  "la reparación única del resumen vuelve a validarse: %s",
  async (supported) => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ summary: "Hay 18 pendientes" }))
      .mockResolvedValueOnce(
        response({ supported: false, issues: ["Solo hay dos pendientes"] }),
      )
      .mockResolvedValueOnce(response({ summary: "Hay dos pendientes" }))
      .mockResolvedValueOnce(
        response({ supported, issues: supported ? [] : ["No respaldado"] }),
      );
    vi.stubGlobal("fetch", fetcher);
    const result = generate(
      { pending: 2 },
      schema,
      undefined,
      "analysis",
      true,
    );
    if (supported)
      expect((await result).result).toEqual({ summary: "Hay dos pendientes" });
    else await expect(result).rejects.toThrow("no pudo respaldarse");
    expect(fetcher).toHaveBeenCalledTimes(4);
    const review = JSON.parse(fetcher.mock.calls[3][1].body);
    const reviewContext = JSON.parse(review.messages.at(-1).content);
    expect(reviewContext.sources).toEqual({ pending: 2 });
  },
);
