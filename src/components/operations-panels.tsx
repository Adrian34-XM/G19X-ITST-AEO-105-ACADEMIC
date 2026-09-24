"use client";
/** Paneles operativos sobre datos autorizados. Las gráficas y alertas no requieren IA. */
import { stateLabel } from "@/modules/workspace/labels";
import { organization, canEditStaff } from "@/modules/workspace/organization";
import { PersonSelect } from "./person-select";
import type { WorkspaceFilters } from "@/modules/workspace/filters";
import { isHR } from "@/lib/permissions";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { request } from "./forms";
import { type Profile, type Snapshot, value } from "@/modules/workspace/types";
import {
  notifications,
  overdue,
  scopeData,
  type InsightArea,
} from "@/modules/workspace/insights";
import { home } from "@/lib/permissions";
// La categoría viene de la señal original; el color no depende del texto del título.
const alertLabels = {
  overdue: "Atraso",
  review: "Revisión pendiente",
  interview: "Entrevista",
  onboarding: "Incorporación",
  training: "Capacitación",
  application: "Postulación",
  audit: "Actividad de plataforma",
};
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
// Comparte únicamente solicitudes en curso de la misma cuenta; no persiste datos en el navegador.
const overviewRequests = new Map<
  string,
  Promise<{ result: Advice; generated_at: string }>
