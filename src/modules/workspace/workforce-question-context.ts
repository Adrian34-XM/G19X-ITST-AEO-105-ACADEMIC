/** Prepara hechos limitados para que la IA redacte respuestas de tareas e incorporación. */
import { activityContext } from "./activity-context";
import type { Snapshot } from "./types";

function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

/** Devuelve contexto acotado solo para preguntas agregadas que el servidor puede respaldar. */
export function workforceQuestionContext(
  data: Snapshot,
  mode: "tasks" | "onboarding",
  prompt: string,
  today = new Date().toISOString().slice(0, 10),
) {
  const text = normalize(prompt);
  if (mode === "tasks") {
    const asksOverdue = /\b(atrasad\w*|vencid\w*|fuera de plazo)\b/.test(text);
    if (
      !/\b(tareas?|evidencias?)\b/.test(text) ||
      (!asksOverdue &&
        !/\b(compara|comparar|distribucion|por area|por departamento|estado\w*)\b/.test(
          text,
        ))
    )
      return null;
    const metric = activityContext(data, false, today, ["tasks"]).metrics[0];
    return {
      process: metric?.process ?? "Tareas",
      available: metric?.available ?? false,
      definitions: activityContext(data, false, today, ["tasks"]).definitions,
      limitations:
        "Los estados y cantidades son del conjunto autorizado y filtrado. No se incluyen nombres, descripciones ni contenido privado de evidencias. Aprobadas y canceladas son estados cerrados; entregadas para revisión no significa aprobadas.",
      questionType: asksOverdue ? "overdue" : "comparison",
      areas: (metric?.areas ?? []).map((area) => ({
        area: area.area,
        activities: area.activities,
        people: area.people,
        states: area.states,
        ...(asksOverdue ? { overdueActivities: area.overdueActivities } : {}),
      })),
    };
  }

  if (
    !/\b(onboarding|incorporacion|induccion)\b/.test(text) &&
    !/\b(actividades? de incorporacion|proceso de incorporacion)\b/.test(text)
  )
    return null;

  const context = activityContext(data, true, today);
  const metric = context.metrics[0];
  if (!metric)
    return {
      process: "Incorporación",
      available: false,
      limitations: context.limitations,
      areas: [],
    };

  const dueSoonEnd = new Date(`${today}T12:00:00Z`);
  dueSoonEnd.setUTCDate(dueSoonEnd.getUTCDate() + 7);
  const end = dueSoonEnd.toISOString().slice(0, 10);
  const soon = new Map<string, number>();
  const employees = new Map((data.employees ?? []).map((row) => [row.id, row]));
  const plans = new Map((data.onboarding ?? []).map((row) => [row.id, row]));
  const positions = new Map((data.positions ?? []).map((row) => [row.id, row]));
  const departments = new Map(
    (data.departments ?? []).map((row) => [row.id, row]),
  );
  for (const item of data.onboarding_items ?? []) {
    const due = String(item.due_date ?? "");
    if (
      due < today ||
      due > end ||
      ["COMPLETED", "CANCELLED", "SUBMITTED"].includes(String(item.status))
    )
      continue;
    const employee = employees.get(
      String(plans.get(String(item.onboarding_id))?.employee_id),
    );
    const position = positions.get(String(employee?.position_id));
    const department = departments.get(String(position?.department_id));
    const area = String(department?.name ?? "Área no identificable");
    soon.set(area, (soon.get(area) ?? 0) + 1);
  }
  const asksForPerson = /\b(personas?|quien\w*|empleados?)\b/.test(text);
  const asksForAge = /\b(mas tiempo|antigu\w*|desde hace|cuanto tiempo)\b/.test(
    text,
  );
  return {
    process: metric.process,
    available: metric.available,
    definitions: context.definitions,
    limitations: [
      context.limitations,
      "Este contexto agregado no contiene nombres de personas ni fechas de creación individuales.",
      ...(asksForPerson
        ? [
            "Si piden identificar personas, explica que esta consulta solo permite conteos agregados por área.",
          ]
        : []),
      ...(asksForAge
        ? [
            "No se puede ordenar por antigüedad individual porque no se incluyen fechas de creación de cada actividad.",
          ]
        : []),
      "Por vencer significa una fecha límite entre hoy y los próximos siete días. Las entregas en revisión no cuentan como vencidas.",
    ].join(" "),
    areas: metric.areas.map((area) => ({
      ...area,
      dueSoonActivities: soon.get(area.area) ?? 0,
    })),
  };
}
