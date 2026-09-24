import { expect, it } from "vitest";
import {
  overviewContext,
  readableOverview,
} from "../src/modules/workspace/overview";

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
