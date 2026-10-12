import { expect, it } from "vitest";
import {
  overviewSummaryInput,
  compactOverview,
  overviewReviewContext,
} from "@/lib/ai/overview-summary";
import {
  overviewContext,
  readableOverview,
} from "../src/modules/workspace/overview";
it("quita frases repetidas sin fabricar ni reescribir el comentario del modelo", () => {
  expect(
    compactOverview(
      "Esta semana hay una tarea nueva. Sugiero revisar su entrega. Esta semana hay una tarea nueva. Sugiero revisar su entrega.",
    ),
  ).toBe("Esta semana hay una tarea nueva. Sugiero revisar su entrega.");
});

it("sustituye UUID por títulos autorizados y oculta referencias desconocidas", () => {
  const id = "c77ae0ec-6011-4161-8d5c-7d99c7cdf32f";
  const unknown = "5e18c371-c0e8-494a-9f05-f168f5b4515d";
  const result = readableOverview(
    `Revisa la tarea con ID ${id}. Otra referencia: ${unknown}.`,
    { tasks: [{ id, title: "Preparar bienvenida" }] },
  );
  expect(result).toContain("Preparar bienvenida");
  expect(result).not.toContain(id);
  expect(result).not.toContain(unknown);
  expect(result).not.toContain("ID");
});

