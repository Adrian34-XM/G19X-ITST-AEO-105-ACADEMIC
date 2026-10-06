/** Prueba optativa del proveedor real con áreas y registros completamente ficticios. */
import { afterEach, expect, it, vi } from "vitest";
import { generate } from "@/lib/ai/provider";
import {
  analyticsFacts,
  analyticsNarrativeFacts,
  analyticsNarrativeSchema,
} from "@/modules/workspace/analytics-summary";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.skipIf(process.env.NEXO_AI_LIVE !== "1")(
  "redacta y verifica una comparación por áreas con el modelo local",
  async () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    vi.stubEnv("OLLAMA_MODEL", "qwen2.5:3b");
    const metrics = analyticsFacts(
      {
        departments: [
          { id: "d", name: "Tecnología" },
          { id: "b", name: "Operaciones" },
        ],
        employees: [
          { id: "e", department_id: "d" },
          { id: "f", department_id: "b" },
        ],
        tasks: [
          { id: "t1", employee_id: "e" },
          { id: "t2", employee_id: "e" },
          { id: "t3", employee_id: "f" },
        ],
        course_assignments: [{ id: "c", employee_id: "e" }],
        onboarding: [{ id: "o", employee_id: "f" }],
      },
      ["tasks", "course_assignments", "onboarding"],
      "department",
    );
    const source = {
      verified_metrics: analyticsNarrativeFacts(metrics),
      data_limitations:
        "Estado actual de registros cargados; no hay historial de transiciones ni evaluaciones formales. No se cuentan personas únicas. Porcentajes redondeados sobre el total de cada proceso.",
      user_request:
        "Compara las tareas, capacitaciones e incorporaciones de las áreas visibles. Indica totales y porcentajes por área sin confundir actividades con personas. Explica los datos faltantes y próximos pasos.",
      instructions:
        "Responde en español usando solo verified_metrics. Las cifras exactas aparecen en tarjetas; no escribas cifras ni porcentajes en summary. Cada process es independiente. No inventes estados, causas ni datos. Los próximos pasos son sugerencias. Devuelve summary.",
    };
    const answer = await generate(
      source,
      analyticsNarrativeSchema,
      undefined,
      "analytics",
      true,
    );
    console.log(JSON.stringify({ answer: answer.result }));
    expect((answer.result as { summary: string }).summary).toContain(
      "Tecnología",
    );
  },
  120000,
);
