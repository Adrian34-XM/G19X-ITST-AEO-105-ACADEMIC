"use client";
import { canEditStaff } from "@/modules/workspace/organization";
/**
 * Interfaz principal por rol: navegación, listados, formularios y acciones de RRHH. Recibe datos filtrados por RLS; los botones no sustituyen los controles del servidor. Tras escribir, refresca los datos desde Next.js.
 */
import {
  filterWorkspace,
  type WorkspaceFilters,
} from "@/modules/workspace/filters";
import { InterviewCalendar } from "./interview-calendar";
import { VacancyDocuments } from "./vacancy-documents";
import { VacancyAssistant } from "./vacancy-assistant";
import { ModuleFilterBar } from "./module-filter-bar";
import { OnboardingPanel } from "./onboarding-panel";
import { EmployeePicker } from "./employee-picker";
import { labels, stateLabel } from "@/modules/workspace/labels";
import { sortTasks } from "@/modules/workspace/tasks";
import { TrainingResources, TrainingEvidence } from "./training-evidence";
import { HireCandidate, HiringAssignmentNotices } from "./hire-candidate";
import { BulkAssignment } from "./bulk-assignment";
import { EmployeeProfile } from "./employee-profile";
import { isHR } from "@/lib/permissions";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BriefcaseBusiness,
  Users,
  CalendarDays,
  BookOpen,
  CheckSquare,
  ClipboardList,
  ChartNoAxesCombined,
  ShieldCheck,
  LogOut,
  Search,
  Plus,
  ArrowUpRight,
  Menu,
} from "lucide-react";
import { EditForm, Upload, request, type FormSpec } from "./forms";
import {
  WorkforceAI,
  TrainingAssistant,
  StaffEnrollment,
  TrainingProgress,
} from "./workforce-tools";
import { applicationSections } from "@/modules/workspace/application-sections";
import { ApplicationSummary, rankApplications } from "./application-summary";
import { WorkplaceClimate } from "./workplace-climate";
import {
  OperationsPanel,
  TeamTree,
  AnalyticsCharts,
  AuditPanel,
} from "./operations-panels";
import {
  scopeData,
  overdue,
  taskRecipients,
} from "@/modules/workspace/insights";
import { formFor } from "@/modules/workspace/forms";
import {
  value,
  type Snapshot,
  type Row,
  type Profile,
} from "@/modules/workspace/types";
import { performance } from "@/modules/performance/service";
import { applicationTransitions, home } from "@/lib/permissions";
const titles: Record<string, string> = {
  overview: "Vista general",
  vacancies: "Vacantes",
  applications: "Postulaciones",
  recommendations: "Recomendaciones IA",
  climate: "Ambiente laboral",
  candidates: "Candidatos",
  interviews: "Entrevistas",
  employees: "Equipo",
  onboarding: "Onboarding",
  courses: "Capacitación",
  tasks: "Tareas y evidencias",
  performance: "Desempeño",
  analytics: "Analíticas",
  audit: "Auditoría",
  users: "Usuarios",
  positions: "Puestos",
  departments: "Áreas",
  profile: "Mi perfil",
  jobs: "Oportunidades abiertas",
};

