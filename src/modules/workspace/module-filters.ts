/**
 * @file Aplica los criterios de búsqueda propios de cada listado. Opera sobre las filas ya cargadas
 * y no consulta páginas adicionales de la base de datos.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import type { Snapshot, Row } from "./types";
export type ModuleFilters = {
  module?: string;
  state?: string;
  priority?: string;
  from?: string;
  to?: string;
  position?: string;
  role?: string;
  required?: string;
  overdue?: string;
  query?: string;
};
export const moduleTables: Record<string, string> = {
  jobs: "vacancies",
  vacancies: "vacancies",
  applications: "applications",
  recommendations: "applications",
  interviews: "interviews",
  employees: "employees",
  onboarding: "onboarding",
  tasks: "tasks",
  courses: "courses",
  users: "profiles",
  positions: "positions",
  departments: "departments",
  audit: "audit_logs",
};
export function filterModule(
  data: Snapshot,
  f: ModuleFilters,
  today = new Date().toISOString().slice(0, 10),
): Snapshot {
  const table = moduleTables[f.module ?? ""];
  if (!table) return data;
  const normalized = (s: unknown) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const find = (t: string, id: unknown) =>
    (data[t] ?? []).find((r) => r.id === id);
  const match = (r: Row) => {
    const person = find("employees", r.employee_id),
      candidate = find("candidates", r.candidate_id),
      application = find("applications", r.application_id);
    const profile = find(
      "profiles",
      r.profile_id ??
        person?.profile_id ??
        candidate?.profile_id ??
        find("candidates", application?.candidate_id)?.profile_id,
    );
    const position = r.position_id ?? person?.position_id;
    const date = String(
      r[
        table === "interviews"
          ? "scheduled_at"
          : table === "applications"
            ? "applied_at"
            : table === "tasks"
              ? "due_date"
              : "created_at"
      ] ?? "",
    ).slice(0, 10);
    return (
      (!f.state ||
        (table === "profiles"
          ? String(r.active) === f.state
          : table === "courses"
            ? (data.course_assignments ?? []).some(
                (a) => a.course_id === r.id && a.status === f.state,
              )
            : r.status === f.state)) &&
      (!f.priority || r.priority === f.priority) &&
      (!f.role || r.role === f.role) &&
      (!f.position || position === f.position) &&
      (!f.required || String(r.required) === f.required) &&
      (!f.from || date >= f.from) &&
      (!f.to || (!!date && date <= f.to)) &&
      (!f.overdue ||
        (f.overdue === "yes") ===
          Boolean(
            r.due_date &&
            String(r.due_date) < today &&
            !["APPROVED", "COMPLETED", "SUBMITTED"].includes(String(r.status)),
          )) &&
      (!f.query ||
        normalized(
          [
            r.title,
            r.name,
            r.full_name,
            r.email,
            r.action,
            r.resource_type,
            profile?.full_name,
            table === "employees" ? find("positions", position)?.name : "",
            find("vacancies", r.vacancy_id ?? application?.vacancy_id)?.title,
          ].join(" "),
        ).includes(normalized(f.query)))
    );
  };
  const result = { ...data, [table]: (data[table] ?? []).filter(match) };
  const ids = new Set(result[table].map((r) => r.id));
  if (table === "tasks")
    result.task_evidence = (data.task_evidence ?? []).filter((r) =>
      ids.has(String(r.task_id)),
    );
  if (table === "onboarding")
    for (const child of ["onboarding_items", "onboarding_documents"])
      result[child] = (data[child] ?? []).filter((r) =>
        ids.has(String(r.onboarding_id)),
      );
  if (table === "courses")
    result.course_assignments = (data.course_assignments ?? []).filter((r) =>
      ids.has(String(r.course_id)),
    );
  return result;
}
