/** Pruebas optativas con el modelo local y hechos ficticios, sin base de datos. */
import { afterEach, expect, it, vi } from "vitest";
import { generate, OllamaProvider } from "@/lib/ai/provider";
import {
  chartNarrativeSchema,
  chartFactualReview,
} from "@/lib/ai/chart-narrative";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const cases = [
  {
    name: "procesos distintos",
    facts: [
      "Ámbito filtrado (tareas): sí hay registros: 6 tareas. Distribución: En progreso: 4; Pendiente: 2.",
      "Ámbito filtrado (tareas): El único estado con mayor conteo es: En progreso.",
      "Ámbito filtrado (capacitaciones): sí hay registros: 3 capacitaciones. Distribución: Completado: 3.",
    ],
    metrics: [
      { process: "tareas", area: null },
      { process: "capacitaciones", area: null },
    ],
  },
  {
    name: "una sola vista sin registros",
    facts: [
      "Ámbito filtrado (tareas): no hay tareas con los filtros y el periodo de esta gráfica. Esto no significa ausencia de trabajo fuera del conjunto cargado.",
    ],
    metrics: [{ process: "tareas", area: null }],
  },
  {
    name: "dos áreas con estados distintos",
    facts: [
      "Tecnología (tareas): sí hay registros: 6 tareas. Distribución: En progreso: 4; Pendiente: 2.",
      "Ventas (tareas): sí hay registros: 2 tareas. Distribución: Aprobado: 2.",
    ],
    metrics: [
      { process: "tareas", area: "Tecnología" },
      { process: "tareas", area: "Ventas" },
    ],
  },
];

it.skipIf(process.env.NEXO_AI_LIVE !== "1").each(cases)(
  "interpreta y revisa $name con cifras ficticias",
  async ({ facts, metrics }) => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    const answer = await generate(
      {
        evidence: facts.join("\n"),
        narrative_input: { verified_facts: facts },
        verified_metrics: metrics,
      },
      chartNarrativeSchema,
      undefined,
      "professional-evidence",
      true,
    );
    expect(chartNarrativeSchema.parse(answer.result).summary).not.toBe("");
  },
  240000,
);

it.skipIf(process.env.NEXO_AI_LIVE !== "1")(
  "el revisor real sigue rechazando estados inventados",
  async () => {
    vi.stubEnv("AI_PROVIDER", "ollama");
    const answer = await new OllamaProvider().generate(
      {
        source_text:
          "Hay 6 tareas: En progreso: 4; Pendiente: 2. No hay tareas completadas.",
        answer_text: "Las seis tareas están completadas.",
      },
      chartFactualReview,
    );
    expect(chartFactualReview.parse(answer.result).contains_fabrication).toBe(
      true,
    );
  },
  120000,
);
