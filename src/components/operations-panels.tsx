"use client";
/** Paneles operativos sobre datos autorizados. Las gráficas y alertas no requieren IA. */
import { useState } from "react";
import Link from "next/link";
import { request } from "./forms";
import { type Profile, type Snapshot, value } from "@/modules/workspace/types";
import {
  notifications,
  overdue,
  scopeData,
  type InsightArea,
} from "@/modules/workspace/insights";
import { home } from "@/lib/permissions";
type Advice = {
  summary: string;
  recommendations: {
    title: string;
    reason: string;
    priority: string;
    resource_type: string;
    resource_id: string | null;
    employee_id: string | null;
  }[];
};
export function OperationsPanel({
  data,
  profile,
  area,
}: {
  data: Snapshot;
  profile: Profile;
  area: InsightArea;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [advice, setAdvice] = useState<Advice | null>(null),
    [generated, setGenerated] = useState("");
  const scoped = scopeData(data, profile),
    today = new Date().toISOString().slice(0, 10);
  const notes = notifications(scoped, today).filter(
    (n) =>
      area === "overview" ||
      area === "performance" ||
      area === "analytics" ||
      n.section === area,
  );
  const root = home[profile.role];
  const sectionFor = (s: string) =>
    s === "profiles"
      ? "users"
      : s === "vacancies" && profile.role === "CANDIDATO"
        ? "jobs"
        : s;
  const allowed =
    profile.role === "SUPERUSER"
      ? ["users", "departments", "positions", "audit"]
      : profile.role === "CANDIDATO"
        ? ["applications", "interviews", "jobs", "profile"]
        : profile.role === "JEFE"
          ? ["employees", "tasks", "courses", "performance"]
          : profile.role === "EMPLEADO"
            ? ["tasks", "courses", "onboarding", "performance"]
            : [
                "employees",
                "tasks",
                "courses",
                "performance",
                "applications",
                "interviews",
                "vacancies",
                "onboarding",
                "analytics",
              ];
  function href(section: string, id: string) {
    return section === "jobs" ? `/jobs/${id}` : `${root}/${section}/${id}`;
  }
  async function run() {
    setBusy(true);
    setError("");
    try {
      const r = await request("/api/ai/orchestrate", { area });
      setAdvice(r.result);
      setGenerated(r.generated_at);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel operations-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">
            {area === "overview"
              ? "NOVEDADES Y ORQUESTACIÓN"
              : "SEGUIMIENTO DEL EQUIPO"}
          </span>
          <h2>
            {area === "courses"
              ? "Capacitación recomendada según el puesto"
              : "Alertas y recomendaciones"}
          </h2>
        </div>
        <button
          className="ai-button"
          disabled={busy}
          onClick={() => void run()}
        >
          {busy ? "Analizando…" : "✧ Generar recomendaciones IA"}
        </button>
      </div>
      <p>
        {profile.role === "RH_ADMIN"
          ? "Alcance: todas las áreas autorizadas de RH."
          : profile.role === "JEFE"
            ? "Alcance: tu equipo directo y tus propios registros."
            : "Alcance: la información permitida para tu cuenta."}{" "}
        Las recomendaciones no ejecutan cambios automáticamente.
      </p>
      <details open>
        <summary>{notes.length} novedades y pendientes</summary>
        <div className="notification-list">
          {notes.slice(0, 30).map((n, i) => (
            <div className="list-line" key={`${n.section}-${n.id}-${i}`}>
              <div>
                <strong>{n.title}</strong>
                <small>{n.detail}</small>
              </div>
              {allowed.includes(n.section) && (
                <Link href={href(n.section, n.id)}>Revisar ↗</Link>
              )}
            </div>
          ))}
          {!notes.length && (
            <p>No hay pendientes detectados en los datos cargados.</p>
          )}
          {notes.length > 30 && (
            <p>
              Se muestran las primeras 30 novedades. Consulta cada módulo para
              el detalle.
            </p>
          )}
        </div>
      </details>
      {error && <p role="alert">{error}</p>}
      {advice && (
        <div className="ai-result">
          <h3>Recomendaciones de IA</h3>
          <small>
            Generadas: {new Date(generated).toLocaleString("es-MX")} · Revisión
            humana requerida
          </small>
          <p>{advice.summary}</p>
          <div className="record-grid">
            {advice.recommendations.map((r, i) => {
              const section = sectionFor(r.resource_type);
              const employee = (data.employees ?? []).find(
                (e) => e.id === r.employee_id,
              );
              const person = (data.profiles ?? []).find(
                (p) => p.id === employee?.profile_id,
              );
              return (
                <article className="record" key={i}>
                  <span className="badge">
                    {{
                      HIGH: "Prioridad alta",
                      MEDIUM: "Prioridad media",
                      LOW: "Prioridad baja",
                    }[r.priority] ?? r.priority}
                  </span>
                  <h3>{r.title}</h3>
                  {person && <strong>{value(person, "full_name")}</strong>}
                  <p>{r.reason}</p>
                  {r.resource_id && allowed.includes(section) && (
                    <Link href={href(section, r.resource_id)}>
                      Revisar recurso ↗
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export function TeamTree({
  data,
  profile,
}: {
  data: Snapshot;
  profile: Profile;
}) {
  const [selected, setSelected] = useState("");
  const employees = scopeData(data, profile).employees ?? [];
  const name = (id: unknown) =>
    value(
      (data.profiles ?? []).find((p) => p.id === id) ?? { id: "" },
      "full_name",
    ) || "Integrante";
  const managers = employees.filter(
    (e) =>
      (data.profiles ?? []).some(
        (p) => p.id === e.profile_id && p.role === "JEFE",
      ) || employees.some((c) => c.manager_id === e.id),
  );
  function node(id: string, visited: Set<string>): React.ReactNode {
    if (visited.has(id))
      return <li key={id}>Relación circular detectada; revisar asignación.</li>;
    const e = employees.find((e) => e.id === id);
    if (!e) return null;
    const next = new Set(visited).add(id);
    const position = (data.positions ?? []).find((p) => p.id === e.position_id),
      dept = (data.departments ?? []).find(
        (d) => d.id === position?.department_id,
      );
    const tasks = (data.tasks ?? []).filter((t) => t.employee_id === id),
      late = tasks.filter((t) =>
        overdue(t, new Date().toISOString().slice(0, 10)),
      ).length;
    const children = employees.filter((c) => c.manager_id === id);
    return (
      <li key={id}>
        <article className="record">
          <strong>{name(e.profile_id)}</strong>
          <p>
            {position ? value(position, "name") : "Puesto sin asignar"} ·{" "}
            {dept ? value(dept, "name") : "Área sin asignar"}
          </p>
          <small>
            {value(e, "status")} · {tasks.length} tareas · {late} atrasadas
          </small>
          <p>
            <Link href={`${home[profile.role]}/employees/${id}`}>
              Ver ficha
            </Link>
          </p>
        </article>
        {children.length > 0 && (
          <ul>{children.map((c) => node(c.id, next))}</ul>
        )}
      </li>
    );
  }
  return (
    <section className="panel">
      <h2>Jefes y estructura del equipo</h2>
      <div className="chips">
        {managers.map((m) => (
          <button
            className="secondary"
            key={m.id}
            aria-pressed={selected === m.id}
            onClick={() => setSelected(m.id)}
          >
            {name(m.profile_id)} ·{" "}
            {employees.filter((e) => e.manager_id === m.id).length} integrantes
            directos
          </button>
        ))}
      </div>
      {!managers.length && <p>No hay jefes asignados visibles.</p>}
      {selected ? (
        <div className="team-tree">
          <ul>{node(selected, new Set())}</ul>
        </div>
      ) : (
        <p>
          Selecciona un jefe para abrir el árbol jerárquico y el resumen de su
          equipo.
        </p>
      )}
      <p>
        {employees.filter((e) => !e.manager_id).length} personas visibles sin
        jefe asignado.
      </p>
    </section>
  );
}

export function AnalyticsCharts({
  data,
  profile,
}: {
  data: Snapshot;
  profile: Profile;
}) {
  const [metric, setMetric] = useState("tasks"),
    [chart, setChart] = useState("bars"),
    [now] = useState(() => Date.now()),
    [department, setDepartment] = useState(""),
    [days, setDays] = useState("all");
  const scoped = scopeData(data, profile),
    employees = (scoped.employees ?? []).filter(
      (e) =>
        !department ||
        (data.positions ?? []).some(
          (p) => p.id === e.position_id && p.department_id === department,
        ),
    );
  const ids = new Set(employees.map((e) => e.id));
  const cutoff =
    days === "all" ? "" : new Date(now - Number(days) * 86400000).toISOString();
  const rows =
    (metric === "tasks"
      ? scoped.tasks
      : metric === "courses"
        ? scoped.course_assignments
        : scoped.applications) ?? [];
  const selected = rows.filter(
    (r) =>
      (!cutoff ||
        value(r, metric === "applications" ? "applied_at" : "created_at") >=
          cutoff) &&
      (metric === "applications"
        ? !department ||
          (data.vacancies ?? []).some(
            (v) =>
              v.id === r.vacancy_id &&
              (data.positions ?? []).some(
                (p) => p.id === v.position_id && p.department_id === department,
              ),
          )
        : ids.has(String(r.employee_id))),
  );
  const groups: Record<string, number> = {};
  for (const r of selected) {
    const k = value(r, "status");
    groups[k] = (groups[k] ?? 0) + 1;
  }
  const maximum = Math.max(1, ...Object.values(groups));
  const colors = [
    "#287c61",
    "#bb7730",
    "#516bb0",
    "#a45878",
    "#537a8d",
    "#8b7432",
    "#697d46",
  ];
  let angle = 0;
  const segments = Object.values(groups).map((count, i) => {
    const start = angle;
    angle += (count / Math.max(1, selected.length)) * 360;
    return `${colors[i % colors.length]} ${start}deg ${angle}deg`;
  });
  const labels: Record<string, string> = {
    PENDING: "Pendientes",
    IN_PROGRESS: "En progreso",
    SUBMITTED: "En revisión",
    APPROVED: "Aprobadas",
    REJECTED: "Rechazadas",
    ASSIGNED: "Asignados",
    COMPLETED: "Completados",
    POSTULADO: "Postulados",
    EN_REVISION: "En revisión",
    PRESELECCIONADO: "Preseleccionados",
    ENTREVISTA: "Entrevista",
    CONTRATADO: "Contratados",
    RECHAZADO: "Rechazados",
  };
  return (
    <section className="panel">
      <h2>Analíticas por área y proceso</h2>
      <div className="chart-filters">
        <label>
          Gráfica
          <select value={chart} onChange={(e) => setChart(e.target.value)}>
            <option value="bars">Barras</option>
            <option value="ring">Distribución circular</option>
          </select>
        </label>
        <label>
          Proceso
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="tasks">Tareas</option>
            <option value="courses">Capacitación</option>
            <option value="applications">Reclutamiento</option>
          </select>
        </label>
        <label>
          Área
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">Todas las áreas</option>
            {(data.departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {value(d, "name")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Fecha de creación
          <select value={days} onChange={(e) => setDays(e.target.value)}>
            <option value="all">Todo el periodo</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="90">Últimos 90 días</option>
          </select>
        </label>
      </div>
      <p>{selected.length} registros · distribución por estado</p>
      {chart === "ring" && selected.length > 0 && (
        <div
          className="donut-chart"
          role="img"
          aria-label={`Distribución de ${selected.length} registros; cantidades detalladas debajo`}
          style={{ background: `conic-gradient(${segments.join(",")})` }}
        >
          <span>
            {selected.length}
            <small>registros</small>
          </span>
        </div>
      )}
      <div className="bar-chart">
        {Object.entries(groups).map(([status, count], index) => (
          <div className="chart-row" key={status}>
            <span>{labels[status] ?? status}</span>
            <div className="chart-track">
              <div
                className="chart-bar"
                style={{
                  width: `${(count / maximum) * 100}%`,
                  background: colors[index % colors.length],
                }}
              />
            </div>
            <strong>
              {count} ({Math.round((count / selected.length) * 100)}%)
            </strong>
          </div>
        ))}
      </div>
      {!selected.length && <p>No hay datos para estos filtros.</p>}
      <p className="muted">
        Gráficas basadas en los registros cargados (hasta 1000 por tabla). Las
        recomendaciones de IA del módulo analizan todo tu alcance, no solo estos
        filtros.
      </p>
    </section>
  );
}

export function AuditPanel({ data }: { data: Snapshot }) {
  const [filter, setFilter] = useState("");
  const rows = (data.audit_logs ?? []).filter((r) =>
    JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <section className="panel">
      <h2>Auditoría de plataforma</h2>
      <label>
        Buscar acción, recurso o identificador
        <input value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      <p>
        {rows.length} eventos cargados. Los eventos históricos pueden no tener
        metadatos ampliados.
      </p>
      <div className="record-grid">
        {rows.map((r) => {
          const actor = (data.profiles ?? []).find((p) => p.id === r.user_id);
          return (
            <article className="record" key={r.id}>
              <h3>
                {value(r, "action")} · {value(r, "resource_type")}
              </h3>
              <p>
                {actor
                  ? value(actor, "full_name")
                  : "Sistema o usuario no disponible"}
              </p>
              <small>
                {new Date(value(r, "created_at")).toLocaleString("es-MX")}
              </small>
              <p>Recurso: {value(r, "resource_id")}</p>
              <details>
                <summary>Metadatos del evento</summary>
                <pre className="audit-json">
                  {JSON.stringify(r.metadata ?? {}, null, 2)}
                </pre>
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
