import { type Row, value } from "./types";

/** Prioridad descendente; a igual prioridad, primero la fecha límite más cercana. */
export function sortTasks(tasks: Row[]) {
  const priority: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return [...tasks].sort(
    (a, b) =>
      (priority[value(a, "priority")] ?? 3) -
        (priority[value(b, "priority")] ?? 3) ||
      (value(a, "due_date") || "9999").localeCompare(
        value(b, "due_date") || "9999",
      ) ||
      a.id.localeCompare(b.id),
  );
}
