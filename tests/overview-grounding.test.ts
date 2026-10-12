import { afterEach, expect, it, vi } from "vitest";
import { generate } from "@/lib/ai/provider";
import {
  overviewNarrativeSchema,
  overviewFactualSystemPrompt,
  overviewNarrativeSystemPrompt,
} from "@/lib/ai/overview-summary";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const source = {
  verified_facts: [
    "Esta semana se recibieron 1 postulaciones; pueden incluir reactivadas y no equivalen a personas únicas.",
  ],
  instructions: "Redacta sin inventar datos.",
  user_request: "Novedades de mi espacio",
};
function response(result: unknown) {
  return new Response(
    JSON.stringify({ message: { content: JSON.stringify(result) } }),
    { status: 200 },
  );
}
it("revisa solo los hechos semanales y acepta una postulación recibida sin exigir su reactivación", async () => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      response({
        summary:
          "Esta semana recibiste una postulación. Sugiero revisarla. Hay contrataciones pendientes.",
      }),
    )
    .mockImplementation(() =>
      Promise.resolve(
        response({
          explanation: "La cantidad coincide y revisar es una propuesta.",
          contains_fabrication: false,
        }),
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const answer = await generate(source, overviewNarrativeSchema);
  expect(answer.result).toEqual({
    summary: "Esta semana recibiste una postulación. Sugiero revisarla.",
  });
  const write = JSON.parse(fetcher.mock.calls[0][1].body);
  const review = JSON.parse(fetcher.mock.calls[1][1].body);
  expect(write.messages[0].content).toBe(overviewNarrativeSystemPrompt);
  expect(JSON.parse(write.messages[1].content).verified_facts).toEqual(
    source.verified_facts,
  );
  expect(JSON.parse(write.messages[1].content)).not.toHaveProperty(
    "instructions",
  );
  expect(review.messages[0].content).toBe(overviewFactualSystemPrompt);
  const input = JSON.parse(review.messages[1].content);
  expect(input.verified_facts).toEqual(source.verified_facts);
  expect(input).not.toHaveProperty("instructions");
  expect(input).not.toHaveProperty("user_request");
  expect(input.proposed_answer.summary).toBe(
    "Esta semana recibiste una postulación.",
  );
  expect(
    JSON.parse(JSON.parse(fetcher.mock.calls[2][1].body).messages[1].content)
      .proposed_answer.summary,
  ).toBe("Sugiero revisarla.");
});
it("sigue rechazando cifras inventadas aunque un resumen esté bien formado", async () => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        response({ summary: "Esta semana hubo veinte contrataciones." }),
      )
      .mockResolvedValueOnce(
        response({
          explanation:
            "La fuente dice una postulación, no veinte contrataciones.",
          contains_fabrication: true,
        }),
      ),
  );
  await expect(generate(source, overviewNarrativeSchema)).rejects.toThrow(
    "no pudo respaldarse",
  );
});
it("vuelve a contrastar la redacción corregida y no publica una reparación que sigue inventando", async () => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(response({ summary: "Hubo veinte contrataciones." }))
    .mockResolvedValueOnce(
      response({
        explanation: "No hay contrataciones en las fuentes.",
        contains_fabrication: true,
      }),
    )
    .mockResolvedValueOnce(response({ summary: "Hubo diez contrataciones." }))
    .mockResolvedValueOnce(
      response({
        explanation: "Tampoco hay diez contrataciones.",
        contains_fabrication: true,
      }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    generate(source, overviewNarrativeSchema, undefined, "analysis", true),
  ).rejects.toThrow("no pudo respaldarse");
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(
    JSON.parse(JSON.parse(fetcher.mock.calls[3][1].body).messages[1].content)
      .verified_facts,
  ).toEqual(source.verified_facts);
});
