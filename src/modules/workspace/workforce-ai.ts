/**
 * @file Contratos de gráficas, borradores formativos y resúmenes. La IA propone una representación;
 * las cifras se calculan con datos autorizados y los nombres de procesos y agrupaciones están
 * restringidos.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** La IA elige una presentación; los valores se calculan con datos autorizados, nunca con código del modelo. */
import { z } from "zod";
import { type Snapshot, type Row, value } from "./types";
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
    group: z.enum(["status", "department", "day", "week", "month"]),
    kind: z.enum(["bars", "columns", "line", "pie", "donut"]),
    status: z.string().max(40).optional(),
    days: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
    dateField: z.enum(["created_at", "completed_at", "applied_at"]).optional(),
    splitBy: z.literal("department").optional(),
  })
  .strict();
export const chartAdvice = z
  .object({
    summary: z.string().min(1).max(2000),
    charts: z.array(chartSchema).min(1).max(6),
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
  const splitByArea =
    /(?:cada|por cada) (?:area|departamento)|(?:una|1) grafica por (?:area|departamento)|graficas por (?:area|departamento)/.test(
      text,
    );
  const detectGroup = (part: string): Chart["group"] | null =>
    /por semanas?|semanal/.test(part)
      ? "week"
      : /por meses|por mes\b|mensual/.test(part)
        ? "month"
        : /fechas?|fehcas|por dias?|diari|cronologic/.test(part)
          ? "day"
          : /estados?/.test(part)
            ? "status"
            : /por (areas?|departamentos?)/.test(part) && !splitByArea
              ? "department"
              : null;
  const detectKind = (part: string): Chart["kind"] | null =>
    /lineas?|lineal/.test(part)
      ? "line"
      : /dona|anillo/.test(part)
        ? "donut"
        : /columnas?|barras? vertical/.test(part)
          ? "columns"
          : /barras?/.test(part)
            ? "bars"
            : /circular|pastel|torta/.test(part)
              ? "pie"
              : null;
  const group = detectGroup(text);
  const kind = detectKind(text);
  const clauses = text.split(
    /;|\by otra\b|\by otro\b|\bademas\b|\by (?=por (?:estado|semana|mes|dia|area)|en (?:barra|linea|columna|circular))/,
  );
  const details = (part: string, dataset: Chart["dataset"]): Partial<Chart> => {
    const days = /ultima semana|ultimos 7 dias/.test(part)
      ? 7
      : /ultimo mes|ultimos 30 dias/.test(part)
        ? 30
        : /ultimos 90 dias/.test(part)
          ? 90
          : undefined;
    const completed = /completad|finalizad|terminad/.test(part);
    return {
      ...(days ? { days } : {}),
      ...(completed
        ? { status: dataset === "tasks" ? "APPROVED" : "COMPLETED" }
        : {}),
      ...(completed && dataset === "course_assignments"
        ? { dateField: "completed_at" }
        : {}),
    };
  };
  const chosen: Chart[] =
    datasets.length && !/\bno\b/.test(text)
      ? datasets.flatMap(([dataset, pattern]) => {
          const proposal =
            proposed.find((chart) => chart.dataset === dataset) ?? proposed[0];
          const parts = clauses.filter((part) => pattern.test(part));
          const proposals = proposed.filter((c) => c.dataset === dataset);
          if (
            clauses.length === 1 &&
            /varias graficas|(?:dos|tres|cuatro|cinco|seis|[2-6]) graficas/.test(
              text,
            ) &&
            proposals.length > 1
          )
            return proposals.map((c) => ({
              ...c,
              group: group ?? c.group,
              kind: kind ?? c.kind,
              ...details(text, dataset),
              ...(splitByArea ? { splitBy: "department" as const } : {}),
            }));
          // «Tareas por estado y otra por semana» mantiene dos vistas del mismo proceso.
          const requests =
            datasets.length === 1 && clauses.length > 1
              ? clauses
              : parts.length
                ? parts
                : [text];
          return requests.map((part) => ({
            title: "",
            dataset,
            group:
              detectGroup(part) ??
              (splitByArea ? "status" : (group ?? proposal?.group ?? "status")),
            kind: detectKind(part) ?? kind ?? proposal?.kind ?? "bars",
            ...details(part, dataset),
            ...(splitByArea ? { splitBy: "department" as const } : {}),
          }));
        })
      : proposed.map((c) => ({
          ...c,
          group: group ?? c.group,
          kind: kind ?? c.kind,
          ...details(text, c.dataset),
          ...(splitByArea ? { splitBy: "department" as const } : {}),
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
    week: "semana de creación",
    month: "mes de creación",
  };
  const seen = new Set<string>();
  return chosen
    .filter((c) => {
      const key = [
        c.dataset,
        c.group,
        c.kind,
        c.splitBy,
        c.status,
        c.days,
        c.dateField,
      ].join(":");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((c) => {
      const { days } = c;
      const completed = c.status === "APPROVED" || c.status === "COMPLETED";
      const dateField = c.dateField ?? "created_at";
      return {
        ...c,
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

/** Resuelve el área por relaciones autorizadas; se comparte entre agrupación y gráficas por área. */
export function chartDepartment(
  data: Snapshot,
  dataset: Chart["dataset"],
  row: Row,
) {
  const employee = (data.employees ?? []).find((e) => e.id === row.employee_id);
  const position = (data.positions ?? []).find(
    (p) => p.id === employee?.position_id,
  );
  const application = (data.applications ?? []).find(
    (a) => a.id === row.application_id,
  );
  const vacancy =
    dataset === "vacancies"
      ? row
      : (data.vacancies ?? []).find(
          (v) => v.id === (row.vacancy_id ?? application?.vacancy_id),
        );
  const vacancyPosition = (data.positions ?? []).find(
    (p) => p.id === vacancy?.position_id,
  );
  return (data.departments ?? []).find(
    (d) =>
      d.id ===
      (vacancy?.department_id ??
        vacancyPosition?.department_id ??
        position?.department_id),
  );
}

export function chartValues(
  data: Snapshot,
  chart: Chart,
  today = new Date().toISOString().slice(0, 10),
) {
  const groups = new Map<string, number>();
  for (const row of data[chart.dataset] ?? []) {
    if (chart.status && row.status !== chart.status) continue;
    const dateField =
      chart.dateField ??
      (chart.dataset === "applications" ? "applied_at" : "created_at");
    if (chart.days) {
      const timestamp = Date.parse(value(row, dateField));
      const end = Date.parse(today + "T23:59:59.999Z");
      const start =
        Date.parse(today + "T00:00:00Z") - (chart.days - 1) * 86400000;
      if (!Number.isFinite(timestamp) || timestamp < start || timestamp > end)
        continue;
    }
    if (["day", "week", "month"].includes(chart.group)) {
      const date = value(row, dateField).slice(0, 10);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        date > today
      )
        continue;
      const monday = new Date(date + "T12:00:00Z");
      monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
      const key =
        chart.group === "month"
          ? date.slice(0, 7)
          : chart.group === "week"
            ? monday.toISOString().slice(0, 10)
            : date;
      groups.set(key, (groups.get(key) ?? 0) + 1);
      continue;
    }
    const department =
      chart.group === "department"
        ? chartDepartment(data, chart.dataset, row)
        : undefined;
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
      ["day", "week", "month"].includes(chart.group)
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
