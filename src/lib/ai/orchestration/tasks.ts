/** Instrucciones y contexto del orquestador; recibe datos previamente autorizados.
 * @see docs/CODIGO.md y docs/MAPA_CODIGO.md.
 */
import { automaticSummaryInput, operationalAnalysisInput } from "./shared";
import type { AnalysisInput, OperationalMetrics } from "./types";

export const taskWritingStyle =
  "Redacta el resumen en español natural, con uno o dos párrafos breves. Responde primero a la pregunta concreta; si no hay pregunta, explica qué requiere atención y el siguiente paso. No enumeres todas las tablas ni copies fichas, encabezados, códigos o identificadores. Los datos son respaldo, no una plantilla. Distingue entrega de aprobación y no afirmes haber leído archivos: este contexto solo incluye metadatos. No repitas el resumen en recomendaciones.";
export function tasksInput(
  options: AnalysisInput,
  metrics: OperationalMetrics | null,
) {
  if (metrics !== null) return automaticSummaryInput(options.prompt, metrics);
  return operationalAnalysisInput(options);
}
