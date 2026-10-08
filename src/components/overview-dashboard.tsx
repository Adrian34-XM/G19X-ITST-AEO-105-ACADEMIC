"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  GraduationCap,
  Layers3,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  value,
  type Profile,
  type Row,
  type Snapshot,
} from "@/modules/workspace/types";
import { isHR } from "@/lib/permissions";
import { stateLabel } from "@/modules/workspace/labels";
import { sortTasks } from "@/modules/workspace/tasks";
import { performance } from "@/modules/performance/service";
import { OperationsPanel } from "./operations-panels";
import { ClimateOverviewPanel } from "./climate-overview";

type Entry = { key: string; label: string; href: string };
type Indicator = {
  label: string;
  count: number;
  detail: string;
  module: string;
  icon: LucideIcon;
};
const shortcutCopy: Record<string, string> = {
  applications: "Da seguimiento a las candidaturas",
  employees: "Consulta personas y estructura",
  onboarding: "Acompaña las incorporaciones",
  tasks: "Organiza entregas y pendientes",
  courses: "Continúa la capacitación",
  users: "Administra cuentas y accesos",
  audit: "Consulta la actividad registrada",
  profile: "Mantén tu información al día",
  jobs: "Encuentra tu próxima oportunidad",
};
const shortcutIcons: Record<string, LucideIcon> = {
  applications: BriefcaseBusiness,
  employees: Users,
  onboarding: Layers3,
  tasks: ClipboardList,
  courses: GraduationCap,
  users: Users,
  audit: CheckCheck,
  profile: Users,
  jobs: BriefcaseBusiness,
};

function Status({ status }: { status: string }) {
  const tone = ["APPROVED", "COMPLETED", "CONTRATADO"].includes(status)
    ? "green"
    : ["REJECTED", "RECHAZADO"].includes(status)
      ? "red"
      : "";
  return <span className={`badge ${tone}`}>{stateLabel(status)}</span>;
}

function dueDate(task: Row) {
  const date = value(task, "due_date");
  if (!date) return "Sin fecha límite";
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? "Sin fecha válida"
    : `Vence el ${parsed.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`;
}