it("agrupa indicadores por área sin incluir tareas de otros equipos", () => {
  const result = overviewContext(
    {
      employees: [
        { id: "boss", profile_id: "me", position_id: "p" },
        { id: "e", profile_id: "worker", position_id: "p", manager_id: "boss" },
        { id: "foreign", profile_id: "other", position_id: "p2" },
      ],
      positions: [
        { id: "p", department_id: "d" },
        { id: "p2", department_id: "d2" },
      ],
      departments: [
        { id: "d", name: "Tecnología" },
        { id: "d2", name: "Otra área" },
      ],
      tasks: [
        {
          id: "t",
          title: "Revisar accesos",
          employee_id: "e",
          status: "PENDING",
          due_date: "2026-09-01",
        },
        {
          id: "hidden",
          employee_id: "foreign",
          status: "PENDING",
          due_date: "2026-09-01",
        },
      ],
    },
    { id: "me", full_name: "Jefe", email: "test@example.test", role: "JEFE" },
    "2026-09-23",
  );
  expect(result.areas).toHaveLength(1);
  expect(result.areas[0]).toMatchObject({
    name: "Tecnología",
    overdue_tasks: 1,
    people: 2,
  });
  expect(result.data.tasks[0].title).toBe("Revisar accesos");
  const summary = overviewSummaryInput(result, "");
  expect(summary.areas).toEqual([
    { nombre: "Tecnología", tareas_sin_finalizar: 1, tareas_atrasadas: 1 },
  ]);
  expect(summary.nuevas_postulaciones).toBeUndefined();
  expect(summary.verified_facts).toEqual([
    "Tecnología: de los registros creados esta semana, su estado actual muestra tareas sin finalizar: 1, tareas atrasadas: 1. No demuestra cuándo se completaron.",
  ]);
});
it("no presenta ceros semanales como ausencia general de pendientes", () => {
  const context = overviewContext(
    {
      departments: [{ id: "d", name: "Tecnología" }],
      positions: [{ id: "p", department_id: "d" }],
      employees: [{ id: "e", profile_id: "me", position_id: "p" }],
      tasks: [],
      applications: [],
    },
    { id: "me", role: "RH_ADMIN", full_name: "RH", email: "test@nexo.test" },
    "2026-10-05",
  );
  const input = overviewSummaryInput(context, "");
  expect(input.areas).toEqual([]);
  expect(input.nuevas_postulaciones).toBe(0);
  expect(input.limitation).toContain("no afirmes que no hay pendientes");
  expect(input.verified_facts[0]).toContain(
    "no significa que no haya pendientes anteriores",
  );
});
it("comparte hechos de postulaciones con el revisor sin convertir instrucciones en evidencia", () => {
  const context = overviewContext(
    {
      applications: [{ id: "a" }],
      tasks: [],
      departments: [],
      positions: [],
      employees: [],
    },
    { id: "rh", role: "RH_ADMIN", full_name: "RH", email: "test@nexo.test" },
    "2026-10-12",
  );
  const source = overviewSummaryInput(context, "Revisa mis novedades");
  const answer = {
    summary: "Esta semana se recibió una postulación. Sugiero revisarla.",
  };
  const review = overviewReviewContext(source, answer);
  expect(source.verified_facts[0]).toContain("1 postulación");
  expect(source.verified_facts[0]).toContain("pueden incluir reactivadas");
  expect(review.verified_facts).toEqual(source.verified_facts);
  expect(review.proposed_answer).toBe(answer);
  expect(review).not.toHaveProperty("instructions");
  expect(review).not.toHaveProperty("user_request");
});
it("una semana sin altas no agrega reclutamiento a las fuentes de una jefatura", () => {
  const context = overviewContext(
    { employees: [], tasks: [] },
    { id: "boss", role: "JEFE", full_name: "Jefe", email: "test@nexo.test" },
    "2026-10-12",
  );
  const facts = overviewSummaryInput(context, "").verified_facts.join(" ");
  expect(facts).not.toMatch(/postulaciones|vacantes/);
  expect(facts).toContain("pendientes anteriores");
});
it("resume señales autorizadas sin textos privados ni expedientes de otra jerarquía", () => {
  const result = overviewContext(
    {
      employees: [
        { id: "own", profile_id: "me" },
        { id: "foreign", profile_id: "other" },
      ],
      tasks: [
        {
          id: "t",
          employee_id: "own",
          status: "PENDING",
          due_date: "2026-09-01",
          description: "secreto",
          created_at: "2026-09-21T10:00:00Z",
        },
        { id: "hidden", employee_id: "foreign", status: "PENDING" },
      ],
      onboarding: [
        { id: "o", employee_id: "own" },
        { id: "other-onboarding", employee_id: "foreign" },
      ],
      onboarding_items: [
        { id: "own-step", onboarding_id: "o", status: "PENDING" },
        {
          id: "private-step",
          onboarding_id: "other-onboarding",
          status: "PENDING",
        },
      ],
      onboarding_documents: [
        {
          id: "doc",
          onboarding_id: "o",
          file_path: "private/path",
          comments: "datos médicos",
          status: "SUBMITTED",
        },
      ],
      audit_logs: [{ id: "audit", action: "UPDATE" }],
    },
    {
      id: "me",
      full_name: "Nombre privado",
      email: "private@test",
      role: "EMPLEADO",
    },
    "2026-09-22",
  );
  const text = JSON.stringify(result);
  for (const hidden of [
    "secreto",
    "private/path",
    "datos médicos",
    "private-step",
    "other-onboarding",
    "private@test",
    "Nombre privado",
  ])
    expect(text).not.toContain(hidden);
  expect(result.data.tasks).toHaveLength(1);
  expect(result.data.audit_logs).toBeUndefined();
  expect(result.notifications).toContainEqual({
    id: "t",
    section: "tasks",
    kind: "overdue",
  });
  expect(result.recent).toEqual([expect.objectContaining({ id: "t" })]);
});

it("el resumen no expone tablas ni estados técnicos incluso si la IA los devuelve", () => {
  const input =
    "Hay actividades en 'onboarding_items' con estado 'PENDING', tareas en tasks con estado IN_PROGRESS y climate_surveys con estado OPEN. **COMPLETED** en course_assignments.";
  const result = readableOverview(input, {});
  for (const token of [
    "onboarding_items",
    "PENDING",
    "tasks",
    "IN_PROGRESS",
    "climate_surveys",
    "OPEN",
    "COMPLETED",
    "course_assignments",
    "**",
  ])
    expect(result).not.toContain(token);
  expect(result).toContain("actividades de incorporación");
  expect(result).toContain("pendiente");
  expect(result).toContain("en progreso");
  expect(result).toContain("encuestas de ambiente laboral");
});
it("traduce etiquetas escapadas sin confundir incorporación y capacitación", () => {
  expect(
    readableOverview("onboarding\\_items COMPLETED; courses ASSIGNED", {}),
  ).toBe("actividades de incorporación completado; capacitaciones asignado");
});
