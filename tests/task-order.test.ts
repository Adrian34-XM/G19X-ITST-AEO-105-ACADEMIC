import { expect, it } from "vitest";
import { sortTasks } from "../src/modules/workspace/tasks";

it("ordena por prioridad y vencimiento sin modificar los registros originales", () => {
  const tasks = [
    { id: "low", priority: "LOW", due_date: "2026-01-01" },
    { id: "high-later", priority: "HIGH", due_date: "2026-03-01" },
    { id: "medium", priority: "MEDIUM", due_date: "2026-01-01" },
    { id: "high-first", priority: "HIGH", due_date: "2026-02-01" },
    { id: "high-no-date", priority: "HIGH" },
  ];
  expect(sortTasks(tasks).map((t) => t.id)).toEqual([
    "high-first", "high-later", "high-no-date", "medium", "low",
  ]);
  expect(tasks[0].id).toBe("low");
});
