/** Instrucciones y contexto del orquestador; recibe datos previamente autorizados.
 * @see docs/CODIGO.md y docs/MAPA_CODIGO.md.
 */
import type { z } from "zod";
import type { GenerationPurpose } from "../grounding";
import { moduleRequest } from "../module-scope";
import { overviewNarrativeSchema } from "../overview-summary";
import {
  analyticsNarrativeSchema,
  analyticsSelection,
} from "@/modules/workspace/analytics-summary";
import { outputSchema } from "./contracts";
import { draftInput, promptSchema } from "./draft";
import { performanceInput, performanceAdvice } from "./performance";
import { overviewInput, personalSummarySchema } from "./overview";
import { analyticsSelectionInput } from "./analytics";
import { tasksInput } from "./tasks";
import { coursesInput } from "./courses";
import type { OrchestrationRequest } from "./types";

export type OrchestrationGeneration = {
  input: Record<string, unknown>;
  schema: z.ZodType;
  purpose: GenerationPurpose;
  repairOnce: boolean;
};

/** Selecciona instrucciones y contrato sin consultar servicios ni ampliar permisos. */
export function buildOrchestrationRequest(options: OrchestrationRequest) {
  const { area, mode, prompt, profile, filters, selected, operationalMetrics } =
    options;
  const plan = (
    input: Record<string, unknown>,
    schema: z.ZodType,
    purpose: GenerationPurpose,
    repairOnce: boolean,
  ): OrchestrationGeneration => ({
    input: {
      ...moduleRequest(area, prompt),
      ...input,
    },
    schema,
    purpose,
    repairOnce,
  });
  if (mode === "prompt")
    return plan(draftInput(options), promptSchema, "draft", false);
  switch (area) {
    case "performance":
      return plan(
        performanceInput(selected, prompt),
        performanceAdvice,
        "analytics",
        true,
      );
    case "analytics":
      return plan(
        analyticsSelectionInput(prompt, filters),
        analyticsSelection,
        "selection",
        false,
      );
    case "overview":
      if (profile.role === "EMPLEADO")
        return plan(
          overviewInput(options),
          personalSummarySchema,
          "analysis",
          true,
        );
      return plan(
        overviewInput(options),
        overviewNarrativeSchema,
        "analysis",
        true,
      );
    case "tasks":
      if (operationalMetrics !== null)
        return plan(
          tasksInput(options, operationalMetrics),
          analyticsNarrativeSchema,
          "analytics",
          true,
        );
      return plan(tasksInput(options, null), outputSchema, "analysis", true);
    case "courses":
      if (operationalMetrics !== null)
        return plan(
          coursesInput(options, operationalMetrics),
          analyticsNarrativeSchema,
          "analytics",
          true,
        );
      return plan(coursesInput(options, null), outputSchema, "analysis", true);
  }
}
