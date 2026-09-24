/** La IA elige una presentación; los valores se calculan con datos autorizados, nunca con código del modelo. */
import { z } from "zod";
import { type Snapshot, value } from "./types";
import { stateLabel } from "./labels";
export const chartSchema = z
  .object({
    title: z.string().min(1).max(160),
    dataset: z.enum(["tasks", "course_assignments", "onboarding"]),
    group: z.enum(["status", "department"]),
    kind: z.enum(["bars", "pie"]),
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
  const group = /por estados?/.test(text)
    ? "status"
    : /por (areas?|departamentos?)/.test(text)
      ? "department"
      : null;
  const kind = /barras?/.test(text)
    ? "bars"
    : /circular|pastel|torta/.test(text)
      ? "pie"
      : null;
  if (datasets.length === 1 && group && !/\bno\b/.test(text)) {
    const [dataset, , label] = datasets[0];
    return [
      {
        title: `${label} por ${group === "status" ? "estado" : "área"}`,
        dataset,
        group,
        kind: kind ?? proposed[0]?.kind ?? "bars",
      },
    ];
  }
  return proposed;
}
export function chartValues(data: Snapshot, chart: Chart) {
  const groups = new Map<string, number>();
  for (const row of data[chart.dataset] ?? []) {
    const employee = (data.employees ?? []).find(
      (e) => e.id === row.employee_id,
    );
    const position = (data.positions ?? []).find(
      (p) => p.id === employee?.position_id,
    );
    const department = (data.departments ?? []).find(
      (d) => d.id === position?.department_id,
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
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
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
