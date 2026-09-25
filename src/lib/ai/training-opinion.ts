import { z } from "zod";
export const trainingOpinion = z
  .object({
    summary: z.string().min(1).max(2000),
    demonstrated: z.array(z.string().max(500)).max(6),
    missing: z.array(z.string().max(500)).max(6),
    recommendation: z.enum(["SUFFICIENT", "MORE_EVIDENCE", "HUMAN_REVIEW"]),
  })
  .strict();

/** Una respuesta que enumera faltantes nunca se presenta como evidencia suficiente. */
export function reviewTrainingOpinion(result: unknown) {
  const parsed = trainingOpinion.parse(result);
  if (parsed.missing.length && parsed.recommendation === "SUFFICIENT")
    parsed.recommendation = "MORE_EVIDENCE";
  return parsed;
}
