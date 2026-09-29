/**
 * @file Construye el contexto minimizado de novedades y convierte referencias técnicas en nombres
 * legibles. Describe el estado disponible y registros recientes, no un historial completo de
 * cambios desde la última visita.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Señales del orquestador sobre registros autorizados; no interpreta cambios sin evidencia temporal. */
import type { Profile, Snapshot } from "./types";
import { insightContext, notifications, scopeData, overdue } from "./insights";
import { labels } from "./labels";

const processNames: Record<string, string> = {
  onboarding_items: "actividades de incorporación",
  onboarding_documents: "documentos de incorporación",
  onboarding: "incorporación",
  course_assignments: "capacitaciones asignadas",
  course_evidence: "evidencias de capacitación",
  courses: "capacitaciones",
  task_evidence: "evidencias de tareas",
  task_messages: "mensajes de tareas",
  tasks: "tareas",
  climate_surveys: "encuestas de ambiente laboral",
  climate_answers: "respuestas de encuestas",
  applications: "postulaciones",
  interviews: "entrevistas",
  vacancies: "vacantes",
  employees: "colaboradores",
  departments: "áreas",
  positions: "puestos",
  profiles: "perfiles",
  audit_logs: "actividad de la plataforma",
};

/** Sustituye referencias técnicas solo con títulos del contexto autorizado, nunca con datos ajenos. */
export function readableOverview(
  text: string,
  data: Record<string, Record<string, unknown>[]>,
): string {
  const names = new Map<string, string>();
  for (const rows of Object.values(data))
    for (const row of rows) {
      const name = String(row.title || row.name || "");
      if (name && typeof row.id === "string")
        names.set(row.id.toLowerCase(), name);
    }
  const uuid =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  // Los códigos nunca se presentan al usuario, incluso si el modelo ignora el prompt.
  const readable = text
    .replace(/\\_/g, "_")
    .replace(/\b[a-z]+(?:_[a-z]+)*\b/g, (token) => processNames[token] ?? token)
    .replace(
      /\b[A-Z]+(?:_[A-Z]+)*\b/g,
      (token) => labels[token]?.toLocaleLowerCase("es") ?? token,
    )
    .replace(/[`*]/g, "")
    .replace(
      /['"](pendiente|completado|en progreso|en revisión|abierta|cerrada|asignado|aprobado|rechazado)['"]/g,
      "$1",
    );
  return readable
    .replace(/\b(?:con\s+)?ID\s*:?\s*(?=[0-9a-f]{8}-)/gi, "")
    .replace(
      uuid,
      (id) => names.get(id.toLowerCase()) || "el registro correspondiente",
    )
    .replace(uuid, "referencia interna");
}
export function overviewContext(
  data: Snapshot,
  profile: Profile,
  today: string,
) {
  const scoped = scopeData(data, profile);
  const context = insightContext(scoped, profile, "overview", today);
  const safe = new Set([
    "id",
    "title",
    "name",
    "employee_id",
    "position_id",
    "department_id",
    "course_id",
    "candidate_id",
    "vacancy_id",
    "onboarding_id",
    "status",
    "priority",
    "due_date",
    "scheduled_at",
    "hire_date",
    "progress",
    "progress_review_pending",
    "approved_progress",
    "created_at",
    "updated_at",
    "completed_at",
    "applied_at",
    "owner_role",
    "active",
    "role",
    "action",
    "resource_type",
  ]);
  for (const table of Object.keys(context.data))
    context.data[table] = context.data[table].map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(([field]) => safe.has(field)),
      ),
    );
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);
  const recent = Object.entries(context.data)
    .flatMap(([table, rows]) =>
      rows.flatMap((row) => {
        const date = String(
          row.updated_at ??
            row.completed_at ??
            row.created_at ??
            row.applied_at ??
            "",
        );
        return date >= cutoff.toISOString()
          ? [
              {
                section: table,
                id: row.id,
                status: row.status,
                date,
                event: row.updated_at
                  ? "última actualización disponible"
                  : "registro o finalización disponible",
              },
            ]
          : [];
      }),
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 100);
  return {
    ...context,
    // Se agrupan únicamente filas del contexto autorizado y acotado que recibe el modelo.
    areas: (context.data.departments ?? []).flatMap((department) => {
      const positions = new Set(
        (context.data.positions ?? [])
          .filter((p) => p.department_id === department.id)
          .map((p) => p.id),
      );
      const employees = new Set(
        (context.data.employees ?? [])
          .filter((e) => positions.has(String(e.position_id)))
          .map((e) => e.id),
      );
      const tasks = (context.data.tasks ?? []).filter((t) =>
        employees.has(String(t.employee_id)),
      );
      const courses = (context.data.course_assignments ?? []).filter((c) =>
        employees.has(String(c.employee_id)),
      );
      const onboarding = (context.data.onboarding ?? []).filter((o) =>
        employees.has(String(o.employee_id)),
      );
      const vacancies = (context.data.vacancies ?? []).filter((v) =>
        positions.has(String(v.position_id)),
      );
      if (!employees.size && !vacancies.length) return [];
      return [
        {
          name: String(department.name || "Área sin nombre"),
          people: employees.size,
          overdue_tasks: tasks.filter((t) =>
            overdue({ ...t, id: String(t.id) }, today),
          ).length,
          tasks_awaiting_review: tasks.filter((t) => t.status === "SUBMITTED")
            .length,
          approved_tasks: tasks.filter((t) => t.status === "APPROVED").length,
          pending_training: courses.filter((c) => c.status !== "COMPLETED")
            .length,
          completed_training: courses.filter((c) => c.status === "COMPLETED")
            .length,
          active_onboarding: onboarding.filter((o) => o.status !== "COMPLETED")
            .length,
          completed_onboarding: onboarding.filter(
            (o) => o.status === "COMPLETED",
          ).length,
          published_vacancies: vacancies.filter((v) => v.status === "PUBLISHED")
            .length,
        },
      ];
    }),
    scope:
      profile.role === "CANDIDATO"
        ? "Solo tus postulaciones, entrevistas y vacantes visibles"
        : profile.role === "JEFE"
          ? "Tu jerarquía autorizada y tus propios registros"
          : profile.role === "EMPLEADO"
            ? "Tus actividades y procesos personales"
            : "Áreas autorizadas de la organización",
    notifications: notifications(scoped, today)
      .filter((n) => n.section !== "audit")
      .slice(0, 100)
      .map((n) => ({ id: n.id, section: n.section, kind: n.kind })),
    totals: Object.fromEntries(
      Object.entries(context.data).map(([table, rows]) => [
        table,
        {
          loaded: rows.length,
          by_status: rows.reduce<Record<string, number>>((acc, row) => {
            const s = String(row.status ?? "SIN_ESTADO");
            acc[s] = (acc[s] ?? 0) + 1;
            return acc;
          }, {}),
        },
      ]),
    ),
    recent,
    limitations:
      "Estado actual de los registros cargados y señales con fecha de los últimos siete días. No es un historial completo de cambios. No inferir estados anteriores ni cambios desde la última visita. Máximo 200 registros por módulo y 100 señales. No se analizan documentos, evidencias completas ni comentarios privados.",
  };
}
