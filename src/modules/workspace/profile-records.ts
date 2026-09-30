/** Expediente de una sola persona: relaciones explícitas, sin datos de clima anónimo. */
import { type Snapshot, type Row, value } from "./types";
export type ProfileRecord = {
  id: string;
  kind: "tasks" | "courses" | "onboarding";
  title: string;
  status: string;
  date: string;
  href: string;
  comment: string;
  files: { id: string; bucket: string }[];
  completed: boolean;
};
export function profileRecords(
  data: Snapshot,
  employee: string,
  base: string,
): ProfileRecord[] {
  const title = (table: string, id: unknown) =>
    value((data[table] ?? []).find((r) => r.id === id) ?? { id: "" }, "title");
  const files = (table: string, field: string, id: string, bucket: string) =>
    (data[table] ?? [])
      .filter((r) => r[field] === id)
      .map((r) => ({ id: r.id, bucket }));
  const date = (r: Row) =>
    value(r, "completed_at") ||
    value(r, "updated_at") ||
    value(r, "created_at");
  const plans = new Set(
    (data.onboarding ?? [])
      .filter((r) => r.employee_id === employee)
      .map((r) => r.id),
  );
  return [
    ...(data.tasks ?? [])
      .filter((r) => r.employee_id === employee)
      .map((r) => ({
        id: r.id,
        kind: "tasks" as const,
        title: value(r, "title"),
        status: value(r, "status"),
        date: date(r),
        href: `${base}/tasks/${r.id}`,
        comment: value(r, "comments"),
        files: files("task_evidence", "task_id", r.id, "task-evidence"),
        completed: r.status === "APPROVED",
      })),
    ...(data.course_assignments ?? [])
      .filter((r) => r.employee_id === employee)
      .map((r) => ({
        id: r.id,
        kind: "courses" as const,
        title: title("courses", r.course_id) || "Capacitación",
        status: value(r, "status"),
        date: date(r),
        href: `${base}/courses/${r.course_id}`,
        comment:
          `Avance registrado: ${Number(r.progress) || 0}%. ${value(r, "review_comments")}`.trim(),
        files: files(
          "course_evidence",
          "assignment_id",
          r.id,
          "course-evidence",
        ),
        completed: r.status === "COMPLETED",
      })),
    ...(data.onboarding_items ?? [])
      .filter((r) => plans.has(String(r.onboarding_id)))
      .map((r) => ({
        id: r.id,
        kind: "onboarding" as const,
        title: value(r, "title"),
        status: value(r, "status"),
        date: date(r),
        href: `${base}/onboarding`,
        comment: value(r, "review_comments") || value(r, "comments"),
        files: files(
          "onboarding_documents",
          "item_id",
          r.id,
          "onboarding-documents",
        ),
        completed: r.status === "COMPLETED",
      })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
