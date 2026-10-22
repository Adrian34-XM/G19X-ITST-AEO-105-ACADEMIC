/** Instrucciones y contexto del orquestador; recibe datos previamente autorizados.
 * @see docs/CODIGO.md y docs/MAPA_CODIGO.md.
 */
import { automaticSummaryInput, operationalAnalysisInput } from "./shared";
import type { AnalysisInput, OperationalMetrics } from "./types";

export const onboardingWritingStyle =
  "Redacta en español natural, con uno o dos párrafos breves. Responde primero y de forma directa a la pregunta concreta sobre incorporación: planes, actividades, responsables (EMPLOYEE, MANAGER o HR), plazos, atrasos, documentos solicitados y avances; si no hay pregunta, explica qué requiere atención y el siguiente paso. No enumeres todas las tablas ni copies fichas, encabezados, códigos o identificadores. Una actividad entregada o con documento no equivale a una actividad completada: la completa quien revisa. No afirmes haber leído documentos: este contexto solo incluye metadatos. No repitas el resumen en recomendaciones.";
export function onboardingInput(
  options: AnalysisInput,
  metrics: OperationalMetrics | null,
) {
  if (metrics !== null) return automaticSummaryInput(options.prompt, metrics);
  return operationalAnalysisInput(options);
}
