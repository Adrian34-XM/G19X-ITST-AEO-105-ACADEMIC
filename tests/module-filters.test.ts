import { expect, it } from "vitest";
import { filterWorkspace } from "../src/modules/workspace/filters";
const data = {
  employees: [{ id: "e", profile_id: "p" }],
  profiles: [{ id: "p", full_name: "Lucía", active: true, role: "EMPLEADO" }],
  tasks: [
    {
      id: "a",
      employee_id: "e",
      priority: "HIGH",
      status: "PENDING",
      due_date: "2026-09-01",
    },
    {
      id: "b",
      employee_id: "e",
      priority: "LOW",
      status: "APPROVED",
      due_date: "2026-09-02",
    },
  ],
  task_evidence: [
    { id: "x", task_id: "a", employee_id: "e" },
    { id: "y", task_id: "b", employee_id: "e" },
  ],
};
it("combina prioridad, fecha, búsqueda sin acentos y atraso sin modificar el origen", () => {
  const result = filterWorkspace(
    data,
    {
      module: "tasks",
      priority: "HIGH",
      query: "lucia",
      from: "2026-09-01",
      to: "2026-09-01",
      overdue: "yes",
    },
    Date.parse("2026-09-22"),
  );
  expect(result.tasks.map((t) => t.id)).toEqual(["a"]);
  expect(result.task_evidence.map((e) => e.id)).toEqual(["x"]);
  expect(data.tasks).toHaveLength(2);
  expect(
    filterWorkspace(
      data,
      { module: "tasks", overdue: "yes", state: "APPROVED" },
      Date.parse("2026-09-22"),
    ).tasks,
  ).toHaveLength(0);
});
it("filtra usuarios por rol y acceso sin alterar perfiles de otros módulos", () => {
  expect(
    filterWorkspace(data, { module: "users", role: "JEFE" }).profiles,
  ).toHaveLength(0);
  expect(
    filterWorkspace(data, { module: "users", state: "true" }).profiles,
  ).toHaveLength(1);
  expect(
    filterWorkspace(data, { module: "tasks", priority: "HIGH" }).profiles,
  ).toHaveLength(1);
});
it("filtra capacitación por estado de asignación y obligatoriedad", () => {
  const courses = {
    courses: [
      { id: "c", required: true },
      { id: "d", required: false },
    ],
    course_assignments: [
      { id: "a", course_id: "c", status: "COMPLETED" },
      { id: "b", course_id: "d", status: "ASSIGNED" },
    ],
  };
  expect(
    filterWorkspace(courses, {
      module: "courses",
      state: "COMPLETED",
      required: "true",
    }).courses.map((c) => c.id),
  ).toEqual(["c"]);
});
