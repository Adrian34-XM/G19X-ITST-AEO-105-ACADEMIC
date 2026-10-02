import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { generate } from "@/lib/ai/provider";
import { unsupportedEvidenceClaim } from "@/lib/ai/grounding";
const schema = z.object({ summary: z.string() });
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
    expect(review.messages[1].content).toContain("proposed_answer");
    expect(review.messages[1].content).toContain("sources");
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
  expect(JSON.parse(fetcher.mock.calls[1][1].body).messages[1].images).toEqual([
    "fixture",
  ]);
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
    JSON.parse(fetcher.mock.calls[1][1].body).messages[1].content,
  ).toContain("BORRADOR");
  fetcher.mockClear().mockResolvedValue(response({ summary: "tasks" }));
  await generate({}, schema, undefined, "selection");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([true, false])("la reparación única del resumen vuelve a validarse: %s", async (supported) => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  const fetcher = vi.fn()
    .mockResolvedValueOnce(response({summary:"Hay 18 pendientes"}))
    .mockResolvedValueOnce(response({supported:false,issues:["Solo hay dos pendientes"]}))
    .mockResolvedValueOnce(response({summary:"Hay dos pendientes"}))
    .mockResolvedValueOnce(response({supported,issues:supported ? [] : ["No respaldado"]}));
  vi.stubGlobal("fetch",fetcher);
  const result = generate({pending:2},schema,undefined,"analysis",true);
  if(supported) expect((await result).result).toEqual({summary:"Hay dos pendientes"});
  else await expect(result).rejects.toThrow("no pudo respaldarse");
  expect(fetcher).toHaveBeenCalledTimes(4);
  const review = JSON.parse(fetcher.mock.calls[3][1].body);
  const reviewContext = JSON.parse(review.messages[1].content);
  expect(reviewContext.sources).toEqual({pending:2});
});
