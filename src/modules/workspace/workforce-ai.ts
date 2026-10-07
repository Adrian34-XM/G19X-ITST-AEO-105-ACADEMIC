/**
 * @file Contratos de gráficas, borradores formativos y resúmenes. La IA propone una representación;
 * las cifras se calculan con datos autorizados y los nombres de procesos y agrupaciones están
 * restringidos.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** La IA elige una presentación; los valores se calculan con datos autorizados, nunca con código del modelo. */
import { z } from "zod";
import { type Snapshot, value } from "./types";
import { stateLabel } from "./labels";
export const chartSchema = z
  .object({
    title: z.string().min(1).max(160),
    dataset: z.enum([
      "tasks",
      "course_assignments",
      "onboarding",
      "applications",
      "vacancies",
      "interviews",
    ]),
    group: z.enum(["status", "department", "day", "month"]),
    kind: z.enum(["bars", "columns", "line", "pie", "donut"]),
    status: z.string().max(40).optional(),
    days: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
    dateField: z.enum(["created_at", "completed_at"]).optional(),
  })
  .strict();
export const chartAdvice = z
  .object({
    summary: z.string().min(1).max(2000),
    charts: z.array(chartSchema).min(1).max(3),
  })
  .strict();
export const summaryAdvice = z
  .object({
    summary: z.string().min(1).max(3000),
    recommendations: z.array(z.string().max(600)).max(6),
  })
  .strict();
export const trainingDraft = z
  .object({
    title: z.string().trim().min(1).max(150),
    description: z.string().min(1).max(3000),
    content: z.string().min(30).max(14000),
    duration_minutes: z.number().int().min(5).max(10000),
  })
  .strict();