>();
function loadOverview(userId: string) {
  const pending = overviewRequests.get(userId);
  if (pending) return pending;
  const promise = request("/api/ai/orchestrate", {
    area: "overview",
    mode: "analyze",
  }).finally(() => overviewRequests.delete(userId));
  overviewRequests.set(userId, promise);
  return promise;
}
export function OperationsPanel({
  data,
  profile,
  area,
  filters = {},
}: {
  data: Snapshot;
  profile: Profile;
  area: InsightArea;
  filters?: WorkspaceFilters;
}) {
  const [busy, setBusy] = useState(area === "overview"),
    [error, setError] = useState(""),
    [advice, setAdvice] = useState<Advice | null>(null),
    [generated, setGenerated] = useState("");
  const [prompt, setPrompt] = useState("");
  const [notificationKind, setNotificationKind] = useState("");
  const scoped = data,
    today = new Date().toISOString().slice(0, 10);
  const notes = notifications(scoped, today).filter(
    (n) =>
      area === "overview" ||
      (area === "performance" &&
        ["tasks", "courses", "onboarding"].includes(n.section)) ||
      area === "analytics" ||
      n.section === area,
  );
  const visibleNotes = notes.filter(
    (n) =>
      area !== "overview" || !notificationKind || n.kind === notificationKind,
  );
  useEffect(() => {
    if (area !== "overview") return;
    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;
      setBusy(true);
      setError("");
      setAdvice(null);
      try {
        const result = await loadOverview(profile.id);
        if (active) {
          setAdvice(result.result);
          setGenerated(result.generated_at);
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error ? e.message : "No se pudo generar el resumen.",
          );
      } finally {
        if (active) setBusy(false);
      }
    });
    return () => {
      active = false;
    };
  }, [area, profile.id, data]);
  const root = home[profile.role];
  const sectionFor = (s: string) =>
    s === "climate_surveys"
      ? "climate"
      : s === "audit_logs"
        ? "audit"
        : s === "profiles"
          ? "users"
          : s === "vacancies" && profile.role === "CANDIDATO"
            ? "jobs"
            : s;
  const allowed =
    profile.role === "SUPERUSER"
      ? [
          "users",
          "departments",
          "positions",
          "audit",
          "employees",
          "tasks",
          "courses",
          "performance",
          "applications",
          "interviews",
          "vacancies",
          "onboarding",
          "analytics",
        ]
      : profile.role === "CANDIDATO"
        ? ["applications", "interviews", "jobs", "profile"]
        : profile.role === "JEFE"
          ? ["employees", "onboarding", "tasks", "courses", "performance"]
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
  if (profile.role !== "CANDIDATO") allowed.push("climate");
  function href(section: string, id: string) {
    if (section === "climate") return `${root}/climate`;
    return section === "jobs" ? `/jobs/${id}` : `${root}/${section}/${id}`;
  }
  async function run(mode: "analyze" | "prompt" = "analyze") {
    setBusy(true);
    setError("");
    setAdvice(null);
    try {
      const r = await request("/api/ai/orchestrate", {
        area,
        filters,
        prompt,
        mode,
      });
      if (mode === "prompt") {
        setPrompt(r.prompt);
        return;
      }
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
              ? "ORQUESTADOR · RESUMEN DE TU ESPACIO"
              : "SEGUIMIENTO DEL EQUIPO"}
          </span>
          <h2>
            {area === "overview"
              ? "Resumen de novedades con IA"
              : area === "courses"
                ? "Capacitación recomendada según el puesto"
                : "Alertas y recomendaciones"}
          </h2>
        </div>
        <button
          className="ai-button"
          disabled={busy}
          onClick={() => void run()}
        >
          {busy
            ? "Preparando resumen…"
            : area === "overview"
              ? "✧ Actualizar resumen"
              : "✧ Generar recomendaciones IA"}
        </button>
      </div>
      <p>
        {isHR(profile.role)
          ? "Alcance: todas las áreas autorizadas de RH."
          : profile.role === "JEFE"
            ? "Alcance: tu equipo, sus niveles subordinados y tus propios registros."
            : "Alcance: la información permitida para tu cuenta."}{" "}
        Las recomendaciones no ejecutan cambios automáticamente.
      </p>
      {["performance", "analytics"].includes(area) && (
        <div className="analysis-prompt">
          <label>
            Instrucciones del análisis (revisables)
            <textarea
              value={prompt}
              maxLength={1200}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                area === "performance"
                  ? "Analiza avances y necesidades de capacitación de las personas seleccionadas."
                  : "Resume cantidades, distribución y oportunidades de mejora del proceso seleccionado."
              }
            />
          </label>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => void run("prompt")}
          >
            ✧ Proponer instrucciones con IA
          </button>
          <p className="muted">
            Se usan los filtros de esta vista. El servidor excluye nombres,
            correos, CV, evidencias y comentarios privados; envía
            identificadores internos, estados y fechas. Evita incluir datos
            personales en las instrucciones.
          </p>
        </div>
      )}
      {area === "overview" && (
        <p className="muted">
          Se genera al abrir esta vista con los datos que puedes consultar.
          Muestra el estado actual y registros con fecha reciente; no sustituye
          el historial de auditoría. Actualiza para consultar nuevos datos.
        </p>
      )}
      {busy && area === "overview" && (
        <p role="status">
          El orquestador está revisando tus novedades y pendientes…
        </p>
      )}
      {advice && (
        <div className="ai-result">
          <h3>
            {area === "overview"
              ? "Resumen y próximos pasos"
              : "Recomendaciones de IA"}
          </h3>
          <small>
            Generadas: {new Date(generated).toLocaleString("es-MX")} · Revisión
            humana requerida
          </small>
          <div className="ai-summary-text">
            {advice.summary
              .split(/\n\s*\n/)
              .filter(Boolean)
              .map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
          </div>
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
                <article
                  className="record recommendation-card"
                  data-priority={r.priority}
                  key={i}
                >
                  <span className="badge">
                    {{
                      HIGH: "Prioridad alta",
                      MEDIUM: "Prioridad media",
                      LOW: "Prioridad baja",
                    }[r.priority] ?? stateLabel(r.priority)}
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
      {area === "overview" && (
        <label>
          Filtrar notificaciones por tipo
          <select
            value={notificationKind}
            onChange={(e) => setNotificationKind(e.target.value)}
          >
            <option value="">Todas las notificaciones</option>
            {Object.entries(alertLabels)
              .filter(([kind]) => notes.some((n) => n.kind === kind))
              .map(([kind, label]) => (
                <option key={kind} value={kind}>
                  {label}
                </option>
              ))}
          </select>
        </label>
      )}
      <details open>
        <summary>{visibleNotes.length} novedades y pendientes</summary>
        <div className="notification-list">
          {visibleNotes.slice(0, 30).map((n, i) => (
            <div
              className={`list-line notification-card notification-${n.kind}`}
              key={`${n.section}-${n.id}-${i}`}
            >
              <div>
                <span className="notification-label">
                  {alertLabels[n.kind]}
                </span>
                <strong>{n.title}</strong>
                <small>{n.detail}</small>
              </div>
              {allowed.includes(n.section) && (
                <Link href={href(n.section, n.id)}>Revisar ↗</Link>
              )}
            </div>
          ))}
          {!visibleNotes.length && (
            <p>No hay pendientes detectados en los datos cargados.</p>
          )}
          {visibleNotes.length > 30 && (
            <p>
              Se muestran las primeras 30 novedades. Consulta cada módulo para
              el detalle.
            </p>
          )}
        </div>
      </details>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

export function TeamTree({
  data,
  profile,
  selectedIds,
}: {
  data: Snapshot;
  profile: Profile;
  selectedIds?: string[];
}) {
  const [area, setArea] = useState(""),
    [visible, setVisible] = useState(true),
    [collapsed, setCollapsed] = useState<string[]>([]);
  const [employee, setEmployee] = useState(""),
    [manager, setManager] = useState(""),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  const authorized = scopeData(data, profile);
  const employees = authorized.employees ?? [];
  const tree = organization(
    authorized,
    isHR(profile.role) ? area : "",
    selectedIds,
  );
  const name = (id: unknown) =>
    value(
      (data.profiles ?? []).find((p) => p.id === id) ?? { id: "" },
      "full_name",
    ) || "Integrante";
  const managers = employees.filter(
    (e) =>
      e.status === "ACTIVE" &&
      (data.profiles ?? []).some(
        (p) =>
          p.active &&
          p.id === e.profile_id &&
          ["JEFE", "RH_ADMIN"].includes(value(p, "role")),
      ),
  );
  const assignable = employees.filter((e) =>
    isHR(profile.role)
      ? canEditStaff(authorized, profile, e)
      : e.profile_id !== profile.id &&
        !(data.profiles ?? []).some(
          (p) => p.id === e.profile_id && p.role === "RH_ADMIN",
        ),
  );
  async function assign() {
    setSaving(true);
    setMessage("");
    try {
      await request("/api/teams", { employee, manager: manager || null });
      setMessage("Jefe directo actualizado.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo asignar.");
    } finally {
      setSaving(false);
    }
  }
  function node(
    id: string,
    visited: Set<string>,
    members = tree.employees,
  ): React.ReactNode {
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
    const children = members.filter((c) => c.manager_id === id);
    return (
      <li key={id}>
        <article
          className={
            "org-person " + (!tree.matches.has(id) ? "org-context" : "")
          }
        >
          <span className="org-avatar" aria-hidden="true">
            {name(e.profile_id)
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")}
          </span>
          <strong>{name(e.profile_id)}</strong>
          {e.manager_id != null && (
            <small>
              Jefe:{" "}
              {name(employees.find((m) => m.id === e.manager_id)?.profile_id)}
            </small>
          )}
          <p>
            {position ? value(position, "name") : "Puesto sin asignar"} ·{" "}
            {dept ? value(dept, "name") : "Área sin asignar"}
          </p>
          <small>
            {stateLabel(value(e, "status"))} · {tasks.length} tareas · {late}{" "}
            atrasadas
          </small>
          <p>
            <Link href={`${home[profile.role]}/employees/${id}`}>
              Ver perfil
            </Link>
          </p>
        </article>
        {children.length > 0 && (
          <>
            <button
              className="org-toggle secondary"
              aria-expanded={!collapsed.includes(id)}
              onClick={() =>
                setCollapsed((old) =>
                  old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
                )
              }
            >
              {collapsed.includes(id) ? "Expandir" : "Contraer"} equipo (
              {children.length})
            </button>
            {!collapsed.includes(id) && (
              <ul>{children.map((c) => node(c.id, next, members))}</ul>
            )}
          </>
        )}
      </li>
    );
  }
  return (
    <section className="panel">
      <h2>Jefes y estructura del equipo</h2>
      <details>
        <summary>Asignar jefe directo o superior</summary>
        <div className="chart-filters">
          <PersonSelect
            label="Integrante o jefe"
            value={employee}
            options={assignable.map((e) => ({
              id: e.id,
              name: name(e.profile_id),
            }))}
            emptyLabel="Selecciona una persona"
            onChange={(id) => {
              setEmployee(id);
              setManager(
                String(employees.find((e) => e.id === id)?.manager_id ?? ""),
              );
            }}
          />
          <PersonSelect
            label="Jefe superior"
            value={manager}
            options={managers
              .filter((m) => m.id !== employee)
              .map((m) => ({ id: m.id, name: name(m.profile_id) }))}
            emptyLabel={
              isHR(profile.role) ? "Sin jefe asignado" : "Selecciona un jefe"
            }
            onChange={setManager}
          />
        </div>
        <button
          disabled={saving || !employee || (!isHR(profile.role) && !manager)}
          onClick={() => void assign()}
        >
          {saving ? "Guardando…" : "Guardar jerarquía"}
        </button>
        <p role="status">{message}</p>
        <p>
          Un jefe solo puede reorganizar personas y jefes de su jerarquía. RH
          puede asignar jefes entre áreas. Solo el superior de RH más alto de la
          cadena y el superusuario pueden modificar a otro RH. No se permiten
          ciclos.
        </p>
      </details>
      <div className="chart-filters">
        {isHR(profile.role) && (
          <label>
            Área del organigrama
            <select
              value={area}
              onChange={(e) => {
                setArea(e.target.value);
                setCollapsed([]);
                setVisible(true);
              }}
            >
              <option value="">Jerarquía general autorizada</option>
              {(data.departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {value(d, "name")}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="secondary"
          aria-expanded={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? "Ocultar organigrama" : "Mostrar organigrama"}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setCollapsed([]);
            setVisible(true);
          }}
        >
          Expandir todo
        </button>
      </div>
      <p>
        {tree.matches.size} personas en tu jerarquía autorizada.
        {isHR(profile.role) &&
          " Los superiores de otra área se muestran atenuados para conservar las relaciones reales."}
      </p>
      {visible && (
        <div
          className="org-chart"
          role="region"
          aria-label="Árbol organizacional"
          tabIndex={0}
        >
          {!area ? (
            <div className="org-areas">
              {Array.from(
                new Set(
                  tree.employees.map((e) =>
                    String(
                      (data.positions ?? []).find((p) => p.id === e.position_id)
                        ?.department_id ?? "",
                    ),
                  ),
                ),
              ).map((department) => {
                const members = tree.employees.filter(
                  (e) =>
                    String(
                      (data.positions ?? []).find((p) => p.id === e.position_id)
                        ?.department_id ?? "",
                    ) === department,
                );
                const grouped = organization({
                  ...authorized,
                  employees: members,
                });
                return (
                  <section className="org-area" key={department}>
                    <h3>
                      {value(
                        (data.departments ?? []).find(
                          (d) => d.id === department,
                        ) ?? { id: "" },
                        "name",
                      ) || "Área sin asignar"}{" "}
                      <small>· {members.length} integrantes</small>
                    </h3>
                    <ul>
                      {grouped.roots.map((r) => node(r.id, new Set(), members))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <ul>{tree.roots.map((r) => node(r.id, new Set()))}</ul>
          )}
          {!tree.roots.length && <p>No hay personas en esta área.</p>}
        </div>
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
  process,
}: {
  data: Snapshot;
  profile: Profile;
  process?: string;
}) {
  const metrics =
    process === "workforce"
      ? ["tasks", "courses"]
      : process && process !== "all"
        ? [process]
        : ["tasks", "courses", "applications"];
  return (
    <div className="analytics-chart-grid">
      {metrics.map((metric) => (
        <AnalyticsChart key={metric} data={data} metric={metric} />
      ))}
    </div>
  );
}
function AnalyticsChart({ data, metric }: { data: Snapshot; metric: string }) {
  const [chart, setChart] = useState("bars");
  const selected =
    (metric === "tasks"
      ? data.tasks
      : metric === "courses"
        ? data.course_assignments
        : data.applications) ?? [];
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
    <section className="panel analytics-chart-card">
      <h2>
        {
          (
            {
              tasks: "Tareas",
              courses: "Capacitación",
              applications: "Reclutamiento",
            } as Record<string, string>
          )[metric]
        }
      </h2>
      <div className="chart-filters">
        <label>
          Gráfica
          <select value={chart} onChange={(e) => setChart(e.target.value)}>
            <option value="bars">Barras</option>
            <option value="ring">Distribución circular</option>
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
            <span>{labels[status] ?? stateLabel(status)}</span>
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
        recomendaciones de IA respetan el área, persona, proceso y periodo
        seleccionados arriba.
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
