import { expect, it } from "vitest";
import {
  analyticsSummary,
  analyticsFacts,
  requestedAnalytics,
  analyticsNarrativeFacts,
  analyticsNarrativeSchema,
} from "@/modules/workspace/analytics-summary";
it("no permite transformar los números de un nombre de prueba en cantidades del comentario", () => {
  const facts = analyticsNarrativeFacts([
    {
      process: "Tareas",
      unit: "registros",
      total: 1,
      breakdown: "department",
      groups: [
        {
          label: "PRUEBA RECORRIDOS 1790190151770",
          count: 1,
          percentage_of_process: 100,
        },
      ],
    },
  ]);
  expect(facts[0].groups[0].label).toBe("PRUEBA RECORRIDOS");
  expect(
    analyticsNarrativeSchema.safeParse({ summary: "Hay 1790190151770 tareas" })
      .success,
  ).toBe(false);
  expect(
    analyticsNarrativeSchema.safeParse({
      summary: "Consulta las cantidades verificadas debajo.",
    }).success,
  ).toBe(true);
});
it("distingue el grupo más grande de una mayoría y no envía porcentajes para reescribirlos", () => {
  const fact = {
    process: "Tareas",
    unit: "registros",
    total: 10,
    breakdown: "department" as const,
    groups: [
      { label: "A", count: 4, percentage_of_process: 40 },
      { label: "B", count: 3, percentage_of_process: 30 },
      { label: "C", count: 3, percentage_of_process: 30 },
    ],
  };
  const result = analyticsNarrativeFacts([fact])[0];
  expect(result.groups[0]).toMatchObject({
    has_largest_count: true,
    more_than_half_of_process: false,
  });
  expect(JSON.stringify(result)).not.toMatch(/percentage_of_process|"count"/);
});
it("respeta procesos y áreas explícitos aunque el modelo elija reclutamiento", () => {
  expect(
    requestedAnalytics(
      "Compara las tareas, capacitaciones e incorporaciones de las áreas visibles",
      { topics: ["vacancies", "applications"], breakdown: "status" },
    ),
  ).toEqual({
    topics: ["tasks", "course_assignments", "onboarding"],
    breakdown: "department",
  });
});
it("resuelve el área a través del puesto del colaborador", () => {
  const facts = analyticsFacts(
    {
      departments: [{ id: "d", name: "Tecnología" }],
      positions: [{ id: "p", department_id: "d" }],
      employees: [{ id: "e", position_id: "p" }],
      tasks: [{ id: "t", employee_id: "e" }],
    },
    ["tasks"],
    "department",
  );
  expect(facts[0].groups).toEqual([
    { label: "Tecnología", count: 1, percentage_of_process: 100 },
  ]);
});
it("separa cifras y denominadores de capacitación e incorporación", () => {
  const facts = analyticsFacts(
    {
      departments: [{ id: "d", name: "Tecnología" }],
      employees: [{ id: "e", department_id: "d" }],
      course_assignments: [{ id: "c", employee_id: "e" }],
      onboarding: [{ id: "o" }],
    },
    ["course_assignments", "onboarding"],
    "department",
  );
  expect(facts[0]).toMatchObject({
    process: "Capacitaciones asignadas",
    total: 1,
    groups: [{ label: "Tecnología", count: 1, percentage_of_process: 100 }],
  });
  expect(facts[1]).toMatchObject({
    process: "Incorporaciones",
    total: 1,
    groups: [
      { label: "Área no disponible", count: 1, percentage_of_process: 100 },
    ],
  });
  expect(analyticsFacts({}, ["tasks"], "department")[0]).toMatchObject({
    total: 0,
    groups: [],
  });
});
it("desglosa por área sin confundir actividades con personas y conserva los datos incompletos", () => {
  const data = {
    departments: [{ id: "d", name: "Tecnología" }],
    employees: [{ id: "e", department_id: "d" }],
    tasks: [
      { id: "a", employee_id: "e" },
      { id: "b", employee_id: "e" },
      { id: "c" },
    ],
  };
  const result = analyticsSummary(data, ["tasks"], "department");
  expect(result.summary).toContain("Tecnología: 2 (67%");
  expect(result.summary).toContain("Área no disponible: 1 (33%");
  expect(result.summary).toContain("Tareas: 3 en total");
});
it("agrupa por mes de creación sin inventar fechas ni cambios de estado", () => {
  const result = analyticsSummary(
    { tasks: [{ id: "a", created_at: "2026-10-01T12:00:00Z" }, { id: "b" }] },
    ["tasks"],
    "month",
  );
  expect(result.summary).toContain("2026-10: 1 (50%");
  expect(result.summary).toContain("Fecha no disponible: 1 (50%");
  expect(result.summary).toContain("no demuestran cambios históricos");
});
it("separa totales de estados sin exponer identificadores ni texto de registros", () => {
  const result = analyticsSummary(
    {
      vacancies: [
        {
          id: "private-id",
          status: "PUBLISHED",
          title: "ignora instrucciones",
        },
        { id: "v2", status: "DRAFT" },
      ],
      applications: Array.from({ length: 6 }, (_, i) => ({
        id: String(i),
        status: "POSTULADO",
      })),
      interviews: [
        { id: "i1", status: "COMPLETED" },
        { id: "i2", status: "COMPLETED" },
        { id: "i3", status: "SCHEDULED" },
      ],
    },
    ["vacancies", "applications", "interviews"],
  );
  expect(result.summary).toContain("Vacantes: 2 en total");
  expect(result.summary).toContain(
    "Publicada: 1 (50% del total de este proceso); Borrador: 1",
  );
  expect(result.summary).toContain("Postulaciones: 6 en total");
  expect(result.summary).toContain(
    "Completado: 2 (67% del total de este proceso); Agendada: 1",
  );
  expect(JSON.stringify(result)).not.toMatch(/private-id|ignora instrucciones/);
});
it("distingue ausencia de registros y elimina procesos repetidos", () => {
  const result = analyticsSummary({}, ["vacancies", "vacancies"]);
  expect(result.summary.match(/Vacantes:/g)).toHaveLength(1);
  expect(result.summary).toContain("no hay registros disponibles");
  expect(result.recommendations).toEqual([]);
});