/** Resumen visual sobre el mismo conjunto autorizado que utiliza el espacio de trabajo. */
export function OverviewDashboard({
  data,
  profile,
  tasks,
  courses,
  shortcuts,
  href,
}: {
  data: Snapshot;
  profile: Profile;
  tasks: Row[];
  courses: Row[];
  shortcuts: Entry[];
  href: (module: string) => string;
}) {
  const candidate = profile.role === "CANDIDATO";
  const admin = profile.role === "SUPERUSER";
  const employee = profile.role === "EMPLEADO";
  const hr = isHR(profile.role);
  const rows = (table: string) => data[table] ?? [];
  const find = (table: string, id: unknown) =>
    rows(table).find((r) => r.id === id) ?? { id: "" };
  const pending = tasks.filter(
    (t) => !["APPROVED", "SUBMITTED"].includes(value(t, "status")),
  );
  const review = tasks.filter((t) => t.status === "SUBMITTED");
  const [taskView, setTaskView] = useState<"pending" | "review">(
    !employee && review.length ? "review" : "pending",
  );
  const visibleTasks = sortTasks(taskView === "review" ? review : pending);
  const metrics = performance(
    tasks.map((t) => ({ status: value(t, "status") })),
    courses.map((c) => ({ status: value(c, "status") })),
  );
  const completedCourses = courses.filter(
    (c) => c.status === "COMPLETED",
  ).length;
  const approvedTasks = tasks.filter((t) => t.status === "APPROVED").length;
  const interviews = rows("interviews")
    .filter((i) => i.status === "SCHEDULED")
    .sort((a, b) =>
      value(a, "scheduled_at").localeCompare(value(b, "scheduled_at")),
    );
  const indicators: Indicator[] = candidate
    ? [
        {
          label: "Mis postulaciones",
          count: rows("applications").length,
          detail: "Consulta el estado de cada candidatura",
          module: "applications",
          icon: ClipboardList,
        },
        {
          label: "Entrevistas agendadas",
          count: interviews.length,
          detail: "Revisa las fechas y los detalles",
          module: "interviews",
          icon: CalendarDays,
        },
        {
          label: "Oportunidades abiertas",
          count: rows("vacancies").filter((v) => v.status === "PUBLISHED")
            .length,
          detail: "Vacantes disponibles para postularte",
          module: "jobs",
          icon: BriefcaseBusiness,
        },
      ]
    : admin
      ? [
          {
            label: "Usuarios",
            count: rows("profiles").length,
            detail: "Cuentas registradas en el sistema",
            module: "users",
            icon: Users,
          },
          {
            label: "Áreas",
            count: rows("departments").length,
            detail: "Estructura de la organización",
            module: "departments",
            icon: Layers3,
          },
          {
            label: "Puestos",
            count: rows("positions").length,
            detail: "Roles dentro de cada área",
            module: "positions",
            icon: BriefcaseBusiness,
          },
        ]
      : employee
        ? [
            {
              label: "Tareas por completar",
              count: pending.length,
              detail: "Tus actividades pendientes",
              module: "tasks",
              icon: ClipboardList,
            },
            {
              label: "Entregas en revisión",
              count: review.length,
              detail: "A la espera de validación",
              module: "tasks",
              icon: CheckCheck,
            },
            {
              label: "Cursos por completar",
              count: courses.length - completedCourses,
              detail: "Continúa con tu aprendizaje",
              module: "courses",
              icon: GraduationCap,
            },
          ]
        : [
            {
              label: "Personas activas",
              count: rows("employees").filter((e) => e.status === "ACTIVE")
                .length,
              detail: "Dentro de tu ámbito de acceso",
              module: "employees",
              icon: Users,
            },
            hr
              ? {
                  label: "Vacantes publicadas",
                  count: rows("vacancies").filter(
                    (v) => v.status === "PUBLISHED",
                  ).length,
                  detail: "Oportunidades de contratación",
                  module: "vacancies",
                  icon: BriefcaseBusiness,
                }
              : {
                  label: "Cursos por completar",
                  count: courses.length - completedCourses,
                  detail: "Capacitaciones del equipo pendientes",
                  module: "courses",
                  icon: GraduationCap,
                },
            {
              label: "Tareas por completar",
              count: pending.length,
              detail: "Actividades del equipo pendientes",
              module: "tasks",
              icon: ClipboardList,
            },
            {
              label: "Entregas por revisar",
              count: review.length,
              detail: "Requieren validación humana",
              module: "tasks",
              icon: CheckCheck,
            },
          ];
  const primary = candidate ? "jobs" : admin ? "users" : "tasks";
  const primaryLabel = candidate
    ? "Explorar vacantes"
    : admin
      ? "Administrar usuarios"
      : employee
        ? "Ver mis tareas"
        : "Revisar tareas";
  const secondary = candidate
    ? "profile"
    : admin
      ? "audit"
      : employee
        ? "courses"
        : "employees";
  const secondaryLabel = candidate
    ? "Completar mi perfil"
    : admin
      ? "Ver auditoría"
      : employee
        ? "Mi capacitación"
        : "Ver equipo";

  return (
    <div className="overview-dashboard">
      <section
        className="overview-welcome"
        aria-labelledby="overview-welcome-title"
      >
        <div>
          <span className="eyebrow">TU ESPACIO, DE UN VISTAZO</span>
          <h2 id="overview-welcome-title">
            {candidate
              ? "Da el siguiente paso en tu carrera"
              : admin
                ? "Todo listo para organizar tu espacio"
                : employee
                  ? "Enfócate en tu siguiente paso"
                  : "Lo importante de tu equipo, a la mano"}
          </h2>
          <p>
            {candidate
              ? "Sigue tus postulaciones, prepara tu perfil y descubre nuevas oportunidades."
              : admin
                ? "Gestiona accesos, estructura y actividad desde un solo lugar."
                : employee
                  ? "Revisa tus entregas y continúa aprendiendo, sin perder de vista tus pendientes."
                  : "Revisa entregas, acompaña las incorporaciones y da seguimiento al trabajo."}
          </p>
          <div className="overview-welcome-actions">
            <Link className="button" href={href(primary)}>
              {primaryLabel}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link className="overview-text-link" href={href(secondary)}>
              {secondaryLabel}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <span className="overview-welcome-symbol" aria-hidden="true">
          <Layers3 size={46} strokeWidth={1.3} />
        </span>
      </section>

      <div
        className="overview-indicators"
        aria-label="Indicadores de tu espacio"
      >
        {indicators.map(({ label, count, detail, module, icon: Icon }, i) => (
          <Link
            className={`overview-indicator overview-tone-${i}`}
            href={href(module)}
            key={label}
          >
            <div>
              <span className="overview-indicator-icon">
                <Icon size={20} aria-hidden="true" />
              </span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </div>
            <strong>{count}</strong>
            <span>{label}</span>
            <small>{detail}</small>
          </Link>
        ))}
      </div>

      <nav className="overview-shortcuts" aria-label="Accesos rápidos">
        {shortcuts.map((entry) => {
          const Icon = shortcutIcons[entry.key] ?? ClipboardList;
          return (
            <Link href={entry.href} key={entry.key}>
              <span className="shortcut-icon">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span>
                <strong>{entry.label}</strong>
                <small>{shortcutCopy[entry.key]}</small>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>

      <div className="overview-columns">
        <div className="overview-main">
          <section
            className="panel overview-attention"
            aria-labelledby="overview-attention-title"
          >
            <div className="section-head">
              <div>
                <span className="eyebrow">
                  {candidate ? "TU SEGUIMIENTO" : "PRÓXIMOS PASOS"}
                </span>
                <h2 id="overview-attention-title">
                  {candidate
                    ? "Mis postulaciones"
                    : employee
                      ? "Mis tareas"
                      : "Por atender"}
                </h2>
              </div>
              <Link href={href(candidate ? "applications" : "tasks")}>
                Ver todas <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
            {candidate ? (
              <div className="overview-task-list">
                {rows("applications")
                  .slice(0, 5)
                  .map((a) => (
                    <Link
                      className="overview-task"
                      key={a.id}
                      href={href("applications")}
                    >
                      <span>
                        <strong>
                          {value(find("vacancies", a.vacancy_id), "title") ||
                            "Postulación"}
                        </strong>
                        <small>Consulta los detalles de tu candidatura</small>
                      </span>
                      <Status status={value(a, "status")} />
                    </Link>
                  ))}
                {!rows("applications").length && (
                  <div className="overview-empty">
                    <BriefcaseBusiness size={28} aria-hidden="true" />
                    <strong>Tu próxima oportunidad te espera</strong>
                    <p>Explora las vacantes y envía tu primera postulación.</p>
                    <Link href={href("jobs")}>Explorar vacantes ↗</Link>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div
                  className="overview-task-tabs"
                  role="group"
                  aria-label="Filtrar tareas de la vista general"
                >
                  <button
                    type="button"
                    aria-pressed={taskView === "pending"}
                    onClick={() => setTaskView("pending")}
                  >
                    Por completar <span>{pending.length}</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={taskView === "review"}
                    onClick={() => setTaskView("review")}
                  >
                    {employee ? "En revisión" : "Por revisar"}{" "}
                    <span>{review.length}</span>
                  </button>
                </div>
                <p className="overview-list-caption">
                  {taskView === "review"
                    ? employee
                      ? "Entregas que ya enviaste para validación."
                      : "Entregas listas para que revises su evidencia."
                    : "Primero las prioridades altas; después, la fecha límite más cercana."}
                </p>
                <div className="overview-task-list">
                  {visibleTasks.slice(0, 5).map((task) => {
                    const person = find("employees", task.employee_id);
                    const position = find("positions", person.position_id);
                    const area = value(
                      find("departments", position.department_id),
                      "name",
                    );
                    return (
                      <Link
                        className="overview-task"
                        key={task.id}
                        href={`${href("tasks")}/${task.id}`}
                      >
                        <span>
                          <strong>
                            {value(task, "title") || "Tarea pendiente"}
                          </strong>
                          <small>
                            {!employee &&
                              `${value(find("profiles", person.profile_id), "full_name") || "Integrante"}${area ? ` · ${area}` : ""} · `}
                            {dueDate(task)}
                          </small>
                          <span className="overview-task-priority">
                            Prioridad{" "}
                            {stateLabel(value(task, "priority")).toLowerCase()}
                          </span>
                        </span>
                        <Status status={value(task, "status")} />
                      </Link>
                    );
                  })}
                  {!visibleTasks.length && (
                    <div className="overview-empty">
                      <CheckCheck size={28} aria-hidden="true" />
                      <strong>
                        {taskView === "review"
                          ? "Sin entregas por revisar"
                          : "Sin tareas por completar"}
                      </strong>
                      <p>
                        {taskView === "review"
                          ? "Las próximas entregas aparecerán aquí."
                          : "Puedes consultar las actividades aprobadas en el módulo de tareas."}
                      </p>
                    </div>
                  )}
                </div>
                {visibleTasks.length > 5 && (
                  <div className="overview-list-footer">
                    <span>Mostrando 5 de {visibleTasks.length}</span>
                    <Link href={href("tasks")}>Abrir todas las tareas ↗</Link>
                  </div>
                )}
              </>
            )}
          </section>

          <section
            className="panel overview-development"
            aria-labelledby="overview-development-title"
          >
            <span className="overview-development-icon">
              <GraduationCap size={24} aria-hidden="true" />
            </span>
            <div>
              <span className="eyebrow">
                {admin
                  ? "ESTRUCTURA"
                  : candidate
                    ? "TU PERFIL"
                    : "AVANCE REGISTRADO"}
              </span>
              <h2 id="overview-development-title">
                {candidate
                  ? "Haz visible tu experiencia"
                  : admin
                    ? "Una organización bien conectada"
                    : "Aprendizaje y entregas"}
              </h2>
              <p>
                {candidate
                  ? "Agrega tus habilidades, experiencia y CV para que RH conozca tu trayectoria."
                  : admin
                    ? "Revisa las áreas y los puestos que dan forma a tu organización."
                    : "Avance de las actividades cargadas en tu espacio. Cada proceso se cuenta por separado."}
              </p>
              {!candidate && !admin && (
                <div className="overview-progress-grid">
                  {[
                    {
                      label: "Capacitaciones completadas",
                      completed: completedCourses,
                      total: courses.length,
                      percentage: metrics.course_completion,
                    },
                    {
                      label: "Tareas aprobadas",
                      completed: approvedTasks,
                      total: tasks.length,
                      percentage: metrics.task_completion,
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="progress-label">
                        <span>{item.label}</span>
                        <strong>
                          {item.total ? `${Math.round(item.percentage)}%` : "—"}
                        </strong>
                      </div>
                      <progress
                        aria-label={item.label}
                        max={100}
                        value={item.percentage}
                      />
                      <small>
                        {item.total
                          ? `${item.completed} de ${item.total}`
                          : "Sin actividades registradas"}
                      </small>
                    </div>
                  ))}
                </div>
              )}
              <Link
                className="overview-text-link"
                href={href(
                  candidate ? "profile" : admin ? "departments" : "courses",
                )}
              >
                {candidate
                  ? "Editar mi perfil"
                  : admin
                    ? "Revisar estructura"
                    : "Ver capacitación"}
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </section>

          {hr && <ClimateOverviewPanel profile={profile} />}
          {(hr || candidate) && (
            <section
              className="panel overview-agenda"
              aria-labelledby="overview-agenda-title"
            >
              <div className="section-head">
                <div>
                  <span className="eyebrow">AGENDA</span>
                  <h2 id="overview-agenda-title">Entrevistas agendadas</h2>
                </div>
                <Link href={href("interviews")}>Ver agenda ↗</Link>
              </div>
              {interviews.slice(0, 3).map((interview) => (
                <Link
                  className="overview-agenda-item"
                  key={interview.id}
                  href={href("interviews")}
                >
                  <CalendarDays size={20} aria-hidden="true" />
                  <span>
                    <strong>
                      {value(
                        find(
                          "vacancies",
                          find("applications", interview.application_id)
                            .vacancy_id,
                        ),
                        "title",
                      ) || "Entrevista"}
                    </strong>
                    <small>
                      {value(interview, "scheduled_at")
                        ? new Date(
                            value(interview, "scheduled_at"),
                          ).toLocaleString("es-MX", {
                            timeZone: "America/Mexico_City",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Consulta la fecha en la agenda"}
                    </small>
                  </span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              ))}
              {!interviews.length && (
                <p className="muted">
                  No hay entrevistas agendadas en los datos disponibles.
                </p>
              )}
            </section>
          )}
        </div>
        {!candidate && (
          <aside
            className="overview-insights"
            aria-label="Resumen de novedades y notificaciones"
          >
            <OperationsPanel
              data={data}
              profile={profile}
              area="overview"
              compact
            />
          </aside>
        )}
      </div>
    </div>
  );
}
