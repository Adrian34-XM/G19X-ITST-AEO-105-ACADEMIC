import { expect, it } from "vitest";
import {
  activityContext,
  selectedFactSummary,
} from "@/modules/workspace/activity-context";
import { scopeData } from "@/modules/workspace/insights";
import type { Snapshot } from "@/modules/workspace/types";
const data: Snapshot = {
  departments: [
    { id: "tech", name: "Tecnología" },
    { id: "ops", name: "Operaciones" },
  ],
  positions: [
    { id: "p1", department_id: "tech" },
    { id: "p2", department_id: "ops" },
  ],
  employees: [
    { id: "a", profile_id: "me", position_id: "p1" },
    { id: "b", position_id: "p1" },
    { id: "c", position_id: "p2" },
  ],
  onboarding: [
    { id: "oa", employee_id: "a" },
    { id: "ob", employee_id: "b" },
    { id: "oc", employee_id: "c" },
  ],
  onboarding_items: [
    { id: "1", onboarding_id: "oa", status: "PENDING", description: "secreto" },
    { id: "2", onboarding_id: "oa", status: "PENDING" },
    {
      id: "3",
      onboarding_id: "ob",
      status: "SUBMITTED",
      due_date: "2020-01-01",
    },
    { id: "4", onboarding_id: "oc", status: "COMPLETED" },
  ],
};
it("cuenta personas únicas por área y no transforma tres actividades en tres personas", () => {
  const context = activityContext(data, true);
  expect(context.metrics[0].areas[0]).toMatchObject({
    area: "Tecnología",
    peopleWithOpenActivities: 2,
    openActivities: 3,
    overdueActivities: 0,
  });
  expect(context.facts.find((f) => f.id.endsWith(":ranking"))?.text).toContain(
    "Tecnología (2 personas y 3 actividades)",
  );
  expect(JSON.stringify(context)).not.toContain("secreto");
});
it("conserva empates y separa actividades completadas", () => {
  const context = activityContext(
    {
      ...data,
      onboarding_items: [
        data.onboarding_items[0],
        { ...data.onboarding_items[3], status: "PENDING" },
      ],
    },
    true,
  );
  expect(context.facts.find((f) => f.id.endsWith(":ranking"))?.text).toContain(
    "Hay empate",
  );
});
it("no convierte datos ausentes ni relaciones incompletas en una conclusión global", () => {
  expect(activityContext({}, true).facts[0].text).toContain(
    "No hay datos disponibles",
  );
  const context = activityContext({ ...data, employees: [] }, true);
  expect(context.metrics[0].unresolvedRecords).toBe(4);
  expect(
    selectedFactSummary(context, {
      facts: ["onboarding_items:ranking"],
      insufficient: false,
    }).summary,
  ).toContain("registros sin persona");
});
it("ignora hechos inventados y comunica que la pregunta no se puede resolver", () => {
  const result = selectedFactSummary(activityContext(data, true), {
    facts: ["hay 15 personas"],
    insufficient: false,
  });
  expect(result.summary).not.toContain("15 personas");
  expect(result.summary).toContain("No hay información suficiente");
});
it("solo resume personas del alcance del empleado", () => {
  const restricted = scopeData(data, {
    id: "me",
    role: "EMPLEADO",
    full_name: "Empleado",
    email: "test@example.invalid",
  });
  const context = activityContext(restricted, true);
  expect(context.metrics[0].areas).toHaveLength(1);
  expect(context.metrics[0].areas[0].peopleWithOpenActivities).toBe(1);
});
it("los módulos de tareas y cursos reciben únicamente sus métricas solicitadas", () => {
  const context = activityContext(
    { ...data, tasks: [{ id: "t", employee_id: "a", status: "PENDING" }] },
    false,
    "2026-09-29",
    ["tasks"],
  );
  expect(context.metrics.map((m) => m.process)).toEqual(["Tareas"]);
  expect(context.facts.every((f) => f.id.startsWith("tasks:"))).toBe(true);
});
