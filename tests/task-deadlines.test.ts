import { describe, expect, it } from "vitest";
import {
  overdueTasksAnswer,
  overdueTasksByDepartment,
} from "../src/modules/workspace/task-deadlines";

describe("conteo verificable de tareas vencidas por área", () => {
  it("agrupa solo las tareas vencidas sin entregar o aprobar", () => {
    const result = overdueTasksByDepartment(
      {
        departments: [
          { id: "d1", name: "Ventas" },
          { id: "d2", name: "Soporte" },
        ],
        positions: [
          { id: "p1", department_id: "d1" },
          { id: "p2", department_id: "d2" },
        ],
        employees: [
          { id: "e1", position_id: "p1" },
          { id: "e2", position_id: "p2" },
        ],
        tasks: [
          {
            id: "late-1",
            employee_id: "e1",
            due_date: "2026-10-19",
            status: "PENDING",
          },
          {
            id: "late-2",
            employee_id: "e1",
            due_date: "2026-10-20",
            status: "IN_PROGRESS",
          },
          {
            id: "submitted",
            employee_id: "e2",
            due_date: "2026-10-19",
            status: "SUBMITTED",
          },
          {
            id: "approved",
            employee_id: "e2",
            due_date: "2026-10-19",
            status: "APPROVED",
          },
          {
            id: "future",
            employee_id: "e2",
            due_date: "2026-10-22",
            status: "PENDING",
          },
        ],
      },
      "2026-10-21",
    );
    expect(result).toEqual({
      total: 2,
      areas: [{ area: "Ventas", overdueTasks: 2 }],
    });
    expect(overdueTasksAnswer(result)).toContain("Ventas: 2");
  });

  it("explica cuando no hay atrasos según los filtros", () => {
    const result = overdueTasksByDepartment({ tasks: [] }, "2026-10-21");
    expect(result.total).toBe(0);
    expect(overdueTasksAnswer(result)).toContain("no hay tareas atrasadas");
  });
});
