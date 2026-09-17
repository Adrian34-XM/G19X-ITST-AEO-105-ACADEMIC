/** Señales verificables calculadas sobre datos ya autorizados, sin inventar resultados de IA. */
import { type Profile, type Row, type Snapshot, value } from "./types";
export type InsightArea =
  "overview" | "courses" | "tasks" | "performance" | "analytics";
export function overdue(task: Row, today: string) {
  return (
    !!task.due_date &&
    value(task, "due_date") < today &&
    !["APPROVED", "SUBMITTED"].includes(value(task, "status"))
  );
}
export function scopeData(data: Snapshot, profile: Profile): Snapshot {
  // Defensa adicional: ni la interfaz ni el contexto de IA dependen solo del filtro visual.
  const employees = (data.employees ?? []).filter(
    (e) =>
      profile.role === "RH_ADMIN" ||
      e.profile_id === profile.id ||
      (profile.role === "JEFE" &&
        (data.employees ?? []).some(
          (m) => m.id === e.manager_id && m.profile_id === profile.id,
        )),
  );
  const ids = new Set(employees.map((e) => e.id));
  const result: Snapshot = {
    ...data,
    employees,
    audit_logs: profile.role === "SUPERUSER" ? (data.audit_logs ?? []) : [],
  };
  for (const table of [
    "tasks",
    "course_assignments",
    "onboarding",
    "task_evidence",
  ])
    result[table] = (data[table] ?? []).filter((r) =>
      ids.has(String(r.employee_id)),
    );
  return result;
}
export function notifications(data: Snapshot, today: string) {
  return [
    ...(data.tasks ?? [])
      .filter((t) => overdue(t, today))
      .map((t) => ({
        id: t.id,
        section: "tasks",
        title: `Tarea atrasada: ${value(t, "title")}`,
        detail: `Vencimiento: ${value(t, "due_date")}`,
      })),
    ...(data.tasks ?? [])
      .filter((t) => t.status === "SUBMITTED")
      .map((t) => ({
        id: t.id,
        section: "tasks",
        title: `Entrega pendiente de revisión: ${value(t, "title")}`,
        detail: "La evidencia requiere revisión humana.",
      })),
    ...(data.interviews ?? [])
      .filter(
        (i) =>
          i.status === "SCHEDULED" &&
          value(i, "scheduled_at").slice(0, 10) >= today,
      )
      .map((i) => ({
        id: i.id,
        section: "interviews",
        title: "Entrevista programada",
        detail: value(i, "scheduled_at"),
      })),
    ...(data.onboarding ?? [])
      .filter((o) => o.status !== "COMPLETED")
      .map((o) => ({
        id: o.id,
        section: "onboarding",
        title: "Incorporación pendiente",
        detail: "Revisa los pasos y documentos del onboarding.",
      })),
    ...(data.course_assignments ?? [])
      .filter((c) => c.status !== "COMPLETED")
      .map((c) => ({
        id: c.course_id as string,
        section: "courses",
        title: "Capacitación pendiente",
        detail: c.due_date
          ? `Fecha objetivo: ${value(c, "due_date")}`
          : "Curso asignado sin completar.",
      })),
    ...(data.applications ?? []).map((a) => ({
      id: a.id,
      section: "applications",
      title: `Postulación: ${value(a, "status")}`,
      detail: `Última actualización: ${value(a, "updated_at")}`,
    })),
    ...(data.audit_logs ?? [])
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        section: "audit",
        title: `Actividad: ${value(a, "action")}`,
        detail: `${value(a, "resource_type")} · ${value(a, "created_at")}`,
      })),
  ];
}
export function insightContext(
  data: Snapshot,
  profile: Profile,
  area: InsightArea,
  today: string,
) {
  const scoped = scopeData(data, profile);
  const tables =
    area === "courses"
      ? [
          "employees",
          "positions",
          "departments",
          "courses",
          "course_assignments",
        ]
      : ["tasks", "performance", "analytics"].includes(area)
        ? [
            "employees",
            "positions",
            "departments",
            "tasks",
            "course_assignments",
            "courses",
          ]
        : profile.role === "SUPERUSER"
          ? ["profiles", "departments", "positions", "audit_logs"]
          : profile.role === "CANDIDATO"
            ? ["candidates", "vacancies", "applications", "interviews"]
            : [
                "employees",
                "positions",
                "departments",
                "tasks",
                "courses",
                "course_assignments",
                "onboarding",
                ...(profile.role === "RH_ADMIN"
                  ? ["vacancies", "applications", "interviews"]
                  : []),
              ];
  // No enviar contraseñas, correos, rutas de archivos, CV ni documentos completos al análisis general.
  const fields = [
    "id",
    "profile_id",
    "employee_id",
    "manager_id",
    "position_id",
    "department_id",
    "course_id",
    "candidate_id",
    "vacancy_id",
    "title",
    "name",
    "role",
    "active",
    "status",
    "due_date",
    "scheduled_at",
    "hire_date",
    "description",
    "requirements",
    "skills",
    "experience_years",
    "progress",
    "duration_minutes",
    "required",
    "action",
    "resource_type",
    "created_at",
  ];
  return {
    role: profile.role,
    area,
    today,
    notice:
      "Datos limitados a 200 registros por tabla; no sacar conclusiones sobre registros ausentes.",
    data: Object.fromEntries(
      tables.map((table) => [
        table,
        (scoped[table] ?? [])
          .slice(0, 200)
          .map((row) =>
            Object.fromEntries(
              fields
                .filter((f) => row[f] !== undefined)
                .map((f) => [
                  f,
                  typeof row[f] === "string"
                    ? (row[f] as string).slice(0, 1500)
                    : row[f],
                ]),
            ),
          ),
      ]),
    ),
  };
}
