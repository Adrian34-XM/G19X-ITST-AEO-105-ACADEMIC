import { it, expect } from "vitest";
import { filterWorkspace } from "../src/modules/workspace/filters";
import { insightContext, scopeData } from "../src/modules/workspace/insights";
import { formFor } from "../src/modules/workspace/forms";
import { organization } from "../src/modules/workspace/organization";
import type { Snapshot, Profile } from "../src/modules/workspace/types";
const data: Snapshot = {
  departments: [{ id: "area1" }, { id: "area2" }],
  positions: [
    { id: "p1", department_id: "area1" },
    { id: "p2", department_id: "area2" },
  ],
  employees: [
    { id: "boss", profile_id: "boss-user", position_id: "p1" },
    {
      id: "child",
      profile_id: "child-user",
      manager_id: "boss",
      position_id: "p1",
    },
    { id: "e1", manager_id: "child", position_id: "p1" },
    { id: "e2", position_id: "p2" },
  ],
  tasks: [
    { id: "t1", employee_id: "e1" },
    { id: "t2", employee_id: "e2" },
  ],
  task_evidence: [
    { id: "ev1", employee_id: "e1" },
    { id: "ev2", employee_id: "e2" },
  ],
  onboarding: [
    { id: "o1", employee_id: "e1" },
    { id: "o2", employee_id: "e2" },
  ],
  onboarding_items: [
    { id: "i1", onboarding_id: "o1" },
    { id: "i2", onboarding_id: "o2" },
  ],
  vacancies: [
    { id: "v1", position_id: "p1" },
    { id: "v2", position_id: "p2" },
  ],
  applications: [
    {
      id: "a1",
      candidate_id: "c1",
      vacancy_id: "v1",
      status: "PRESELECCIONADO",
      applied_at: "2026-09-20T00:00:00Z",
    },
    {
      id: "a2",
      candidate_id: "c1",
      vacancy_id: "v2",
      status: "PRESELECCIONADO",
      applied_at: "2026-08-01T00:00:00Z",
    },
  ],
  interviews: [{ id: "int1", application_id: "a1", status: "SCHEDULED" }],
};
it("filtra tareas y evidencias de varias personas sin incluir el resto", () => {
  const result = filterWorkspace(data, { employees: ["e1", "boss"] });
  expect(result.employees.map((e) => e.id)).toEqual(["boss", "e1"]);
  expect(result.tasks.map((t) => t.id)).toEqual(["t1"]);
  expect(result.task_evidence.map((t) => t.id)).toEqual(["ev1"]);
});
it("organigrama conserva superiores de otra área y no agrega personas ajenas", () => {
  const changed = {
    ...data,
    employees: data.employees.map((e) =>
      e.id === "boss" ? { ...e, position_id: "p2" } : e,
    ),
  };
  const tree = organization(changed, "area1");
  expect(tree.employees.map((e) => e.id)).toEqual(["boss", "child", "e1"]);
  expect(tree.matches.has("boss")).toBe(false);
  expect(tree.roots.map((e) => e.id)).toEqual(["boss"]);
  const scoped = scopeData(changed, {
    id: "child-user",
    role: "JEFE",
    full_name: "Jefe",
    email: "",
  });
  expect(organization(scoped).employees.map((e) => e.id)).toEqual([
    "child",
    "e1",
  ]);
});
it("organigrama vacío y ciclos históricos no bloquean el recorrido", () => {
  expect(organization(data, "missing").roots).toHaveLength(0);
  const cycle = organization({
    employees: [
      { id: "a", manager_id: "b" },
      { id: "b", manager_id: "a" },
    ],
  });
  expect(cycle.roots).toHaveLength(1);
  expect(cycle.employees).toHaveLength(2);
});
it("filtra onboarding, tareas, evidencias y postulaciones de forma coherente por área", () => {
  const result = filterWorkspace(data, { department: "area1" });
  expect(result.tasks.map((r) => r.id)).toEqual(["t1"]);
  expect(result.task_evidence.map((r) => r.id)).toEqual(["ev1"]);
  expect(result.onboarding_items.map((r) => r.id)).toEqual(["i1"]);
  expect(result.applications.map((r) => r.id)).toEqual(["a1"]);
  expect(
    filterWorkspace(data, { department: "area1", employee: "e2" }).employees,
  ).toHaveLength(0);
});
it("el análisis de un subordinado conserva su contexto sin ampliar al resto del equipo", () => {
  const profile: Profile = {
    id: "boss-user",
    role: "JEFE",
    full_name: "Jefe",
    email: "private",
  };
  const result = insightContext(data, profile, "performance", "2026-09-21", {
    employee: "e1",
  });
  expect(result.data.employees.map((r) => r.id)).toEqual(["e1"]);
  expect(result.data.tasks.map((r) => r.id)).toEqual(["t1"]);
  expect(
    scopeData(data, { ...profile, role: "SUPERUSER" }).employees,
  ).toHaveLength(4);
});
it("filtra analíticas por periodo y proceso", () => {
  const result = filterWorkspace(
    data,
    { process: "applications", days: "7" },
    Date.parse("2026-09-21T00:00:00Z"),
  );
  expect(result.applications.map((r) => r.id)).toEqual(["a1"]);
  expect(result.tasks).toHaveLength(0);
});
it("agenda excluye al candidato ocupado en cualquier vacante y permite editar su cita", () => {
  const options = formFor("interviews", data).fields.find(
    (f) => f.key === "application_id",
  )!.options;
  expect(options).toHaveLength(0);
  expect(
    formFor("interviews", data, { id: "int1" }).fields.find(
      (f) => f.key === "application_id",
    )!.options,
  ).toHaveLength(2);
});
