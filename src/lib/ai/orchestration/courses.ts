/** Instrucciones y contexto del orquestador; recibe datos previamente autorizados.
 * @see docs/CODIGO.md y docs/MAPA_CODIGO.md.
 */
import { automaticSummaryInput, operationalAnalysisInput } from "./shared";
import type { AnalysisInput, OperationalMetrics } from "./types";

/** Capacitación utiliza el catálogo autorizado o agregados de asignaciones filtradas. */
export function coursesInput(
  options: AnalysisInput,
  metrics: OperationalMetrics | null,
) {
  if (metrics !== null) return automaticSummaryInput(options.prompt, metrics);
  return operationalAnalysisInput(options);
}
