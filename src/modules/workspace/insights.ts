/**
 * @file Calcula alcance por rol, destinatarios y señales operativas sin IA. El jefe trabaja sobre
 * la jerarquía subordinada autorizada; una tarea entregada para revisión no cuenta como atraso del
 * empleado.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Señales verificables calculadas sobre datos ya autorizados, sin inventar resultados de IA. */
import { stateLabel } from "@/modules/workspace/labels";
import { filterWorkspace, type WorkspaceFilters } from "./filters";
import { isHR } from "@/lib/permissions";
import { type Profile, type Row, type Snapshot, value } from "./types";
export type InsightArea =
  "overview" | "courses" | "tasks" | "performance" | "analytics";
/** El seguimiento colectivo requiere permiso de RH o subordinados autorizados. */
export function canReviewTeamPerformance(data: Snapshot, profile: Profile) {
  return (
    isHR(profile.role) ||
    (profile.role === "JEFE" &&
      scopeData(data, profile).employees.some(
        (e) => e.profile_id !== profile.id,
      ))
  );
}
/** Compara fechas ISO; una entrega pendiente de revisión no es atraso del colaborador. */
export function overdue(task: Row, today: string) {
  return (
    !!task.due_date &&
    value(task, "due_date") < today &&
    !["APPROVED", "SUBMITTED"].includes(value(task, "status"))
  );
}
/**
 * Restringe empleados y registros relacionados antes de mostrar o enviar contexto a IA.
 * RH conserva el alcance disponible; JEFE recorre descendientes hasta un punto fijo;
 * EMPLEADO conserva lo propio. No reemplaza RLS ni recupera filas que no se cargaron.
 */
export function scopeData(data: Snapshot, profile: Profile): Snapshot {
  // Defensa adicional: ni la interfaz ni el contexto de IA dependen solo del filtro visual.
  const team = new Set(
    (data.employees ?? [])
      .filter((e) => e.profile_id === profile.id)
      .map((e) => e.id),
  );
  if (profile.role === "JEFE") {
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of data.employees ?? []) {
        if (team.has(String(e.manager_id)) && !team.has(e.id)) {
          team.add(e.id);
          changed = true;
        }
      }
    }
  }
  const employees = (data.employees ?? []).filter(
    (e) =>
      isHR(profile.role) ||
      e.profile_id === profile.id ||
      (profile.role === "JEFE" && team.has(e.id)),
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
  const onboardingIds = new Set((result.onboarding ?? []).map((o) => o.id));
  for (const table of ["onboarding_items", "onboarding_documents"])
    result[table] = (data[table] ?? []).filter((r) =>
      onboardingIds.has(String(r.onboarding_id)),
    );
  return result;
}
/** Ver tareas propias no concede permiso para asignárselas o administrarlas. */
export function taskRecipients(data: Snapshot, profile: Profile): Snapshot {
  const scoped = scopeData(data, profile);
  return {
    ...scoped,
    employees: isHR(profile.role)
      ? scoped.employees
      : profile.role === "JEFE"
        ? scoped.employees.filter((e) => e.profile_id !== profile.id)
        : [],
  };
}
/** Construye alertas deterministas sobre datos ya autorizados, con today en formato ISO. */
export function notifications(data: Snapshot, today: string) {
  return [
    ...(data.onboarding_items ?? [])
      .filter(
        (i) =>
          i.status !== "COMPLETED" &&
          value(i, "due_date") &&
          value(i, "due_date") < today &&
          (data.onboarding ?? []).some((o) => o.id === i.onboarding_id),
      )
      .map((i) => ({
        id: String(i.onboarding_id),
        section: "onboarding",
        kind: "overdue" as const,
        title: `Incorporación atrasada: ${value(i, "title")}`,
        detail: `Vencimiento: ${value(i, "due_date")}`,
      })),
    ...(data.tasks ?? [])
      .filter((t) => overdue(t, today))
      .map((t) => ({
        id: t.id,
        section: "tasks",
        kind: "overdue" as const,
        title: `Tarea atrasada: ${value(t, "title")}`,
        detail: `Vencimiento: ${value(t, "due_date")}`,
      })),
    ...(data.tasks ?? [])
      .filter((t) => t.status === "SUBMITTED")
      .map((t) => ({
        id: t.id,
        section: "tasks",
        kind: "review" as const,
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
        kind: "interview" as const,
        title: "Entrevista programada",
        detail: value(i, "scheduled_at"),
      })),
    ...(data.onboarding ?? [])
      .filter((o) => o.status !== "COMPLETED")
      .map((o) => ({
        id: o.id,
        section: "onboarding",
        kind: "onboarding" as const,
        title: "Incorporación pendiente",
        detail: "Revisa los pasos y documentos del onboarding.",
      })),
    ...(data.course_assignments ?? [])
      .filter((c) => c.status !== "COMPLETED")
      .map((c) => ({
        id: c.course_id as string,
        section: "courses",
        kind: "training" as const,
        title: c.progress_review_pending
          ? "Avance de capacitación pendiente de revisión"
          : "Capacitación pendiente",
        detail: c.progress_review_pending
          ? `${value((data.courses ?? []).find((course) => course.id === c.course_id) ?? { id: "" }, "title") || "Capacitación"} · ${value((data.profiles ?? []).find((p) => p.id === (data.employees ?? []).find((e) => e.id === c.employee_id)?.profile_id) ?? { id: "" }, "full_name") || "Colaborador"} · Avance declarado: ${Number(c.progress)}%. Revisa las evidencias y valida el porcentaje.`
          : c.due_date
            ? `Fecha objetivo: ${value(c, "due_date")}`
            : "Curso asignado sin completar.",
      })),
    ...(data.applications ?? []).map((a) => ({
      id: a.id,
      section: "applications",
      kind: "application" as const,
      title: `Postulación: ${stateLabel(value(a, "status"))}`,
      detail: `Última actualización: ${value(a, "updated_at")}`,
    })),
    ...(data.audit_logs ?? []).slice(0, 10).map((a) => ({
      id: a.id,
      section: "audit",
      kind: "audit" as const,
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
  filters: WorkspaceFilters = {},
) {
  const scoped = filterWorkspace(scopeData(data, profile), filters);
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
            ...(area === "performance"
              ? ["onboarding", "onboarding_items"]
              : []),
            ...(area === "analytics"
              ? ["vacancies", "applications", "interviews"]
              : []),
          ]
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
              "onboarding_items",
              "climate_surveys",
              "task_evidence",
              ...(isHR(profile.role) || profile.role === "EMPLEADO"
                ? ["onboarding_documents"]
                : []),
              ...(profile.role === "SUPERUSER"
                ? ["profiles", "audit_logs"]
                : []),
              ...(isHR(profile.role)
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
    "applied_at",
    "updated_at",
    "completed_at",
    "onboarding_id",
    "owner_role",
    "priority",
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
          .filter(
            (row) =>
              table !== "audit_logs" ||
              row.resource_type !== "orchestration_runs",
          )
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
