"use client";
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
import { RecruitmentRecommendations } from "./recruitment-recommendations";
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
const labels: Record<string, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  CLOSED: "Cerrada",
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  SUBMITTED: "En revisión",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  COMPLETED: "Completado",
  ASSIGNED: "Asignado",
  SCHEDULED: "Agendada",
  CANCELLED: "Cancelada",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  POSTULADO: "Postulado",
  EN_REVISION: "En revisión",
  PRESELECCIONADO: "Preseleccionado",
  ENTREVISTA: "Entrevista",
  CONTRATADO: "Contratado",
  RECHAZADO: "Rechazado",
  NEEDS_REVIEW: "Revisión humana",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
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
      {labels[status] ?? status}
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
  data,
  path,
  profile,
}: {
  data: Snapshot;
  path: string[];
  profile: Profile | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(""),
    [spec, setSpec] = useState<FormSpec | null>(() =>
      path[2] === "new" &&
      path[1] === "vacancies" &&
      profile?.role === "RH_ADMIN"
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
  const hr = profile?.role === "RH_ADMIN",
    manager = profile?.role === "JEFE",
    admin = profile?.role === "SUPERUSER",
    candidate = profile?.role === "CANDIDATO";
  const rows = (table: string) => data[table] ?? [];
  const find = (table: string, id: unknown) =>
    rows(table).find((r) => r.id === id) ?? { id: "" };
  const name = (id: unknown) =>
    value(find("profiles", id), "full_name") || "Persona";
  const employeeName = (id: unknown) => name(find("employees", id).profile_id);
  const refresh = () => {
    router.refresh();
    setNotice("Cambios guardados.");
  };
  const edit = (kind: string, row?: Row) => setSpec(formFor(kind, data, row));
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
    ? ["overview", "users", "departments", "positions", "audit"]
    : candidate
      ? ["overview", "jobs", "applications", "interviews", "profile"]
      : hr
        ? [
            "overview",
            "vacancies",
            "applications",
            "recommendations",
            "interviews",
            "employees",
            "onboarding",
            "courses",
            "tasks",
            "performance",
            "analytics",
            "audit",
          ]
        : manager
          ? ["overview", "employees", "tasks", "courses", "performance"]
          : [
              "overview",
              "onboarding",
              "courses",
              "tasks",
              "performance",
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
  const tableRows = filtered(tableView);
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
        <div className="actions">
          {hr ? (
            <>
              <Link className="ai-button" href={`/rh/recommendations/${v.id}`}>
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
    return (
      <article className="record" key={t.id}>
        <div className="section-head">
          <div>
            <span className="eyebrow">
              {employeeName(t.employee_id)} · {labels[value(t, "priority")]}
            </span>
            <h3>{value(t, "title")}</h3>
          </div>
          <Badge status={value(t, "status")} />
        </div>
        <p>{value(t, "description")}</p>
        <small>Fecha límite: {value(t, "due_date")}</small>
        {Boolean(t.comments) &&
          ((
            <p>
              <strong>Revisión:</strong> {value(t, "comments")}
            </p>
          ) as React.ReactNode)}
        <div className="actions">
          {(hr || manager) &&
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
          {(hr || manager) && t.status === "SUBMITTED" && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  act("task.status", {
                    id: t.id,
                    status: "APPROVED",
                    comments: "Evidencia revisada y aprobada por responsable.",
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
                {profile?.role.replace("_", " ") ?? "Acceso público"}
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
                        candidate
                          ? "/candidate/applications"
                          : admin
                            ? "/admin/users"
                            : href("tasks")
                      }
                    >
                      Ver todos ↗
                    </Link>
                  </div>
                  {(candidate
                    ? rows("applications")
                    : scopedTasks.filter((t) => t.status !== "APPROVED")
                  )
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
              <div className="toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label="Buscar registros"
                    placeholder="Buscar en esta vista…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <span className="muted">Información actualizada</span>
              </div>
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
              {view === "recommendations" && hr && (
                <RecruitmentRecommendations
                  key={detail ?? "all"}
                  data={data}
                  initialVacancy={detail}
                  busy={busy}
                  analyze={analyze}
                />
              )}
              {view === "applications" && (
                <div className="record-grid">
                  {tableRows.map((a) => (
                    <article className="record" key={a.id}>
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
                            <button
                              className="ai-button"
                              disabled={busy}
                              onClick={() => analyze("recruitment", a.id)}
                            >
                              ✧ Evaluar candidato
                            </button>
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
                            <button
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Confirmar contratación y crear empleado, onboarding, cursos y tarea inicial.",
                                  )
                                )
                                  void act("application.hire", { id: a.id });
                              }}
                            >
                              Confirmar contratación
                            </button>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                  {!tableRows.length && (
                    <p className="empty">No hay postulaciones para mostrar.</p>
                  )}
                </div>
              )}
              {view === "interviews" && (
                <div className="record-grid">
                  {tableRows.map((i) => (
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
                            find("applications", i.application_id).vacancy_id,
                          ),
                          "title",
                        )}
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
                          <button
                            className="quiet"
                            disabled={busy}
                            onClick={() =>
                              act("interview.cancel", { id: i.id })
                            }
                          >
                            Cancelar entrevista
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                  {!tableRows.length && (
                    <p className="empty">No hay entrevistas agendadas.</p>
                  )}
                </div>
              )}
              {view === "tasks" && (
                <div className="record-grid">
                  {tableRows.map(taskCard)}
                  {!tableRows.length && (
                    <p className="empty">No hay tareas en esta vista.</p>
                  )}
                </div>
              )}
              {view === "onboarding" && (
                <div className="record-grid">
                  {filtered("onboarding").map((o) => {
                    const items = rows("onboarding_items").filter(
                      (i) => i.onboarding_id === o.id,
                    );
                    const pct = items.length
                      ? (items.filter((i) => i.status === "COMPLETED").length /
                          items.length) *
                        100
                      : 0;
                    return (
                      <article key={o.id} className="record">
                        <h3>{employeeName(o.employee_id)}</h3>
                        <Badge status={value(o, "status")} />
                        <div className="progress-label">
                          <span>Avance</span>
                          <strong>{Math.round(pct)}%</strong>
                        </div>
                        <progress max={100} value={pct} />
                        {items.map((i) => (
                          <div className="list-line" key={i.id}>
                            <span>{value(i, "title")}</span>
                            {i.status === "COMPLETED" ? (
                              <Badge status="COMPLETED" />
                            ) : (
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() =>
                                  act("onboarding.complete", { id: i.id })
                                }
                              >
                                Completar
                              </button>
                            )}
                          </div>
                        ))}
                        {mine?.id === o.employee_id && (
                          <Upload
                            bucket="onboarding-documents"
                            id={o.id}
                            onSaved={refresh}
                          />
                        )}
                        <div className="actions">
                          {rows("onboarding_documents")
                            .filter((d) => d.onboarding_id === o.id)
                            .map((d, i) => (
                              <button
                                className="secondary"
                                key={d.id}
                                onClick={() =>
                                  openFile("onboarding-documents", d.id)
                                }
                              >
                                Documento {i + 1}
                              </button>
                            ))}
                        </div>
                      </article>
                    );
                  })}
                  {!rows("onboarding").length && (
                    <p className="empty">
                      Todavía no hay procesos de onboarding.
                    </p>
                  )}
                </div>
              )}
              {view === "courses" && (
                <div className="record-grid">
                  {filtered("courses").map((c) => (
                    <article className="record" key={c.id}>
                      <span className="eyebrow">
                        {value(c, "duration_minutes")} MIN ·{" "}
                        {c.required ? "INDUCCIÓN" : "DESARROLLO"}
                      </span>
                      <h3>{value(c, "title")}</h3>
                      <p>{value(c, "description")}</p>
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
                            {a.employee_id === mine?.id &&
                              a.status !== "COMPLETED" && (
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
                                      ? "Completar curso"
                                      : "Registrar avance +25%"}
                                </button>
                              )}
                          </div>
                        ))}
                    </article>
                  ))}
                  {!filtered("courses").length && (
                    <p className="empty">
                      Todavía no tienes cursos disponibles.
                    </p>
                  )}
                </div>
              )}
              {["performance", "analytics"].includes(view) && (
                <>
                  <div className="kpi-grid">
                    {[
                      ["Candidatos", rows("candidates").length],
                      [
                        "Contrataciones",
                        rows("applications").filter(
                          (a) => a.status === "CONTRATADO",
                        ).length,
                      ],
                      [
                        "Cursos completados",
                        scopedCourses.filter((c) => c.status === "COMPLETED")
                          .length,
                      ],
                      [
                        "Tareas vencidas",
                        scopedTasks.filter(
                          (t) =>
                            value(t, "due_date") <
                              new Date().toISOString().slice(0, 10) &&
                            t.status !== "APPROVED",
                        ).length,
                      ],
                    ].map(([label, n]) => (
                      <article className="kpi" key={label}>
                        <span>{label}</span>
                        <strong>{n}</strong>
                      </article>
                    ))}
                  </div>
                  <div className="panel">
                    <h2>Progreso por persona</h2>
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
                          <strong>{name(e.profile_id)}</strong>
                          <progress max={100} value={p.overall_score} />
                          <span>{p.overall_score}%</span>
                          <Badge status={p.signal} />
                        </div>
                      );
                    })}
                    <p className="muted">
                      Desempeño = tareas aprobadas × 60% + cursos completados ×
                      40%. Sin asignaciones se considera 0%.
                    </p>
                  </div>
                </>
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
                "audit",
                "candidates",
              ].includes(view) && (
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
                              ? value(find("positions", r.position_id), "name")
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
                              (hr && view === "employees")) && (
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
      {spec && (
        <EditForm spec={spec} onClose={() => setSpec(null)} onSaved={refresh} />
      )}
    </div>
  );
}