export type Chart = z.infer<typeof chartSchema>;
/** Las instrucciones explícitas sobre módulo, agrupación y formato prevalecen sobre una sugerencia del modelo. */
export function requestedCharts(prompt: string, proposed: Chart[]): Chart[] {
  const text = prompt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const datasets = (
    [
      ["tasks", /tareas?|evidencias?/, "Tareas"],
      ["applications", /postulaciones?|candidatos?/, "Postulaciones"],
      ["vacancies", /vacantes?/, "Vacantes"],
      ["interviews", /entrevistas?/, "Entrevistas"],
      [
        "course_assignments",
        /capacitacion|capacitaciones|cursos?/,
        "Capacitaciones",
      ],
      [
        "onboarding",
        /onboarding|incorporacion|incorporaciones/,
        "Incorporaciones",
      ],
    ] as const
  ).filter(([, pattern]) => pattern.test(text));
  const group: Chart["group"] | null = /por meses|mensual/.test(text)
    ? "month"
    : /fechas?|fehcas|por dias|diari|cronologic/.test(text)
      ? "day"
      : /por estados?/.test(text)
        ? "status"
        : /por (areas?|departamentos?)/.test(text)
          ? "department"
          : null;
  const kind: Chart["kind"] | null = /lineas?|lineal/.test(text)
    ? "line"
    : /dona|anillo/.test(text)
      ? "donut"
      : /columnas?|barras? vertical/.test(text)
        ? "columns"
        : /barras?/.test(text)
          ? "bars"
          : /circular|pastel|torta/.test(text)
            ? "pie"
            : null;
  const chosen: Chart[] =
    datasets.length && !/\bno\b/.test(text)
      ? datasets.slice(0, 3).map(([dataset]) => {
          const proposal =
            proposed.find((chart) => chart.dataset === dataset) ?? proposed[0];
          return {
            title: "",
            dataset,
            group: group ?? proposal?.group ?? "status",
            kind: kind ?? proposal?.kind ?? "bars",
          };
        })
      : proposed.map((c) => ({
          title: "",
          dataset: c.dataset,
          group: group ?? c.group,
          kind: kind ?? c.kind,
        }));
  const names = {
    applications: "Postulaciones",
    vacancies: "Vacantes",
    interviews: "Entrevistas",
    tasks: "Tareas",
    course_assignments: "Capacitaciones",
    onboarding: "Incorporaciones",
  };
  const groups = {
    status: "estado",
    department: "área",
    day: "fecha de creación",
    month: "mes de creación",
  };
  const seen = new Set<string>();
  return chosen
    .filter((c) => {
      const key = c.dataset + ":" + c.group + ":" + c.kind;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => {
      // Cada solicitud puede contener periodos y estados distintos por proceso.
      const clauses = text.split(/;|\by otra\b|\by otro\b|\bademas\b/);
      const pattern = datasets.find(([dataset]) => dataset === c.dataset)?.[1];
      const clause = clauses.find((part) => pattern?.test(part)) ?? text;
      const days: Chart["days"] = /ultima semana|ultimos 7 dias/.test(clause)
        ? 7
        : /ultimo mes|ultimos 30 dias/.test(clause)
          ? 30
          : /ultimos 90 dias/.test(clause)
            ? 90
            : undefined;
      const completed = /completad|finalizad|terminad/.test(clause);
      const status = completed
        ? c.dataset === "tasks"
          ? "APPROVED"
          : "COMPLETED"
        : undefined;
      const dateField =
        completed && c.dataset === "course_assignments"
          ? ("completed_at" as const)
          : ("created_at" as const);
      return {
        ...c,
        ...(status ? { status } : {}),
        ...(days ? { days } : {}),
        ...(dateField === "completed_at" ? { dateField } : {}),
        title:
          names[c.dataset] +
          (completed ? " completadas" : "") +
          " por " +
          groups[c.group].replace(
            "creación",
            dateField === "completed_at" ? "finalización" : "creación",
          ) +
          (days ? ` · últimos ${days} días` : ""),
      };
    })
    .map((c, _, all) => ({
      ...c,
      title:
        all.filter((x) => x.title === c.title).length > 1
          ? c.title +
            " · " +
            {
              bars: "barras",
              columns: "columnas",
              line: "líneas",
              pie: "circular",
              donut: "dona",
            }[c.kind]
          : c.title,
    }));
}

export function chartValues(
  data: Snapshot,
  chart: Chart,
  today = new Date().toISOString().slice(0, 10),
) {
  const groups = new Map<string, number>();
  for (const row of data[chart.dataset] ?? []) {
    if (chart.status && row.status !== chart.status) continue;
    const dateField = chart.dateField ?? "created_at";
    if (chart.days) {
      const timestamp = Date.parse(value(row, dateField));
      const end = Date.parse(today + "T23:59:59.999Z");
      const start =
        Date.parse(today + "T00:00:00Z") - (chart.days - 1) * 86400000;
      if (!Number.isFinite(timestamp) || timestamp < start || timestamp > end)
        continue;
    }
    if (chart.group === "day" || chart.group === "month") {
      const date = value(row, chart.dateField ?? "created_at").slice(0, 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        date > today
      )
        continue;
      const key = chart.group === "month" ? date.slice(0, 7) : date;
      groups.set(key, (groups.get(key) ?? 0) + 1);
      continue;
    }
    const employee = (data.employees ?? []).find(
      (e) => e.id === row.employee_id,
    );
    const position = (data.positions ?? []).find(
      (p) => p.id === employee?.position_id,
    );
    const application = (data.applications ?? []).find(
      (a) => a.id === row.application_id,
    );
    const vacancy =
      chart.dataset === "vacancies"
        ? row
        : (data.vacancies ?? []).find(
            (v) => v.id === (row.vacancy_id ?? application?.vacancy_id),
          );
    const vacancyPosition = (data.positions ?? []).find(
      (p) => p.id === vacancy?.position_id,
    );
    const department = (data.departments ?? []).find(
      (d) =>
        d.id ===
        (vacancy?.department_id ??
          vacancyPosition?.department_id ??
          position?.department_id),
    );
    const label =
      chart.group === "status"
        ? stateLabel(value(row, "status"))
        : department
          ? value(department, "name")
          : "Sin área visible";
    groups.set(label, (groups.get(label) ?? 0) + 1);
  }
  return [...groups]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) =>
      chart.group === "day" || chart.group === "month"
        ? a.label.localeCompare(b.label)
        : b.count - a.count || a.label.localeCompare(b.label),
    );
}
export function workforceMetrics(data: Snapshot) {
  const metrics = Object.fromEntries(
    (["tasks", "course_assignments", "onboarding"] as const).map((dataset) => [
      dataset,
      chartValues(data, { title: "", dataset, group: "status", kind: "bars" }),
    ]),
  );
  return {
    ...metrics,
    actividades_incorporacion: Object.fromEntries(
      ["PENDING", "IN_PROGRESS", "SUBMITTED", "COMPLETED"].map((status) => [
        stateLabel(status),
        (data.onboarding_items ?? []).filter((i) => i.status === status).length,
      ]),
    ),
  };
}
