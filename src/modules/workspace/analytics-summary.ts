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
import { reportingDay } from "./chart-report";
/** El modelo comenta; todas las cantidades y fechas numéricas se muestran desde métricas verificadas. */
export const analyticsNarrativeSchema = z
  .object({
    summary: z
      .string()
      .min(1)
      .max(12000)
      .regex(
        /^[^0-9]*$/,
        "El comentario no debe reescribir cifras; se presentan en las tarjetas verificadas.",
      ),
  })
  .strict();

export const analyticsSelection = z
  .object({
    breakdown: z.enum(["status", "department", "month"]).default("status"),
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
/** Los procesos y agrupaciones explícitos prevalecen sobre la selección del modelo. */
export function requestedAnalytics(
  prompt: string,
  proposed: z.infer<typeof analyticsSelection>,
) {
  const text = prompt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const topics: Topic[] = [];
  if (/\btareas?\b/.test(text)) topics.push("tasks");
  if (/\b(capacitaciones?|capacitacion|cursos?|formacion)\b/.test(text))
    topics.push("course_assignments");
  if (/\b(incorporacion(?:es)?|onboarding)\b/.test(text))
    topics.push("onboarding");
  if (/\bvacantes?\b/.test(text)) topics.push("vacancies");
  if (/\b(postulaciones?|postulacion|candidaturas?)\b/.test(text))
    topics.push("applications");
  if (/\bentrevistas?\b/.test(text)) topics.push("interviews");
  if (/\breclutamiento\b/.test(text))
    topics.push("vacancies", "applications", "interviews");
  const breakdown = /\b(mes|meses|mensual|mensuales)\b/.test(text)
    ? "month"
    : /\b(areas?|departamentos?)\b/.test(text)
      ? "department"
      : /\bestados?\b/.test(text)
        ? "status"
        : proposed.breakdown;
  return {
    topics: topics.length ? [...new Set(topics)] : proposed.topics,
    breakdown,
  };
}
/** Fuentes numéricas separadas por proceso: evita que el modelo mezcle frases de distintos totales. */
export function analyticsFacts(
  data: Snapshot,
  topics: Topic[],
  breakdown: "status" | "department" | "month",
) {
  return [...new Set(topics)].map((topic) => {
    const rows = data[topic] ?? [];
    const groups = new Map<string, number>();
    for (const row of rows) {
      const employee = (data.employees ?? []).find(
        (e) => e.id === row.employee_id,
      );
      const application = (data.applications ?? []).find(
        (a) => a.id === row.application_id,
      );
      const vacancy = (data.vacancies ?? []).find(
        (v) => v.id === (row.vacancy_id ?? application?.vacancy_id),
      );
      const positionId =
        row.position_id ?? employee?.position_id ?? vacancy?.position_id;
      const position = (data.positions ?? []).find((p) => p.id === positionId);
      const departmentId =
        row.department_id ??
        employee?.department_id ??
        vacancy?.department_id ??
        position?.department_id;
      const recordDate = reportingDay(
        row[topic === "applications" ? "applied_at" : "created_at"],
      );
      const label =
        breakdown === "department"
          ? String(
              (data.departments ?? []).find((d) => d.id === departmentId)
                ?.name ?? "Área no disponible",
            )
          : breakdown === "month"
            ? recordDate
              ? recordDate.slice(0, 7)
              : "Fecha no disponible"
            : stateLabel(String(row.status ?? ""));
      groups.set(label, (groups.get(label) ?? 0) + 1);
    }
    return {
      process: names[topic],
      unit: "registros de este proceso, no personas únicas",
      total: rows.length,
      breakdown,
      groups: [...groups].map(([label, count]) => ({
        label,
        count,
        percentage_of_process: Math.round((count / rows.length) * 100),
      })),
    };
  });
}
/** El comentario recibe comparaciones ya resueltas; las cifras se presentan sin reescritura del modelo. */
export function analyticsNarrativeFacts(
  facts: ReturnType<typeof analyticsFacts>,
) {
  return facts.map((fact) => {
    const maximum = Math.max(0, ...fact.groups.map((g) => g.count));
    return {
      process: fact.process,
      available: fact.total > 0,
      grouping: fact.breakdown,
      other_groups_available: fact.groups.some(
        (group) => group.count < maximum,
      ),
      groups: fact.groups
        .filter((group) => group.count === maximum)
        .slice(0, 5)
        .map((group) => ({
          label:
            group.label.replace(/\d+/g, "").replace(/\s+/g, " ").trim() ||
            "Grupo consultado",
          has_largest_count: group.count === maximum,
          more_than_half_of_process: group.count > fact.total / 2,
        })),
      exact_counts_location:
        "Tarjetas debajo del comentario con todos los grupos y cifras verificadas. Aquí solo se muestran los grupos con mayor cantidad, como máximo cinco si hay empate; no inventar la distribución de otros grupos ni reescribir cantidades ni porcentajes.",
    };
  });
}
export function analyticsSummary(
  data: Snapshot,
  topics: Topic[],
  breakdown: "status" | "department" | "month" = "status",
) {
  const unique = [...new Set(topics)];
  const paragraphs = analyticsFacts(data, unique, breakdown).map((fact) => {
    if (!fact.total)
      return `${fact.process}: no hay registros disponibles con los filtros seleccionados.`;
    return `${fact.process}: ${fact.total} en total. Distribución por ${breakdown === "department" ? "área" : breakdown === "month" ? (fact.process === "Postulaciones" ? "mes de postulación o reactivación" : "mes de creación") : "estado"}: ${fact.groups.map(({ label, count, percentage_of_process }) => `${label}: ${count} (${percentage_of_process}% del total de este proceso)`).join("; ")}.`;
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
