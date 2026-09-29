/**
 * @file Construye afirmaciones y conteos verificables de analíticas a partir del conjunto filtrado.
 * El modelo selecciona temas permitidos, mientras el código conserva el control de las cifras y sus
 * límites.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** La IA selecciona procesos; las cifras y las afirmaciones se construyen con registros filtrados. */
import { z } from "zod";
import type { Snapshot } from "./types";
import { stateLabel } from "./labels";

export const analyticsSelection = z
  .object({
    topics: z
      .array(
        z.enum([
          "vacancies",
          "applications",
          "interviews",
          "tasks",
          "course_assignments",
          "onboarding",
        ]),
      )
      .min(1)
      .max(6),
  })
  .strict();
const names = {
  vacancies: "Vacantes",
  applications: "Postulaciones",
  interviews: "Entrevistas",
  tasks: "Tareas",
  course_assignments: "Capacitaciones asignadas",
  onboarding: "Incorporaciones",
};
type Topic = keyof typeof names;
export function analyticsSummary(data: Snapshot, topics: Topic[]) {
  const unique = [...new Set(topics)];
  const paragraphs = unique.map((topic) => {
    const rows = data[topic] ?? [];
    if (!rows.length)
      return `${names[topic]}: no hay registros disponibles con los filtros seleccionados.`;
    const states = new Map<string, number>();
    for (const row of rows) {
      const label = stateLabel(String(row.status ?? ""));
      const key =
        label === "Estado no reconocido" ? "Sin estado reconocido" : label;
      states.set(key, (states.get(key) ?? 0) + 1);
    }
    return `${names[topic]}: ${rows.length} en total. Distribución por estado: ${[...states].map(([label, count]) => `${label.toLocaleLowerCase("es")}: ${count}`).join("; ")}.`;
  });
  return {
    summary:
      paragraphs.join("\n\n") +
      "\n\nEstas cifras corresponden a los registros cargados y los filtros seleccionados (hasta 1000 por tabla). Describen el estado actual; no demuestran cambios históricos ni evalúan a las personas. Los procesos sin registros no permiten concluir bajo desempeño.",
    recommendations: unique
      .filter((topic) => (data[topic] ?? []).length)
      .slice(0, 3)
      .map((topic) => ({
        title: `Revisar ${names[topic].toLocaleLowerCase("es")}`,
        reason:
          "Consulta la distribución por estado y revisa los registros del proceso antes de decidir los siguientes pasos.",
        priority: "LOW" as const,
        resource_type:
          topic === "course_assignments" ? ("courses" as const) : topic,
        resource_id: null,
        employee_id: null,
      })),
  };
}
