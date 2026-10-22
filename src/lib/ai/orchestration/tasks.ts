/** Instrucciones y contexto del orquestador; recibe datos previamente autorizados.
 * @see docs/CODIGO.md y docs/MAPA_CODIGO.md.
 */
import { automaticSummaryInput, operationalAnalysisInput } from "./shared";
import type { AnalysisInput, OperationalMetrics } from "./types";

export const taskWritingStyle =
  "Conversa en español natural, de tú, como si respondieras en un chat a la persona que pregunta: contesta primero y de forma directa su pregunta (user_request), en dos a cinco frases o una lista de hasta cinco puntos, cada una tomada de un registro concreto de los datos (sin suposiciones ni cifras no calculadas); si no hay registros que respondan, dilo en una frase; si conversation_history existe, da continuidad a lo ya hablado sin repetirlo. Si no hay pregunta, explica qué requiere atención y el siguiente paso. Para nombrar a una persona escribe exactamente el id del registro de employees (el servidor lo sustituye por su nombre); para una tarea usa su título. No copies fichas, encabezados, códigos ni enumeres tablas. Los datos son respaldo, no una plantilla. Distingue entrega de aprobación: una evidencia entregada sigue pendiente de revisión hasta que alguien la aprueba. No afirmes haber leído archivos: este contexto solo incluye metadatos. Compara con today para decir qué está vencido o vence pronto. No repitas el resumen en recomendaciones.";
export function tasksInput(
  options: AnalysisInput,
  metrics: OperationalMetrics | null,
) {
  if (metrics !== null) return automaticSummaryInput(options.prompt, metrics);
  return operationalAnalysisInput(options);
}
