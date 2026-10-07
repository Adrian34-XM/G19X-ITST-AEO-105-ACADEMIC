import { expect, it } from "vitest";
import {
  buildChartReport,
  buildChartReports,
  chartNarrativeContext,
  chartOptionsSchema,
  reportingDay,
} from "../src/modules/workspace/chart-report";
import type { Chart } from "../src/modules/workspace/workforce-ai";
const chart: Chart = {
  title: "Tareas",
  dataset: "tasks",
  group: "day",
  kind: "columns",
};
const options = chartOptionsSchema.parse({ period: "7" });
it("separa estados y comparaciones por área, incluyendo áreas sin actividad y filas sin relación", () => {
  const data = {
    departments: [
      { id: "tec", name: "Tecnología" },
      { id: "sales", name: "Ventas" },
      { id: "empty", name: "Finanzas" },
    ],
    positions: [
      { id: "dev", department_id: "tec" },
      { id: "seller", department_id: "sales" },
    ],
    employees: [
      { id: "a", position_id: "dev" },
      { id: "b", position_id: "seller" },
    ],
    tasks: [
      {
        id: "1",
        employee_id: "a",
        status: "PENDING",
        created_at: "2026-10-07",
        description: "Privado",
      },
      {
        id: "2",
        employee_id: "b",
        status: "APPROVED",
        created_at: "2026-10-02",
      },
      {
        id: "3",
        employee_id: "a",
        status: "APPROVED",
        created_at: "2026-09-28",
      },
      {
        id: "4",
        employee_id: "missing",
        status: "SUBMITTED",
        created_at: "2026-10-06",
      },
      {
        id: "5",
        employee_id: "b",
        status: "SUBMITTED",
        created_at: "2026-10-09",
      },
    ],
  };
  const reports = buildChartReports(
    data,
    [{ ...chart, group: "status", splitBy: "department" }],
    options,
    {},
    "2026-10-07",
  );
  expect(reports).toHaveLength(4);
  const tec = reports.find((r) => r.title.endsWith("· Tecnología"))!;
  const sales = reports.find((r) => r.title.endsWith("· Ventas"))!;
  expect(tec.values).toEqual([{ label: "Pendiente", count: 1 }]);
  expect(sales.values).toEqual([{ label: "Aprobado", count: 1 }]);
  expect(tec.report.comparison?.total).toBe(1);
  expect(sales.report.comparison?.total).toBe(0);
  expect(
    reports.find((r) => r.title.endsWith("· Finanzas"))?.report.total,
  ).toBe(0);
  expect(reports.reduce((n, r) => n + r.report.total, 0)).toBe(3);
  expect(JSON.stringify(chartNarrativeContext(reports))).not.toContain(
    "Privado",
  );
  for (const metric of chartNarrativeContext(reports)) {
    if (metric.area)
      expect(
        metric.facts.every((fact) => fact.startsWith(`${metric.area} (`)),
      ).toBe(true);
  }
  const filtered = buildChartReports(
    {
      ...data,
      departments: [data.departments[0]],
      tasks: data.tasks.filter((r) => r.employee_id === "a"),
    },
    [{ ...chart, splitBy: "department" }],
    options,
    { days: "7" },
    "2026-10-07",
  );
  expect(filtered).toHaveLength(1);
  expect(filtered[0].report.total).toBe(1);
});
it("separa reclutamiento por la vacante relacionada conservando los catálogos", () => {
  const result = buildChartReports(
    {
      departments: [
        { id: "tec", name: "Tecnología" },
        { id: "sales", name: "Ventas" },
      ],
      vacancies: [
        { id: "v1", department_id: "tec" },
        { id: "v2", department_id: "sales" },
      ],
      applications: [
        { id: "a1", vacancy_id: "v1" },
        { id: "a2", vacancy_id: "v2" },
      ],
      interviews: [
        {
          id: "i1",
          application_id: "a1",
          status: "SCHEDULED",
          created_at: "2026-10-07",
        },
      ],
    },
    [
      {
        ...chart,
        dataset: "interviews",
        group: "status",
        splitBy: "department",
      },
    ],
    options,
    {},
    "2026-10-07",
  );
  expect(
    result.find((r) => r.title.endsWith("· Tecnología"))?.report.total,
  ).toBe(1);
  expect(result.find((r) => r.title.endsWith("· Ventas"))?.report.total).toBe(
    0,
  );
});
it("compara ventanas iguales y rellena días sin actividad con ceros", () => {
  const result = buildChartReport(
    {
      tasks: [
        { id: "1", created_at: "2026-10-07", status: "APPROVED" },
        { id: "2", created_at: "2026-10-01", status: "PENDING" },
        { id: "3", created_at: "2026-09-24", status: "PENDING" },
        { id: "4", created_at: "2026-09-30", status: "APPROVED" },
        { id: "5", created_at: "2026-09-23" },
        { id: "6", created_at: "2026-10-08" },
      ],
    },
    chart,
    options,
    {},
    "2026-10-07",
  );
  expect(result.values).toHaveLength(7);
  expect(result.values.find((v) => v.label === "2026-10-02")?.count).toBe(0);
  expect(result.report.total).toBe(2);
  expect(result.report.comparison).toEqual({
    from: "2026-09-24",
    to: "2026-09-30",
    total: 2,
    difference: 0,
    percent: 0,
  });
  expect(result.report.observations.join(" ")).toContain(
    "no finalizaciones ocurridas durante el periodo",
  );
});
it("agrupa por semanas desde lunes sin contar dos veces ni inventar respuestas", () => {
  const result = buildChartReport(
    {
      tasks: [
        { id: "1", created_at: "2026-10-04" },
        { id: "2", created_at: "2026-10-05" },
        { id: "3", created_at: "2026-10-07" },
      ],
    },
    chart,
    { ...options, group: "week" },
    {},
    "2026-10-07",
  );
  expect(result.values).toEqual([
    { label: "2026-09-28", count: 1 },
    { label: "2026-10-05", count: 2 },
  ]);
});
it("interpreta timestamps en Ciudad de México y conserva fechas sin hora", () => {
  expect(reportingDay("2026-10-07T02:00:00Z")).toBe("2026-10-06");
  expect(reportingDay("2026-10-07")).toBe("2026-10-07");
  expect(reportingDay("2026-02-30")).toBe("");
});
it("capacitaciones completadas usan la finalización aunque se asignaron antes", () => {
  const result = buildChartReport(
    {
      course_assignments: [
        {
          id: "1",
          status: "COMPLETED",
          created_at: "2025-01-01",
          completed_at: "2026-10-07",
        },
        { id: "2", status: "COMPLETED", created_at: "2026-10-07" },
        { id: "3", status: "ASSIGNED", completed_at: "2026-10-07" },
      ],
    },
    {
      ...chart,
      dataset: "course_assignments",
      status: "COMPLETED",
      dateField: "completed_at",
    },
    options,
    {},
    "2026-10-07",
  );
  expect(result.report.total).toBe(1);
  expect(result.report.missingDates).toBe(1);
  expect(result.report.period.dateField).toBe("completed_at");
});
it("postulaciones usan applied_at y no requieren created_at", () => {
  const result = buildChartReport(
    {
      applications: [
        { id: "1", applied_at: "2026-10-02", status: "POSTULADO" },
      ],
    },
    { ...chart, dataset: "applications" },
    options,
    {},
    "2026-10-07",
  );
  expect(result.report.total).toBe(1);
  expect(result.report.period.dateField).toBe("applied_at");
});
it("el periodo del módulo acota el rango personalizado", () => {
  const custom = chartOptionsSchema.parse({
    period: "custom",
    from: "2026-09-01",
    to: "2026-10-07",
  });
  const result = buildChartReport(
    {
      tasks: [
        { id: "1", created_at: "2026-09-28" },
        { id: "2", created_at: "2026-10-03" },
      ],
    },
    chart,
    custom,
    { days: "7" },
    "2026-10-07",
  );
  expect(result.report.period.from).toBe("2026-10-01");
  expect(result.report.total).toBe(1);
});
it("no inventa porcentajes de crecimiento cuando la base anterior es cero", () => {
  const result = buildChartReport(
    { tasks: [{ id: "1", created_at: "2026-10-07" }] },
    chart,
    options,
    {},
    "2026-10-07",
  );
  expect(result.report.comparison?.percent).toBeNull();
  expect(result.report.comparison?.difference).toBe(1);
});
it("sin periodo acotado no crea una comparación arbitraria", () => {
  expect(
    buildChartReport(
      { tasks: [] },
      chart,
      chartOptionsSchema.parse({ period: "all" }),
      {},
      "2026-10-07",
    ).report.comparison,
  ).toBeNull();
});
it("rechaza rangos invertidos, fechas imposibles y rangos excesivos", () => {
  for (const [from, to] of [
    ["2026-10-07", "2026-10-01"],
    ["2026-02-30", "2026-03-05"],
    ["2024-01-01", "2026-10-07"],
  ])
    expect(
      chartOptionsSchema.safeParse({ period: "custom", from, to }).success,
    ).toBe(false);
});
it("describe vencidas sin considerar entregas para revisión como atraso", () => {
  const result = buildChartReport(
    {
      tasks: [
        {
          id: "1",
          status: "PENDING",
          created_at: "2026-10-02",
          due_date: "2026-10-04",
        },
        {
          id: "2",
          status: "SUBMITTED",
          created_at: "2026-10-02",
          due_date: "2026-10-04",
        },
      ],
    },
    chart,
    options,
    {},
    "2026-10-07",
  );
  expect(result.report.observations.join(" ")).toContain(
    "1 actividades de esta cohorte tienen plazo vencido",
  );
  expect(result.report.observations.join(" ")).toContain(
    "1 entregas de esta cohorte",
  );
});
