/** El contexto de IA y las alertas deben respetar el equipo y minimizar datos privados. */
import { it, expect } from "vitest";
import {
  scopeData,
  canReviewTeamPerformance,
  insightContext,
  overdue,
  notifications,
  taskRecipients,
} from "../src/modules/workspace/insights";
import { mayEnter } from "../src/lib/permissions";
import { type Profile, type Snapshot } from "../src/modules/workspace/types";
const manager: Profile = {
  id: "boss",
  role: "JEFE",
  email: "private@test",
  full_name: "Jefe",
};
const data: Snapshot = {
  employees: [
    { id: "m", profile_id: "boss" },
    { id: "e", profile_id: "employee", manager_id: "m", position_id: "p" },
    { id: "foreign", profile_id: "other", manager_id: "other-manager" },
  ],
  profiles: [{ id: "boss", email: "secret-email", full_name: "Jefe" }],
  positions: [{ id: "p", name: "Desarrollador", department_id: "d" }],
  departments: [{ id: "d", name: "Tecnología" }],
  tasks: [
    {
      id: "t",
      employee_id: "e",
      status: "PENDING",
      due_date: "2026-01-01",
      title: "Pendiente",
    },
    {
      id: "hidden",
      employee_id: "foreign",
      status: "PENDING",
      due_date: "2026-01-01",
    },
  ],
  courses: [{ id: "course", title: "SQL" }],
  course_assignments: [],
  audit_logs: [{ id: "audit", action: "UPDATE" }],
};
it("jefe ve su equipo, RH todas las áreas y empleado solo lo suyo", () => {
  expect(canReviewTeamPerformance(data, manager)).toBe(true);
  expect(
    canReviewTeamPerformance(
      { ...data, employees: [data.employees[0], data.employees[2]] },
      manager,
    ),
  ).toBe(false);
  expect(canReviewTeamPerformance(data, { ...manager, role: "EMPLEADO" })).toBe(
    false,
  );
  expect(canReviewTeamPerformance(data, { ...manager, role: "RH_ADMIN" })).toBe(
    true,
  );
  expect(scopeData(data, manager).tasks.map((t) => t.id)).toEqual(["t"]);
  expect(scopeData(data, { ...manager, role: "RH_ADMIN" }).tasks).toHaveLength(
    2,
  );
  expect(
    scopeData(data, {
      ...manager,
      id: "employee",
      role: "EMPLEADO",
    }).employees.map((e) => e.id),
  ).toEqual(["e"]);
  expect(scopeData(data, manager).audit_logs).toHaveLength(0);
});
it("contexto de cursos contiene puesto y catálogo sin correos ni equipos ajenos", () => {
  const context = insightContext(data, manager, "courses", "2026-09-17");
  expect(context.data.positions[0].name).toBe("Desarrollador");
  expect(context.data.courses[0].id).toBe("course");
  expect(JSON.stringify(context)).not.toContain("secret-email");
  expect(JSON.stringify(context)).not.toContain("other-manager");
});
it("alertas de atraso excluyen entregadas, aprobadas y vencimientos de hoy", () => {
  expect(
    overdue(
      { id: "t", status: "PENDING", due_date: "2026-09-16" },
      "2026-09-17",
    ),
  ).toBe(true);
  for (const status of ["SUBMITTED", "APPROVED"])
    expect(
      overdue({ id: "t", status, due_date: "2026-09-16" }, "2026-09-17"),
    ).toBe(false);
  expect(
    overdue(
      { id: "t", status: "PENDING", due_date: "2026-09-17" },
      "2026-09-17",
    ),
  ).toBe(false);
  expect(
    notifications(scopeData(data, manager), "2026-09-17").map((n) => n.id),
  ).toEqual(["t"]);
});
it("la ruta de auditoría exige superadministrador", () => {
  expect(mayEnter("RH_ADMIN", "/rh/audit")).toBe(false);
  expect(mayEnter("SUPERUSER", "/admin/audit")).toBe(true);
});
it("asignar tareas excluye al propio jefe, superiores y otras ramas, conservando descendientes", () => {
  const tree: Snapshot = {
    ...data,
    employees: [
      ...data.employees.map((e) =>
        e.id === "m" ? { ...e, manager_id: "top" } : e,
      ),
      { id: "top", profile_id: "superior" },
      { id: "peer", profile_id: "peer", manager_id: "top" },
      { id: "nested", profile_id: "nested", manager_id: "e" },
    ],
  };
  expect(taskRecipients(tree, manager).employees.map((e) => e.id)).toEqual([
    "e",
    "nested",
  ]);
  expect(
    taskRecipients(tree, { ...manager, role: "RH_ADMIN" }).employees,
  ).toHaveLength(6);
  expect(
    taskRecipients(tree, { ...manager, role: "EMPLEADO" }).employees,
  ).toEqual([]);
  expect(scopeData(tree, manager).employees.some((e) => e.id === "m")).toBe(
    true,
  );
});
