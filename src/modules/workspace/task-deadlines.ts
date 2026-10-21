import { overdue } from "./insights";
import type { Snapshot } from "./types";
import { value } from "./types";

/** Cuenta tareas vencidas por el área actual del puesto, sin delegar las cifras a IA. */
export function overdueTasksByDepartment(data: Snapshot, today: string) {
  const employees = new Map((data.employees ?? []).map((row) => [row.id, row]));
  const positions = new Map((data.positions ?? []).map((row) => [row.id, row]));
  const departments = new Map(
    (data.departments ?? []).map((row) => [row.id, row]),
  );
  const counts = new Map<string, number>();
  let total = 0;
  for (const task of data.tasks ?? []) {
    if (!overdue(task, today)) continue;
    total++;
    const employee = employees.get(String(task.employee_id));
    const position = positions.get(String(employee?.position_id));
    const department = departments.get(String(position?.department_id));
    const name = department ? value(department, "name") : "Área no disponible";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return {
    total,
    areas: [...counts]
      .map(([area, overdueTasks]) => ({ area, overdueTasks }))
      .sort(
        (a, b) =>
          b.overdueTasks - a.overdueTasks || a.area.localeCompare(b.area),
      ),
  };
}

/** Produce una respuesta breve basada solo en conteos calculados en el servidor. */
export function overdueTasksAnswer(
  summary: ReturnType<typeof overdueTasksByDepartment>,
) {
  if (!summary.total)
    return "Con los filtros actuales no hay tareas atrasadas. Se consideran atrasadas las tareas vencidas que no están aprobadas ni entregadas para revisión.";
  const areas = summary.areas
    .map(({ area, overdueTasks }) => `${area}: ${overdueTasks}`)
    .join("; ");
  return `Sí. Hay ${summary.total} ${summary.total === 1 ? "tarea atrasada" : "tareas atrasadas"}. Por área: ${areas}. Se consideran atrasadas las tareas vencidas que no están aprobadas ni entregadas para revisión.`;
}