function Badge({ status }: { status: string }) {
  return (
    <span
      className={
        "badge " +
        ([
          "APPROVED",
          "COMPLETED",
          "ACTIVE",
          "PUBLISHED",
          "CONTRATADO",
          "GREEN",
        ].includes(status)
          ? "green"
          : ["REJECTED", "RECHAZADO", "RED", "INACTIVE"].includes(status)
            ? "red"
            : "")
      }
    >
      {stateLabel(status)}
    </span>
  );
}
function AIResult({ result }: { result: unknown }) {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  return (
    <section className="ai-result">
      <span className="eyebrow">✧ RECOMENDACIÓN IA · REVISIÓN HUMANA</span>
      {typeof r.score === "number" && (
        <h3>
          {r.score}/100 · {String(r.match_level)}
        </h3>
      )}
      {r.status != null && <Badge status={String(r.status)} />}
      <p>{String(r.summary ?? r.reason ?? "")}</p>
      {["strengths", "gaps", "observations"].map(
        (key) =>
          Array.isArray(r[key]) && (
            <p key={key}>
              <strong>
                {key === "strengths"
                  ? "Fortalezas"
                  : key === "gaps"
                    ? "Brechas"
                    : "Observaciones"}
                :
              </strong>{" "}
              {(r[key] as string[]).join(" · ")}
            </p>
          ),
      )}
      {typeof r.confidence === "number" && (
        <small>
          Confianza declarada por el modelo: {Math.round(r.confidence * 100)}%
        </small>
      )}
    </section>
  );
}
export function Workspace({
  data: rawData,
  path,
  profile,
}: {
  data: Snapshot;
  path: string[];
  profile: Profile | null;
}) {
  const [assignment, setAssignment] = useState<{ course?: string } | null>(
    null,
  );
  const [filters, setFilters] = useState<WorkspaceFilters>({});
  const [reportTab, setReportTab] = useState("summary");
  const [interviewSection, setInterviewSection] = useState("SCHEDULED");
  const [courseSection, setCourseSection] = useState("catalog");
  const [reportFiltersOpen, setReportFiltersOpen] = useState(false);
  const [taskSection, setTaskSection] = useState("active");
  const taskHistory = taskSection === "history";
  const taskMatches = (t: Row) =>
    taskSection === "history"
      ? t.status === "APPROVED"
      : taskSection === "review"
        ? t.status === "SUBMITTED"
        : !["APPROVED", "SUBMITTED"].includes(value(t, "status"));
  const [applicationStatus, setApplicationStatus] = useState("POSTULADO");
  const authorized = profile ? scopeData(rawData, profile) : rawData;
  const filterable = [
    "onboarding",
    "tasks",
    "performance",
    "analytics",
    "employees",
    "vacancies",
    "applications",
    "interviews",
    "positions",
    "courses",
  ].includes(path[1] ?? "");
  const activeFilters: WorkspaceFilters = filterable
    ? {
        department:
          profile && isHR(profile.role) ? filters.department : undefined,
        ...(path[1] === "tasks" ? { employees: filters.employees } : {}),
        ...(["performance", "analytics", "courses", "onboarding"].includes(
          path[1],
        )
          ? { employee: filters.employee }
          : {}),
        ...(path[1] === "analytics"
          ? { days: filters.days, process: filters.process }
          : {}),
      }
    : {};
  Object.assign(activeFilters, {
    module: path[0] === "jobs" ? "jobs" : path[1],
    state: filters.state,
    priority: filters.priority,
    from: filters.from,
    to: filters.to,
    position: filters.position,
    role: filters.role,
    required: filters.required,
    overdue: filters.overdue,
    query: filters.query,
  });
  const data =
    path[1] === "interviews"
      ? authorized
      : filterWorkspace(authorized, activeFilters);
  const changeFilters = (next: WorkspaceFilters) => setFilters(next);
  const router = useRouter();
  const [search, setSearch] = useState(""),
    [applicationVacancy, setApplicationVacancy] = useState(""),
    [spec, setSpec] = useState<FormSpec | null>(() =>
      path[2] === "new" && path[1] === "vacancies" && isHR(profile?.role)
        ? formFor("vacancies", data)
        : null,
    ),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false);
  const root = path[0] ?? "jobs",
    view = root === "jobs" ? "jobs" : (path[1] ?? "overview"),
    detail =
      path[0] === "jobs" ? path[1] : path[2] === "new" ? undefined : path[2];
  const hr = isHR(profile?.role),
    manager = profile?.role === "JEFE",
    admin = profile?.role === "SUPERUSER",
    candidate = profile?.role === "CANDIDATO";
  const rows = (table: string) => data[table] ?? [];
  const find = (table: string, id: unknown) =>
    (authorized[table] ?? []).find((r) => r.id === id) ?? { id: "" };
  const name = (id: unknown) =>
    value(find("profiles", id), "full_name") || "Persona";
  const employeeName = (id: unknown) => name(find("employees", id).profile_id);
  const refresh = () => {
    router.refresh();
    setNotice("Cambios guardados.");
  };
  const edit = (kind: string, row?: Row) => {
    if (kind === "assignment") {
      setAssignment({ course: row?.id });
      return;
    }
    if (kind === "tasks" && !row?.id) {
      setAssignment({});
      return;
    }
    setSpec(
      formFor(
        kind,
        kind === "tasks" && profile
          ? taskRecipients(authorized, profile)
          : data,
        row,
      ),
    );
  };
  async function act(op: string, payload: Record<string, unknown>) {
    setBusy(true);
    setNotice("");
    try {
      await request("/api/commands", { op, payload });
      refresh();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setBusy(false);
    }
  }
  async function analyze(kind: string, id: string) {
    setBusy(true);
    setNotice("Analizando la información autorizada…");
    try {
      await request("/api/ai/" + kind, { id });
      refresh();
      setNotice(
        "Análisis disponible. Revisa la recomendación antes de decidir.",
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "No se pudo analizar.");
    } finally {
      setBusy(false);
    }
  }
  async function openFile(bucket: string, id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/files?bucket=${bucket}&id=${id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Archivo no disponible.");
    } finally {
      setBusy(false);
    }
  }
  const nav = admin
    ? [
        "overview",
        "users",
        "departments",
        "positions",
        "vacancies",
        "applications",
        "interviews",
        "employees",
        "onboarding",
        "courses",
        "tasks",
        "performance",
        "analytics",
        "climate",
        "audit",
      ]
    : candidate
      ? ["overview", "jobs", "applications", "interviews", "profile"]
      : hr
        ? [
            "overview",
            "vacancies",
            "applications",
            "interviews",
            "employees",
            "onboarding",
            "courses",
            "tasks",
            "performance",
            "analytics",
            "climate",
          ]
        : manager
          ? [
              "overview",
              "onboarding",
              "employees",
              "tasks",
              "courses",
              "performance",
              "climate",
            ]
          : [
              "overview",
              "onboarding",
              "courses",
              "tasks",
              "performance",
              "climate",
              "profile",
            ];
  const icons = [
    LayoutDashboard,
    BriefcaseBusiness,
    Users,
    CalendarDays,
    ClipboardList,
    BookOpen,
    CheckSquare,
    ChartNoAxesCombined,
    ShieldCheck,
  ];
  const href = (key: string) =>
    key === "jobs"
      ? "/jobs"
      : key === "overview"
        ? profile
          ? home[profile.role]
          : "/jobs"
        : `${profile ? home[profile.role] : "/jobs"}/${key}`;
  const filtered = (table: string) =>
    rows(table).filter(
      (r) =>
        (!detail || r.id === detail) &&
        (!search ||
          [
            ...Object.values(r),
            name(r.profile_id),
            employeeName(r.employee_id),
            name(find("candidates", r.candidate_id).profile_id),
            value(find("vacancies", r.vacancy_id), "title"),
          ]
            .filter((x) => typeof x === "string" || Array.isArray(x))
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase())),
    );
  const mine = rows("employees").find((e) => e.profile_id === profile?.id);
  const scopedTasks = rows("tasks").filter(
      (t) => hr || manager || t.employee_id === mine?.id,
    ),
    scopedCourses = rows("course_assignments").filter(
      (c) => hr || manager || c.employee_id === mine?.id,
    );
  const metrics = performance(
    scopedTasks.map((t) => ({ status: value(t, "status") })),
    scopedCourses.map((c) => ({ status: value(c, "status") })),
  );
  const newKind: Record<string, string> = {
    vacancies: "vacancies",
    interviews: "interviews",
    courses: "courses",
    tasks: "tasks",
    users: "users",
    positions: "positions",
    departments: "departments",
  };
  const canCreate =
    (hr && ["vacancies", "interviews", "courses", "tasks"].includes(view)) ||
    (manager && view === "tasks") ||
    (admin && ["users", "positions", "departments"].includes(view));
  const tableView =
    view === "users" ? "profiles" : view === "audit" ? "audit_logs" : view;
  const tableRows = filtered(tableView).filter(
    (row) =>
      view !== "applications" ||
      !hr ||
      !applicationVacancy ||
      row.vacancy_id === applicationVacancy,
  );
  // El historial conserva el registro original y respeta búsqueda, vacante y permisos.
  const applicationRows = rankApplications(
    detail
      ? tableRows
      : tableRows.filter((a) => a.status === applicationStatus),
  );
  function vacancyCard(v: Row) {
    return (
      <article className="record" key={v.id}>
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {value(find("positions", v.position_id), "name") ||
                "ÚNETE AL EQUIPO"}
            </span>
            <h3>{value(v, "title")}</h3>
          </div>
          <Badge status={value(v, "status")} />
        </div>
        <p>{value(v, "description")}</p>
        <div className="chips">
          {(Array.isArray(v.skills) ? v.skills : []).map((s, i) => (
            <span className="chip" key={i}>
              {String(s)}
            </span>
          ))}
        </div>
        <p>
          <strong>Requisitos:</strong> {value(v, "requirements")}
        </p>
        <small>{value(v, "experience_required")} años de experiencia</small>
        {hr && <VacancyDocuments vacancy={v.id} />}
        <div className="actions">
          {hr ? (
            <>
              <Link
                className="ai-button"
                href={`${home[profile!.role]}/applications`}
              >
                ✧ Ver postulantes recomendados
              </Link>
              <button
                className="secondary"
                onClick={() => edit("vacancies", v)}
              >
                Editar
              </button>
              <button
                className="quiet"
                onClick={() => {
                  if (
                    window.confirm(
                      "Eliminar esta vacante sin postulaciones. Esta acción no se puede deshacer.",
                    )
                  )
                    void act("vacancy.delete", { id: v.id });
                }}
              >
                Eliminar
              </button>
            </>
          ) : (
            <button
              disabled={busy}
              onClick={() =>
                profile
                  ? act("application.create", { vacancy_id: v.id })
                  : router.push("/login")
              }
            >
              Postularme <ArrowUpRight size={16} />
            </button>
          )}
        </div>
      </article>
    );
  }
  function taskCard(t: Row) {
    const own = mine?.id === t.employee_id;
    const canManage =
      hr ||
      (manager &&
        taskRecipients(authorized, profile!).employees.some(
          (e) => e.id === t.employee_id,
        ));
    return (
      <article
        className="record task-priority-card"
        data-priority={value(t, "priority")}
        key={t.id}
      >
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {employeeName(t.employee_id)} · {labels[value(t, "priority")]}
            </span>
            <h3>{value(t, "title")}</h3>
          </div>
          <Badge status={value(t, "status")} />
        </div>
        <small>Fecha límite: {value(t, "due_date")}</small>
        <details open={!!detail}>
          <summary>Ver instrucciones, entrega y revisión</summary>
          <p>{value(t, "description")}</p>
          {t.status === "APPROVED" && (
            <p className="muted">
              Tarea aprobada · Conservada en el historial con sus evidencias y
              comentarios.
            </p>
          )}
          {Boolean(t.comments) &&
            ((
              <p>
                <strong>Revisión:</strong> {value(t, "comments")}
              </p>
            ) as React.ReactNode)}
          <div className="actions">
            {canManage &&
              ["PENDING", "IN_PROGRESS", "REJECTED"].includes(
                value(t, "status"),
              ) && (
                <button className="secondary" onClick={() => edit("tasks", t)}>
                  Editar
                </button>
              )}
            {own && ["PENDING", "REJECTED"].includes(value(t, "status")) && (
              <button
                disabled={busy}
                onClick={() =>
                  act("task.status", { id: t.id, status: "IN_PROGRESS" })
                }
              >
                Iniciar tarea
              </button>
            )}
            {canManage && t.status === "SUBMITTED" && (
              <>
                <button
                  disabled={busy}
                  onClick={() =>
                    act("task.status", {
                      id: t.id,
                      status: "APPROVED",
                      comments:
                        "Evidencia revisada y aprobada por responsable.",
                    })
                  }
                >
                  Aprobar entrega
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    const comments = window.prompt(
                      "Motivo y correcciones necesarias",
                    );
                    if (comments?.trim())
                      void act("task.status", {
                        id: t.id,
                        status: "REJECTED",
                        comments,
                      });
                  }}
                >
                  Solicitar corrección
                </button>
              </>
            )}
          </div>
          {own && ["IN_PROGRESS", "REJECTED"].includes(value(t, "status")) && (
            <Upload bucket="task-evidence" id={t.id} onSaved={refresh} />
          )}
          <div>
            {rows("task_evidence")
              .filter((e) => e.task_id === t.id)
              .map((e) => (
                <div className="evidence" key={e.id}>
                  <div className="actions">
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => openFile("task-evidence", e.id)}
                    >
                      Ver evidencia privada
                    </button>
                    {(hr || manager) && t.status === "SUBMITTED" && (
                      <button
                        className="ai-button"
                        disabled={busy}
                        onClick={() => analyze("evidence", e.id)}
                      >
                        ✧ Analizar evidencia
                      </button>
                    )}
                  </div>
                  <AIResult result={e.ai_result} />
                </div>
              ))}
          </div>
        </details>
      </article>
    );
  }
  return (
    <div className="app-layout">
      <aside className={"sidebar " + (mobile ? "visible" : "")}>
        <Link className="brand" href={profile ? home[profile.role] : "/jobs"}>
          <span className="brand-mark">n</span> nexo
          <span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">
          GESTIÓN DE TALENTO <span>WORKSPACE</span>
        </div>
        <nav>
          {(profile ? nav : ["jobs"]).map((key, i) => {
            const Icon = icons[i % icons.length];
            return (
              <Link
                key={key}
                className={key === view ? "active" : ""}
                href={href(key)}
              >
                <Icon size={19} />
                {titles[key]}
                {key === "applications" && rows("applications").length > 0 && (
                  <em>{rows("applications").length}</em>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="security-note">
            <ShieldCheck size={18} />
            <span>
              Información protegida
              <br />
              <small>Acceso según tu rol</small>
            </span>
          </div>
          {profile ? (
            <button
              className="logout"
              onClick={async () => {
                await request("/api/auth/logout", {});
                router.push("/login");
                router.refresh();
              }}
            >
              <LogOut size={17} /> Cerrar sesión
            </button>
          ) : (
            <Link className="button" href="/login">
              Iniciar sesión
            </Link>
          )}
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="Abrir navegación"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={22} />
            </button>
            <span>Espacio de trabajo</span>
            <span>/</span>
            <strong>{titles[view] ?? "Detalle"}</strong>
          </div>
          <div className="user">
            <span>
              <strong>{profile?.full_name ?? "Portal de talento"}</strong>
              <small>
                {profile ? stateLabel(profile.role) : "Acceso público"}
              </small>
            </span>
            <div className="avatar">
              {(profile?.full_name ?? "Nexo")
                .split(" ")
                .slice(0, 2)
                .map((x) => x[0])
                .join("")}
            </div>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {hr
                  ? "PERSONAS, PROGRESO Y OPORTUNIDADES"
                  : admin
                    ? "ADMINISTRACIÓN DEL ESPACIO"
                    : "TU SIGUIENTE PASO, EN UN SOLO LUGAR"}
              </span>
              <h1>
                {view === "overview"
                  ? `Hola, ${profile?.full_name.split(" ")[0] ?? ""}`
                  : (titles[view] ?? "Detalle")}
              </h1>
              <p>
                {view === "overview"
                  ? "Esto es lo que está pasando en tu espacio de talento."
                  : view === "jobs"
                    ? "Descubre dónde puedes hacer la diferencia."
                    : "Consulta la información y da seguimiento a cada paso."}
              </p>
            </div>
            {canCreate && (
              <button onClick={() => edit(newKind[view])}>
                <Plus size={17} />{" "}
                {view === "vacancies" ? "Nueva vacante" : "Crear"}
              </button>
            )}
          </div>
          {view === "users" && admin && (
            <section className="panel">
              <h2>Encargados de Recursos Humanos</h2>
              <p>
                El rol RH_ADMIN administra los procesos de RH. El
                superadministrador también tiene acceso a todos esos módulos
                desde su menú.
              </p>
              <button
                onClick={() =>
                  setSpec({
                    ...formFor("users", data),
                    title: "Dar de alta encargado de RH",
                    values: { role: "RH_ADMIN" },
                  })
                }
              >
                Crear encargado de RH
              </button>
            </section>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                className="quiet"
                onClick={() => setNotice("")}
                aria-label="Cerrar aviso"
              >
                ×
              </button>
            </div>
          )}
          {hr && ["overview", "employees", "applications"].includes(view) && (
            <HiringAssignmentNotices data={authorized} onSaved={refresh} />
          )}
          {view === "overview" && profile && (
            <OperationsPanel data={data} profile={profile} area="overview" />
          )}
          {view === "overview" && (
            <>
              <div className="welcome-banner">
                <div>
                  <span className="eyebrow">CADA ETAPA CUENTA</span>
                  <h2>
                    {candidate
                      ? "Tu próxima oportunidad empieza contigo."
                      : admin
                        ? "Un equipo conectado empieza con una buena base."
                        : "Acompaña el crecimiento de tu equipo."}
                  </h2>
                  <p>
                    {candidate
                      ? "Completa tu perfil y encuentra una vacante para dar el siguiente paso."
                      : "Del primer contacto a los nuevos logros. Mantén a las personas y su progreso en el centro."}
                  </p>
                  <Link
                    href={
                      candidate
                        ? "/jobs"
                        : admin
                          ? "/admin/users"
                          : hr
                            ? "/rh/employees"
                            : "/" + root + "/tasks"
                    }
                  >
                    {candidate
                      ? "Explorar oportunidades"
                      : admin
                        ? "Administrar usuarios"
                        : "Ver " + (hr ? "equipo" : "tareas")}{" "}
                    <ArrowUpRight size={17} />
                  </Link>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <span>n</span>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div className="kpi-grid">
                {(candidate
                  ? [
                      ["Mis postulaciones", rows("applications").length],
                      [
                        "Entrevistas",
                        rows("interviews").filter(
                          (i) => i.status === "SCHEDULED",
                        ).length,
                      ],
                      [
                        "Vacantes disponibles",
                        rows("vacancies").filter(
                          (v) => v.status === "PUBLISHED",
                        ).length,
                      ],
                    ]
                  : admin
                    ? [
                        ["Usuarios", rows("profiles").length],
                        ["Áreas", rows("departments").length],
                        ["Puestos", rows("positions").length],
                      ]
                    : [
                        [
                          "Empleados activos",
                          rows("employees").filter((e) => e.status === "ACTIVE")
                            .length,
                        ],
                        [
                          "Vacantes activas",
                          rows("vacancies").filter(
                            (v) => v.status === "PUBLISHED",
                          ).length,
                        ],
                        [
                          "Tareas completadas",
                          scopedTasks.filter((t) => t.status === "APPROVED")
                            .length,
                        ],
                        ["Desempeño", `${metrics.overall_score}%`],
                      ]
                ).map(([label, n], i) => (
                  <article className="kpi" key={label}>
                    <div>
                      <span>{label}</span>
                      <span className={"kpi-icon color-" + i}>
                        {i === 0 ? (
                          <Users size={20} />
                        ) : i === 1 ? (
                          <BriefcaseBusiness size={20} />
                        ) : i === 2 ? (
                          <CheckSquare size={20} />
                        ) : (
                          <ChartNoAxesCombined size={20} />
                        )}
                      </span>
                    </div>
                    <strong>{n}</strong>
                    <small>Datos actuales de tu espacio</small>
                  </article>
                ))}
              </div>
              <div className="dashboard-columns">
                <section className="panel">
                  <div className="section-head">
                    <h2>
                      {candidate
                        ? "Mis postulaciones"
                        : "Pendientes del equipo"}
                    </h2>
                    <Link
                      href={
                        candidate ? "/candidate/applications" : href("tasks")
                      }
                    >
                      Ver todos ↗
                    </Link>
                  </div>
                  {candidate &&
                    rows("applications")
                      .slice(0, 5)
                      .map((r) => (
                        <div className="list-line" key={r.id}>
                          <div>
                            <strong>
                              {value(r, "title") ||
                                value(find("vacancies", r.vacancy_id), "title")}
                            </strong>
                            <small>
                              {value(r, "due_date") ||
                                "Seguimiento de candidatura"}
                            </small>
                          </div>
                          <Badge status={value(r, "status")} />
                        </div>
                      ))}
                  {!candidate && (
                    <div className="area-pending-groups">
                      {Array.from(
                        scopedTasks
                          .filter((t) => t.status !== "APPROVED")
                          .reduce((groups, task) => {
                            const employee = find(
                              "employees",
                              task.employee_id,
                            );
                            const position = find(
                              "positions",
                              employee.position_id,
                            );
                            const department = find(
                              "departments",
                              position.department_id,
                            );
                            const key = department.id || "unassigned";
                            const group = groups.get(key) ?? {
                              title:
                                value(department, "name") ||
                                "Sin área asignada",
                              tasks: [] as Row[],
                            };
                            group.tasks.push(task);
                            groups.set(key, group);
                            return groups;
                          }, new Map<string, { title: string; tasks: Row[] }>()),
                      )
                        .sort((a, b) =>
                          a[1].title.localeCompare(b[1].title, "es"),
                        )
                        .map(([id, group]) => (
                          <details className="area-pending-group" key={id}>
                            <summary>
                              <span>{group.title}</span>
                              <span className="badge">
                                {group.tasks.length}{" "}
                                {group.tasks.length === 1
                                  ? "pendiente"
                                  : "pendientes"}
                              </span>
                            </summary>
                            {sortTasks(group.tasks).map((task) => (
                              <div className="list-line" key={task.id}>
                                <div>
                                  <Link href={`${href("tasks")}/${task.id}`}>
                                    <strong>
                                      {value(task, "title") ||
                                        "Tarea pendiente"}
                                    </strong>
                                  </Link>
                                  <small>
                                    {employeeName(task.employee_id)} ·{" "}
                                    {value(task, "due_date")
                                      ? `Vence: ${value(task, "due_date")}`
                                      : "Sin fecha límite"}
                                  </small>
                                  <small>
                                    Prioridad:{" "}
                                    {stateLabel(value(task, "priority"))}
                                  </small>
                                </div>
                                <Badge status={value(task, "status")} />
                              </div>
                            ))}
                          </details>
                        ))}
                    </div>
                  )}
                  {!(
                    candidate
                      ? rows("applications")
                      : scopedTasks.filter((t) => t.status !== "APPROVED")
                  ).length && (
                    <p className="empty">No hay pendientes para mostrar.</p>
                  )}
                </section>
                <section className="panel">
                  <span className="eyebrow">UN PASO A LA VEZ</span>
                  <h2>
                    {candidate
                      ? "Prepara tu perfil"
                      : "Aprendizaje y desarrollo"}
                  </h2>
                  <p>
                    {candidate
                      ? "Comparte tus habilidades, experiencia y CV para que RH pueda conocer tu trayectoria."
                      : "Da seguimiento a la capacitación y las entregas para acompañar el progreso."}
                  </p>
                  {!candidate && !admin && (
                    <>
                      <div className="progress-label">
                        <span>Cursos completados</span>
                        <strong>
                          {Math.round(metrics.course_completion)}%
                        </strong>
                      </div>
                      <progress max={100} value={metrics.course_completion} />
                      <div className="progress-label">
                        <span>Tareas aprobadas</span>
                        <strong>{Math.round(metrics.task_completion)}%</strong>
                      </div>
                      <progress max={100} value={metrics.task_completion} />
                    </>
                  )}
                  <Link
                    href={
                      candidate
                        ? "/candidate/profile"
                        : admin
                          ? "/admin/positions"
                          : href("courses")
                    }
                  >
                    Continuar <ArrowUpRight size={14} />
                  </Link>
                </section>
              </div>
            </>
          )}
          {view !== "overview" && (
            <>
              <section
                className="workspace-filters"
                aria-label="Buscar y filtrar"
                hidden={view === "interviews"}
              >
                <div className="filter-heading">
                  <strong>Buscar y filtrar</strong>
                  <span>
                    Los filtros se aplican a los resultados de esta vista.
                  </span>
                  {[
                    "analytics",
                    "performance",
                    "onboarding",
                    "courses",
                    "tasks",
                  ].includes(view) && (
                    <button
                      type="button"
                      className="btn secondary"
                      aria-expanded={reportFiltersOpen}
                      aria-controls="workspace-filter-controls"
                      onClick={() => setReportFiltersOpen(!reportFiltersOpen)}
                    >
                      {reportFiltersOpen
                        ? "Ocultar filtros"
                        : "Mostrar filtros"}
                      {Object.values(filters).some((v) => v && v !== "all")
                        ? " · Activos"
                        : ""}
                    </button>
                  )}
                </div>
                <div
                  id="workspace-filter-controls"
                  hidden={
                    [
                      "analytics",
                      "performance",
                      "onboarding",
                      "courses",
                      "tasks",
                    ].includes(view) && !reportFiltersOpen
                  }
                >
                  <div className="toolbar">
                    <div className="search">
                      <Search size={17} />
                      <input
                        aria-label="Buscar registros"
                        placeholder="Buscar en esta vista…"
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          changeFilters({ ...filters, query: e.target.value });
                        }}
                      />
                    </div>
                    <span className="muted">Información actualizada</span>
                    {filterable && view !== "tasks" && hr && (
                      <label>
                        Área
                        <select
                          value={filters.department ?? ""}
                          onChange={(e) =>
                            changeFilters({
                              ...filters,
                              department: e.target.value,
                              employee: "",
                            })
                          }
                        >
                          <option value="">Todas las áreas autorizadas</option>
                          {(authorized.departments ?? []).map((d) => (
                            <option value={d.id} key={d.id}>
                              {value(d, "name")}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {[
                      "performance",
                      "analytics",
                      "courses",
                      "onboarding",
                    ].includes(view) &&
                      (hr || manager) && (
                        <label>
                          Colaborador
                          <select
                            value={filters.employee ?? ""}
                            onChange={(e) =>
                              changeFilters({
                                ...filters,
                                employee: e.target.value,
                              })
                            }
                          >
                            <option value="">
                              {hr
                                ? "Todas las personas del área"
                                : "Todas las personas de mi equipo"}
                            </option>
                            {(
                              filterWorkspace(authorized, {
                                department: activeFilters.department,
                              }).employees ?? []
                            ).map((e) => (
                              <option key={e.id} value={e.id}>
                                {name(e.profile_id)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    {view === "analytics" && hr && (
                      <>
                        <label>
                          Proceso
                          <select
                            value={filters.process ?? "all"}
                            onChange={(e) =>
                              changeFilters({
                                ...filters,
                                process: e.target.value,
                              })
                            }
                          >
                            <option value="all">Todos</option>
                            <option value="tasks">Tareas</option>
                            <option value="courses">Capacitación</option>
                            <option value="applications">Reclutamiento</option>
                          </select>
                        </label>
                        <label>
                          Fecha de creación
                          <select
                            value={filters.days ?? "all"}
                            onChange={(e) =>
                              changeFilters({
                                ...filters,
                                days: e.target.value,
                              })
                            }
                          >
                            <option value="all">Todo el periodo</option>
                            <option value="7">Últimos 7 días</option>
                            <option value="30">Últimos 30 días</option>
                            <option value="90">Últimos 90 días</option>
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                  {!detail && view !== "profile" && view !== "climate" && (
                    <ModuleFilterBar
                      view={view}
                      data={authorized}
                      filters={filters}
                      onChange={(next) => {
                        changeFilters(next);
                        if (view === "tasks" && next.state)
                          setTaskSection(
                            next.state === "APPROVED"
                              ? "history"
                              : next.state === "SUBMITTED"
                                ? "review"
                                : "active",
                          );
                      }}
                      onReset={() => {
                        setFilters({});
                        setSearch("");
                        setApplicationVacancy("");
                      }}
                    />
                  )}
                </div>
              </section>
              {view === "tasks" && (hr || manager) && (
                <details className="panel">
                  <summary>
                    Filtrar por personas{" "}
                    {filters.employees?.length
                      ? `(${filters.employees.length} seleccionadas)`
                      : ""}
                  </summary>
                  <p>
                    {hr
                      ? "Sin personas seleccionadas se muestran todas las del área."
                      : "Sin personas seleccionadas se muestra tu equipo autorizado."}{" "}
                    Cada selección filtra también las alertas y los análisis.
                  </p>
                  <EmployeePicker
                    data={authorized}
                    showAreaFilter={hr}
                    activeOnly={false}
                    selected={filters.employees ?? []}
                    department={filters.department ?? ""}
                    onDepartmentChange={(department) =>
                      changeFilters({ ...filters, department })
                    }
                    onChange={(employees) =>
                      changeFilters({ ...filters, employees })
                    }
                  />
                </details>
              )}
              {view === "vacancies" && hr && (
                <VacancyAssistant
                  data={data}
                  onDraft={(values) =>
                    setSpec({ ...formFor("vacancies", data), values })
                  }
                />
              )}
              {view === "interviews" &&
                hr &&
                interviewSection === "SCHEDULED" && (
                  <details className="panel">
                    <summary>
                      Agendar o consultar entrevistas en el calendario
                    </summary>
                    <InterviewCalendar
                      data={data}
                      onSelect={(row) => edit("interviews", row)}
                    />
                  </details>
                )}
              {["jobs", "vacancies"].includes(view) && (
                <div className="record-grid">
                  {filtered("vacancies").map(vacancyCard)}
                  {!filtered("vacancies").length && (
                    <p className="empty">
                      No hay vacantes que coincidan con tu búsqueda.
                    </p>
                  )}
                </div>
              )}

              {view === "applications" && !detail && (
                <section aria-label="Postulaciones por estado">
                  <div className="actions task-history-controls">
                    {Object.entries(applicationSections).map(
                      ([status, title]) => (
                        <button
                          key={status}
                          className={
                            applicationStatus === status ? "" : "secondary"
                          }
                          aria-pressed={applicationStatus === status}
                          onClick={() => setApplicationStatus(status)}
                        >
                          {title} (
                          {tableRows.filter((a) => a.status === status).length})
                        </button>
                      ),
                    )}
                  </div>
                  <h2>{applicationSections[applicationStatus]}</h2>
                </section>
              )}
              {view === "applications" && hr && !detail && (
                <ApplicationSummary
                  data={data}
                  applications={applicationRows}
                  status={applicationStatus}
                  selected={applicationVacancy}
                  select={setApplicationVacancy}
                  busy={busy}
                  openCv={(id) => openFile("cvs", id)}
                />
              )}
              {view === "applications" && (
                <div className="record-grid">
                  {applicationRows.map((a) => (
                    <article
                      className="record"
                      key={a.id}
                      id={`postulacion-${a.id}`}
                    >
                      <div className="section-head">
                        <div>
                          <span className="eyebrow">
                            {hr
                              ? name(
                                  find("candidates", a.candidate_id).profile_id,
                                )
                              : "MI POSTULACIÓN"}
                          </span>
                          <h3>
                            {value(find("vacancies", a.vacancy_id), "title")}
                          </h3>
                        </div>
                        <Badge status={value(a, "status")} />
                      </div>
                      <p>
                        Postulación:{" "}
                        {new Date(value(a, "applied_at")).toLocaleDateString(
                          "es-MX",
                        )}
                      </p>
                      {hr && (
                        <>
                          <p>
                            Habilidades:{" "}
                            {value(
                              find("candidates", a.candidate_id),
                              "skills",
                            )}{" "}
                            · Experiencia:{" "}
                            {value(
                              find("candidates", a.candidate_id),
                              "experience_years",
                            )}{" "}
                            años
                          </p>
                          <div className="actions">
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                openFile("cvs", value(a, "candidate_id"))
                              }
                            >
                              Ver CV privado
                            </button>
                            {!["CONTRATADO", "RECHAZADO"].includes(
                              value(a, "status"),
                            ) && (
                              <button
                                className="ai-button"
                                disabled={busy}
                                onClick={() => analyze("recruitment", a.id)}
                              >
                                ✧ Evaluar candidato
                              </button>
                            )}
                          </div>
                        </>
                      )}
                      <AIResult result={a.ai_result} />
                      {hr && (
                        <div className="actions">
                          {(
                            applicationTransitions[value(a, "status")] ?? []
                          ).map((s) => (
                            <button
                              className="secondary"
                              disabled={busy}
                              key={s}
                              onClick={() =>
                                act("application.status", {
                                  id: a.id,
                                  status: s,
                                })
                              }
                            >
                              {labels[s]}
                            </button>
                          ))}
                          {a.status === "PRESELECCIONADO" && (
                            <button
                              onClick={() =>
                                edit("interviews", {
                                  id: "",
                                  application_id: a.id,
                                })
                              }
                            >
                              Agendar entrevista
                            </button>
                          )}
                          {a.status === "ENTREVISTA" && (
                            <HireCandidate
                              applicationId={a.id}
                              positionId={value(
                                find("vacancies", a.vacancy_id),
                                "position_id",
                              )}
                              data={authorized}
                              onSaved={refresh}
                            />
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                  {!applicationRows.length && (
                    <p className="empty">
                      {detail
                        ? "No hay postulaciones para mostrar."
                        : "No hay postulaciones en este estado con los filtros actuales."}
                    </p>
                  )}
                </div>
              )}
              {profile && ["tasks"].includes(view) && !candidate && (
                <details className="panel">
                  <summary>Alertas y análisis del equipo con IA</summary>
                  <OperationsPanel
                    key={view + JSON.stringify(activeFilters)}
                    filters={activeFilters}
                    data={data}
                    profile={profile}
                    area={
                      view as "courses" | "tasks" | "performance" | "analytics"
                    }
                  />
                </details>
              )}
              {view === "employees" &&
                !detail &&
                profile &&
                (hr || manager) && (
                  <TeamTree
                    data={authorized}
                    profile={profile}
                    selectedIds={(data.employees ?? []).map((e) => e.id)}
                  />
                )}
              {view === "employees" && detail && profile && (
                <EmployeeProfile
                  data={authorized}
                  profile={profile}
                  id={detail}
                />
              )}
              {view === "audit" && admin && <AuditPanel data={data} />}
              {view === "climate" &&
                profile &&
                (hr || manager || profile.role === "EMPLEADO") && (
                  <WorkplaceClimate data={data} profile={profile} />
                )}
              {view === "interviews" && (
                <section>
                  <div
                    className="module-tabs"
                    aria-label="Entrevistas por estado"
                  >
                    {[
                      ["SCHEDULED", "Agendadas"],
                      ["COMPLETED", "Completadas"],
                      ["CANCELLED", "Canceladas"],
                    ].map(([state, label]) => (
                      <button
                        key={state}
                        aria-pressed={interviewSection === state}
                        className={
                          interviewSection === state ? "" : "secondary"
                        }
                        onClick={() => setInterviewSection(state)}
                      >
                        {label} (
                        {
                          rows("interviews").filter((i) => i.status === state)
                            .length
                        }
                        )
                      </button>
                    ))}
                  </div>
                  <div className="record-grid">
                    {rows("interviews")
                      .filter(
                        (i) =>
                          (!detail || i.id === detail) &&
                          (detail || i.status === interviewSection),
                      )
                      .sort((a, b) =>
                        value(a, "scheduled_at").localeCompare(
                          value(b, "scheduled_at"),
                        ),
                      )
                      .map((i) => (
                        <article key={i.id} className="record">
                          <Badge status={value(i, "status")} />
                          <h3>
                            {new Date(value(i, "scheduled_at")).toLocaleString(
                              "es-MX",
                            )}
                          </h3>
                          <p>
                            {value(
                              find(
                                "vacancies",
                                find("applications", i.application_id)
                                  .vacancy_id,
                              ),
                              "title",
                            )}
                          </p>
                          <p>
                            <strong>
                              {name(
                                find(
                                  "candidates",
                                  find("applications", i.application_id)
                                    .candidate_id,
                                ).profile_id,
                              )}
                            </strong>
                          </p>
                          <p>{value(i, "notes")}</p>
                          {hr && (
                            <div className="actions">
                              <button
                                className="secondary"
                                onClick={() => edit("interviews", i)}
                              >
                                Editar
                              </button>
                              {i.status === "SCHEDULED" && (
                                <button
                                  className="quiet"
                                  disabled={busy}
                                  onClick={() =>
                                    act("interview.cancel", { id: i.id })
                                  }
                                >
                                  Cancelar entrevista
                                </button>
                              )}
                            </div>
                          )}
                        </article>
                      ))}
                    {!rows("interviews").some(
                      (i) =>
                        (!detail || i.id === detail) &&
                        (detail || i.status === interviewSection),
                    ) && (
                      <p className="empty">
                        No hay entrevistas en esta sección.
                      </p>
                    )}
                  </div>
                </section>
              )}
              {view === "tasks" && (
                <section>
                  {detail ? (
                    <>
                      <Link className="secondary" href={href("tasks")}>
                        ← Volver a tareas
                      </Link>
                      <div className="record-grid">
                        {tableRows.map(taskCard)}
                      </div>
                      {!tableRows.length && (
                        <p className="empty">
                          Tarea no disponible con los permisos y filtros
                          actuales.
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="actions task-history-controls">
                        <button
                          className={
                            taskSection === "review" ? "" : "secondary"
                          }
                          onClick={() => setTaskSection("review")}
                        >
                          Entregadas por revisar (
                          {
                            tableRows.filter((t) => t.status === "SUBMITTED")
                              .length
                          }
                          )
                        </button>
                        <button
                          className={
                            taskSection === "active" ? "" : "secondary"
                          }
                          aria-pressed={taskSection === "active"}
                          onClick={() => setTaskSection("active")}
                        >
                          Tareas pendientes (
                          {
                            tableRows.filter(
                              (t) =>
                                !["APPROVED", "SUBMITTED"].includes(
                                  value(t, "status"),
                                ),
                            ).length
                          }
                          )
                        </button>
                        <button
                          className={taskHistory ? "" : "secondary"}
                          aria-pressed={taskHistory}
                          onClick={() => setTaskSection("history")}
                        >
                          Historial de aprobadas (
                          {
                            tableRows.filter((t) => t.status === "APPROVED")
                              .length
                          }
                          )
                        </button>
                      </div>
                      <p>
                        Orden: prioridad alta (rojo), media (ámbar) y baja
                        (verde). A igual prioridad, primero la fecha límite más
                        cercana.
                      </p>
                      <div className="record-grid">
                        {sortTasks(tableRows.filter(taskMatches)).map((t) =>
                          taskHistory ? (
                            <article
                              className="record task-priority-card"
                              data-priority={value(t, "priority")}
                              key={t.id}
                            >
                              <span className="eyebrow">
                                {employeeName(t.employee_id)} ·{" "}
                                {labels[value(t, "priority")]}
                              </span>
                              <h3>{value(t, "title")}</h3>
                              <Badge status="APPROVED" />
                              <p>Fecha límite: {value(t, "due_date")}</p>
                              <Link
                                className="secondary"
                                href={`${href("tasks")}/${t.id}`}
                              >
                                Ver características y evidencias ↗
                              </Link>
                            </article>
                          ) : (
                            taskCard(t)
                          ),
                        )}
                      </div>
                      {!tableRows.some(taskMatches) && (
                        <p className="empty">
                          {taskHistory
                            ? "No hay tareas aprobadas con estos filtros."
                            : "No hay tareas pendientes con estos filtros."}
                        </p>
                      )}
                    </>
                  )}
                </section>
              )}
              {view === "onboarding" && profile && (
                <OnboardingPanel
                  data={data}
                  profile={profile}
                  detail={detail}
                />
              )}
              {view === "courses" && profile && (
                <>
                  <div
                    className="module-tabs"
                    aria-label="Vistas de capacitación"
                  >
                    {[
                      ["catalog", "Cursos y asignaciones"],
                      ["follow", "Seguimiento y revisión"],
                      ...(hr ? [["create", "Crear con IA"]] : []),
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={courseSection === id}
                        className={courseSection === id ? "" : "secondary"}
                        onClick={() => setCourseSection(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {hr && courseSection === "create" && (
                    <TrainingAssistant data={authorized} onSaved={refresh} />
                  )}
                  <div hidden={courseSection !== "follow"}>
                    <TrainingProgress
                      data={data}
                      profile={profile}
                      onSaved={refresh}
                    />
                  </div>
                </>
              )}
              {view === "courses" && courseSection === "catalog" && (
                <div className="record-grid">
                  {filtered("courses").map((c) => (
                    <article className="record" key={c.id}>
                      <span className="eyebrow">
                        {value(c, "duration_minutes")} MIN ·{" "}
                        {c.required ? "INDUCCIÓN" : "DESARROLLO"}
                      </span>
                      <h3>{value(c, "title")}</h3>
                      <p>{value(c, "description")}</p>
                      <TrainingResources courseId={c.id} />
                      <details>
                        <summary>Leer contenido del curso</summary>
                        <div className="course-content">
                          {value(c, "content")}
                        </div>
                      </details>
                      {hr && (
                        <div className="actions">
                          <button
                            className="secondary"
                            onClick={() => edit("courses", c)}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => edit("assignment", { id: c.id })}
                          >
                            Asignar
                          </button>
                          <button
                            className="quiet"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Eliminar curso sin asignaciones.",
                                )
                              )
                                void act("course.delete", { id: c.id });
                            }}
                          >
                            Eliminar
                          </button>
                        </div>
                      )}
                      {manager && (
                        <button onClick={() => setAssignment({ course: c.id })}>
                          Asignar a mi equipo
                        </button>
                      )}
                      <details>
                        <summary>
                          Personas asignadas (
                          {
                            rows("course_assignments").filter(
                              (a) => a.course_id === c.id,
                            ).length
                          }
                          )
                        </summary>
                        {rows("course_assignments")
                          .filter((a) => a.course_id === c.id)
                          .map((a) => (
                            <div key={a.id} className="assignment">
                              <div className="progress-label">
                                <span>{employeeName(a.employee_id)}</span>
                                <strong>{value(a, "progress")}%</strong>
                              </div>
                              <progress max={100} value={Number(a.progress)} />
                              <Badge status={value(a, "status")} />
                              <TrainingEvidence
                                assignmentId={a.id}
                                progress={Number(a.progress)}
                                status={value(a, "status")}
                                own={a.employee_id === mine?.id}
                                canReview={
                                  (hr || manager) && a.employee_id !== mine?.id
                                }
                                onSaved={refresh}
                              />
                              {a.employee_id === mine?.id &&
                                !["COMPLETED", "SUBMITTED"].includes(
                                  value(a, "status"),
                                ) && (
                                  <button
                                    className="secondary"
                                    disabled={busy}
                                    onClick={() =>
                                      act("course.progress", {
                                        id: a.id,
                                        progress: Math.min(
                                          100,
                                          Number(a.progress) + 25,
                                        ),
                                      })
                                    }
                                  >
                                    {Number(a.progress) === 0
                                      ? "Iniciar curso"
                                      : Number(a.progress) === 75
                                        ? "Enviar curso a revisión"
                                        : "Registrar avance +25%"}
                                  </button>
                                )}
                            </div>
                          ))}
                      </details>
                    </article>
                  ))}
                  {!filtered("courses").length && (
                    <p className="empty">
                      Todavía no tienes cursos disponibles.
                    </p>
                  )}
                </div>
              )}
              {view === "employees" && !detail && profile && hr && (
                <StaffEnrollment
                  data={authorized}
                  superuser={admin}
                  onSaved={refresh}
                />
              )}
              {["performance", "analytics"].includes(view) && (
                <section
                  className="report-workspace"
                  aria-label="Panel de resultados"
                >
                  <div className="kpi-grid">
                    {[
                      [
                        view === "performance"
                          ? "Personas en seguimiento"
                          : "Candidatos",
                        rows(
                          view === "performance" ? "employees" : "candidates",
                        ).length,
                      ],
                      [
                        "Incorporaciones completadas",
                        rows("onboarding").filter(
                          (a) => a.status === "COMPLETED",
                        ).length,
                      ],
                      [
                        "Cursos completados",
                        scopedCourses.filter((c) => c.status === "COMPLETED")
                          .length,
                      ],
                      [
                        "Tareas vencidas",
                        scopedTasks.filter((t) =>
                          overdue(t, new Date().toISOString().slice(0, 10)),
                        ).length,
                      ],
                    ].map(([label, n]) => (
                      <article className="kpi" key={label}>
                        <span>{label}</span>
                        <strong>{n}</strong>
                      </article>
                    ))}
                  </div>
                  <div
                    className="report-navigation"
                    aria-label="Vistas del informe"
                  >
                    {[
                      {
                        id: "summary",
                        label: "Resumen",
                        hint: "Indicadores y distribuciones",
                      },
                      {
                        id: "analysis",
                        label: "Análisis con IA",
                        hint: "Preguntas y recomendaciones",
                      },
                      {
                        id: "people",
                        label: "Por persona",
                        hint: "Avances y perfiles",
                      },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={reportTab === t.id}
                        onClick={() => setReportTab(t.id)}
                      >
                        <strong>{t.label}</strong>
                        <span>{t.hint}</span>
                      </button>
                    ))}
                  </div>
                  <div hidden={reportTab !== "summary"}>
                    <div className="report-section-heading">
                      <h2>Una mirada a tus procesos</h2>
                      <p>
                        Compara la distribución de los registros del ámbito
                        seleccionado.
                      </p>
                    </div>
                    {profile && (
                      <AnalyticsCharts
                        key={JSON.stringify(activeFilters)}
                        data={data}
                        profile={profile}
                        process={
                          view === "performance" ? "workforce" : filters.process
                        }
                      />
                    )}
                  </div>
                  <div
                    hidden={reportTab !== "analysis"}
                    className="report-ai-grid"
                  >
                    {profile && (
                      <>
                        <WorkforceAI
                          key={JSON.stringify(activeFilters)}
                          mode="chart"
                          section={view as "performance" | "analytics"}
                          filters={activeFilters}
                        />
                        <OperationsPanel
                          key={view + JSON.stringify(activeFilters)}
                          data={data}
                          profile={profile}
                          area={view as "performance" | "analytics"}
                          filters={activeFilters}
                        />
                      </>
                    )}
                  </div>
                  <div
                    hidden={reportTab !== "people"}
                    className="panel people-report"
                  >
                    <h2>Progreso por persona</h2>
                    <p>
                      Abre un perfil para consultar su historial y seguimiento
                      autorizado.
                    </p>
                    {rows("employees").map((e) => {
                      const p = performance(
                        rows("tasks")
                          .filter((t) => t.employee_id === e.id)
                          .map((t) => ({ status: value(t, "status") })),
                        rows("course_assignments")
                          .filter((c) => c.employee_id === e.id)
                          .map((c) => ({ status: value(c, "status") })),
                      );
                      return (
                        <div key={e.id} className="performance-row">
                          <Link href={`${href("employees")}/${e.id}`}>
                            {name(e.profile_id)}
                          </Link>
                          {rows("tasks").some((t) => t.employee_id === e.id) ||
                          rows("course_assignments").some(
                            (c) => c.employee_id === e.id,
                          ) ? (
                            <>
                              <progress max={100} value={p.overall_score} />
                              <span>{p.overall_score}%</span>
                              <Badge status={p.signal} />
                            </>
                          ) : (
                            <span className="muted">
                              Sin asignaciones para evaluar
                            </span>
                          )}
                        </div>
                      );
                    })}
                    <p className="muted">
                      Desempeño = tareas aprobadas × 60% + cursos completados ×
                      40%. Sin asignaciones el indicador no permite evaluar
                      desempeño.
                    </p>
                  </div>
                </section>
              )}
              {view === "profile" && (
                <section className="panel">
                  <h2>{profile?.full_name}</h2>
                  <p>{profile?.email}</p>
                  {candidate &&
                    rows("candidates")
                      .filter((c) => c.profile_id === profile?.id)
                      .map((c) => (
                        <div key={c.id}>
                          <p>
                            Habilidades:{" "}
                            {value(c, "skills") || "Completa tus habilidades"}
                          </p>
                          <p>
                            Experiencia: {value(c, "experience_years")} años
                          </p>
                          <button
                            className="secondary"
                            onClick={() => edit("candidates", c)}
                          >
                            Editar perfil
                          </button>
                          <Upload bucket="cvs" onSaved={refresh} />
                          {c.cv_path != null && (
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => openFile("cvs", c.id)}
                            >
                              Consultar mi CV
                            </button>
                          )}
                        </div>
                      ))}
                </section>
              )}
              {[
                "employees",
                "users",
                "positions",
                "departments",
                "candidates",
              ].includes(view) &&
                !(view === "employees" && detail) && (
                  <div className="panel table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{view === "audit" ? "Acción" : "Nombre"}</th>
                          <th>Detalle</th>
                          <th>Estado / fecha</th>
                          <th>
                            <span className="sr-only">Acciones</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <strong>
                                {view === "employees" || view === "candidates"
                                  ? name(r.profile_id)
                                  : value(r, "full_name") ||
                                    value(r, "name") ||
                                    value(r, "action")}
                              </strong>
                            </td>
                            <td>
                              {view === "employees"
                                ? value(
                                    find("positions", r.position_id),
                                    "name",
                                  )
                                : view === "audit"
                                  ? value(r, "resource_type")
                                  : value(r, "email") ||
                                    value(
                                      find("departments", r.department_id),
                                      "name",
                                    ) ||
                                    value(r, "skills")}
                            </td>
                            <td>
                              {r.status ? (
                                <Badge status={value(r, "status")} />
                              ) : r.role ? (
                                <Badge status={value(r, "role")} />
                              ) : (
                                new Date(
                                  value(r, "created_at"),
                                ).toLocaleDateString("es-MX")
                              )}
                            </td>
                            <td>
                              {((admin &&
                                ["users", "positions", "departments"].includes(
                                  view,
                                )) ||
                                (hr &&
                                  view === "employees" &&
                                  profile &&
                                  canEditStaff(authorized, profile, r) &&
                                  (r.profile_id !== profile?.id || admin))) && (
                                <button
                                  className="secondary"
                                  onClick={() => edit(tableView, r)}
                                >
                                  Editar
                                </button>
                              )}
                              {view === "candidates" && hr && (
                                <button
                                  className="secondary"
                                  onClick={() => openFile("cvs", r.id)}
                                >
                                  Ver CV
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!tableRows.length && (
                      <p className="empty">
                        No hay registros que coincidan con tu búsqueda.
                      </p>
                    )}
                  </div>
                )}
            </>
          )}
          <footer className="page-footer">
            <span>Nexo · Gestión de talento</span>
            <span>
              Las decisiones sobre personas siempre requieren criterio humano.
            </span>
          </footer>
        </main>
      </div>
      {assignment && (
        <BulkAssignment
          showAreaFilter={hr}
          data={
            !assignment.course && profile
              ? taskRecipients(authorized, profile)
              : authorized
          }
          subordinatesOnly={manager && !assignment.course}
          course={assignment.course}
          onClose={() => setAssignment(null)}
          onSaved={(message) => {
            router.refresh();
            setNotice(message);
          }}
        />
      )}
      {spec && (
        <EditForm spec={spec} onClose={() => setSpec(null)} onSaved={refresh} />
      )}
    </div>
  );
}
