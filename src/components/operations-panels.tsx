"use client";
/**
 * @file Paneles de novedades, equipo, desempeño, analíticas y auditoría. Reúne filtros y vistas
 * especializadas; las acciones de IA siguen pasando por las rutas autorizadas del servidor.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
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
  canReviewTeamPerformance,
  type InsightArea,
} from "@/modules/workspace/insights";
import { home } from "@/lib/permissions";
import { TaskMessageAlerts } from "./task-message-alerts";
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
function requireSummary(result: Advice | null | undefined): Advice {
  if (
    !result ||
    typeof result.summary !== "string" ||
    !result.summary.trim() ||
    !Array.isArray(result.recommendations)
  )
    throw new Error(
      "La IA no devolvió un resumen válido. Vuelve a intentarlo; no se mostrará información inventada.",
    );
  return result;
}
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
  const [suggestion, setSuggestion] = useState("");
  const personalPerformance =
    area === "performance" && !canReviewTeamPerformance(data, profile);
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
          setAdvice(requireSummary(result.result));
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
    if (mode === "analyze") setAdvice(null);
    else setSuggestion("");
    try {
      const r = await request("/api/ai/orchestrate", {
        area,
        filters,
        prompt,
        mode,
      });
      if (mode === "prompt") {
        setSuggestion(r.prompt);
        return;
      }
      setAdvice(requireSummary(r.result));
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
              : personalPerformance
                ? "MI DESEMPEÑO"
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
        {personalPerformance
          ? "Alcance: únicamente tus tareas, capacitación e incorporación."
          : isHR(profile.role)
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
                  ? personalPerformance
                    ? "Analiza mi avance y sugiere cómo organizar mis pendientes y capacitación."
                    : "Analiza avances y necesidades de capacitación de las personas seleccionadas."
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
          {suggestion && (
            <article className="ai-result" aria-live="polite">
              <h3>Propuesta de instrucciones</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{suggestion}</p>
              <p className="muted">
                Esta propuesta todavía no es un análisis de los datos. Puedes
                usarla y editarla antes de generar las recomendaciones.
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setPrompt(suggestion)}
              >
                Usar estas instrucciones
              </button>
            </article>
          )}
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
          Resumen de registros creados esta semana, de lunes a domingo en
          horario de Ciudad de México, y su estado actual.{" "}
          {isHR(profile.role) && "Incluye postulaciones nuevas o reactivadas. "}
          Los pendientes de semanas anteriores siguen disponibles en las
          notificaciones y en cada módulo.
        </p>
      )}
      {busy && area === "overview" && (
        <p role="status">
          El orquestador está revisando tus novedades y pendientes…
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          <strong>No se pudo generar el resumen de IA.</strong>
          <p>{error}</p>
          <p>
            Las notificaciones siguen disponibles abajo. Puedes volver a
            intentarlo con «Actualizar resumen».
          </p>
        </div>
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
      {area === "overview" && profile.role !== "CANDIDATO" && (
        <TaskMessageAlerts key={profile.id} profile={profile} />
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
  const [layout, setLayout] = useState<"areas" | "hierarchy">("areas");
  const [zoom, setZoom] = useState(100);
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
            "org-person " +
            (children.length ? "org-leader " : "") +
            (!tree.matches.has(id) ? "org-context" : "")
          }
        >
          <span className="org-avatar" aria-hidden="true">
            {name(e.profile_id)
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")}
          </span>
          <span className="org-role">
            {children.length ? "Responsable de equipo" : "Integrante"}
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
          <div className="org-person-stats">
            <span>{stateLabel(value(e, "status"))}</span>
            <span>{tasks.length} tareas</span>
            {late > 0 && <span className="org-late">{late} con atraso</span>}
          </div>
          <p>
            <Link href={`${home[profile.role]}/employees/${id}`}>
              Ver perfil <span aria-hidden="true">↗</span>
            </Link>
          </p>
        </article>
        {children.length > 0 && (
          <>
            <button
              className="org-toggle secondary"
              aria-expanded={!collapsed.includes(id)}
              aria-label={`${collapsed.includes(id) ? "Expandir" : "Contraer"} equipo de ${name(e.profile_id)}`}
              onClick={() =>
                setCollapsed((old) =>
                  old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
                )
              }
            >
              <span aria-hidden="true">
                {collapsed.includes(id) ? "+" : "−"}
              </span>{" "}
              {children.length}{" "}
              {children.length === 1 ? "reporte directo" : "reportes directos"}
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
    <section className="panel org-panel">
      <div className="org-heading">
        <div>
          <span className="org-eyebrow">PERSONAS Y CONEXIONES</span>
          <h2>Jefes y estructura del equipo</h2>
          <p>
            Explora quién forma cada equipo y cómo se conecta con sus
            responsables.
          </p>
        </div>
        <span className="org-total">
          <strong>{tree.matches.size}</strong> personas en la vista
        </span>
      </div>
      <details className="org-management">
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
      <div className="chart-filters org-toolbar">
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
              <option value="">Todas las áreas autorizadas</option>
              {(data.departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {value(d, "name")}
                </option>
              ))}
            </select>
          </label>
        )}
        {!area && (
          <div
            className="org-view-switch"
            role="group"
            aria-label="Vista del organigrama"
          >
            <button
              className="secondary"
              aria-pressed={layout === "areas"}
              onClick={() => setLayout("areas")}
            >
              Por áreas
            </button>
            <button
              className="secondary"
              aria-pressed={layout === "hierarchy"}
              onClick={() => setLayout("hierarchy")}
            >
              Jerarquía completa
            </button>
          </div>
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
        <button
          className="secondary"
          onClick={() => setCollapsed(tree.employees.map((e) => e.id))}
        >
          Contraer todo
        </button>
      </div>
      {visible && (
        <div className="org-canvas-tools">
          <p>
            {area
              ? "Los superiores de otras áreas aparecen con borde discontinuo."
              : layout === "areas"
                ? "Cada recuadro agrupa un área. Consulta la jerarquía completa para ver conexiones entre áreas."
                : "Las líneas conectan a cada responsable con sus reportes directos."}{" "}
            Desplázate dentro del árbol para explorar.
          </p>
          <div
            className="org-zoom"
            role="group"
            aria-label="Tamaño del organigrama"
          >
            <button
              className="secondary"
              aria-label="Reducir organigrama"
              disabled={zoom <= 60}
              onClick={() => setZoom((v) => v - 10)}
            >
              −
            </button>
            <button
              className="secondary"
              aria-label="Restablecer tamaño del organigrama"
              onClick={() => setZoom(100)}
            >
              {zoom}%
            </button>
            <button
              className="secondary"
              aria-label="Ampliar organigrama"
              disabled={zoom >= 130}
              onClick={() => setZoom((v) => v + 10)}
            >
              +
            </button>
          </div>
        </div>
      )}
      {visible && (
        <div
          className="org-chart"
          role="region"
          aria-label="Árbol organizacional"
          tabIndex={0}
        >
          <div className="org-canvas" style={{ zoom: zoom / 100 }}>
            {!area && layout === "areas" ? (
              <div className="org-areas">
                {Array.from(
                  new Set(
                    tree.employees.map((e) =>
                      String(
                        (data.positions ?? []).find(
                          (p) => p.id === e.position_id,
                        )?.department_id ?? "",
                      ),
                    ),
                  ),
                ).map((department) => {
                  const members = tree.employees.filter(
                    (e) =>
                      String(
                        (data.positions ?? []).find(
                          (p) => p.id === e.position_id,
                        )?.department_id ?? "",
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
                        <small>
                          {members.filter((e) => tree.matches.has(e.id)).length}{" "}
                          personas seleccionadas · {members.length} visibles
                        </small>
                      </h3>
                      <ul>
                        {grouped.roots.map((r) =>
                          node(r.id, new Set(), members),
                        )}
                      </ul>
                    </section>
                  );
                })}
              </div>
            ) : (
              <ul className="org-roots">
                {tree.roots.map((r) => node(r.id, new Set()))}
              </ul>
            )}
            {!tree.roots.length && <p>No hay personas en esta área.</p>}
          </div>
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
        : ["applications", "vacancies", "interviews", "tasks", "courses"];
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
        : metric === "vacancies"
          ? data.vacancies
          : metric === "interviews"
            ? data.interviews
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
              applications: "Postulaciones por estado",
              vacancies: "Vacantes por estado",
              interviews: "Entrevistas por estado",
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

/** Vista exclusiva del superusuario; RLS y rutas también restringen el acceso. */
export function AuditPanel({ data }: { data: Snapshot }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState(""),
    [module, setModule] = useState(""),
    [action, setAction] = useState("");
  const modules: Record<string, string> = {
    profiles: "Usuarios",
    departments: "Áreas",
    positions: "Puestos",
    candidates: "Candidatos",
    vacancies: "Vacantes",
    applications: "Postulaciones",
    interviews: "Entrevistas",
    employees: "Equipo",
    onboarding: "Onboarding",
    onboarding_items: "Actividades de onboarding",
    onboarding_documents: "Documentos de onboarding",
    onboarding_templates: "Plantillas de onboarding",
    courses: "Capacitaciones",
    course_assignments: "Asignaciones de capacitación",
    course_evidence: "Evidencias de capacitación",
    tasks: "Tareas",
    task_evidence: "Evidencias de tareas",
    performance_reviews: "Desempeño",
    climate_surveys: "Encuestas de clima",
    orchestration_runs: "Resúmenes IA",
    ai_requests: "Solicitudes IA",
    ai_results: "Resultados IA",
    vacancy_documents: "Documentos de vacantes",
  };
  const actions: Record<string, string> = {
    INSERT: "Creación",
    UPDATE: "Modificación",
    DELETE: "Eliminación",
    "candidate.hired": "Contratación",
  };
  const fields: Record<string, string> = {
    name: "Nombre",
    full_name: "Nombre completo",
    title: "Título",
    status: "Estado",
    role: "Rol",
    active: "Cuenta activa",
    priority: "Prioridad",
    due_date: "Fecha límite",
    scheduled_at: "Fecha de entrevista",
    progress: "Avance (%)",
    position_id: "Puesto",
    department_id: "Área",
    manager_id: "Jefe directo",
    employee_id: "Colaborador",
    course_id: "Capacitación",
    owner_role: "Responsable",
    requires_document: "Requiere documento",
    required: "Obligatorio",
    hire_date: "Fecha de ingreso",
  };
  function display(field: string, raw: unknown): string {
    if (raw == null) return "Sin valor";
    if (typeof raw === "boolean") return raw ? "Sí" : "No";
    const tables: Record<string, string> = {
      position_id: "positions",
      department_id: "departments",
      course_id: "courses",
      manager_id: "employees",
      employee_id: "employees",
    };
    if (tables[field]) {
      const row = (data[tables[field]] ?? []).find((r) => r.id === raw);
      if (row?.profile_id)
        return (
          value(
            (data.profiles ?? []).find((p) => p.id === row.profile_id) ?? {
              id: "",
            },
            "full_name",
          ) || "Persona no disponible"
        );
      return row
        ? value(row, "name") || value(row, "title")
        : "Registro no disponible";
    }
    return stateLabel(String(raw));
  }
  const all = (data.audit_logs ?? []).map((r) => {
    const m = (
      r.metadata && typeof r.metadata === "object" ? r.metadata : {}
    ) as Record<string, unknown>;
    const actor = String(
      m.actor_name ||
        value(
          (data.profiles ?? []).find((p) => p.id === r.user_id) ?? { id: "" },
          "full_name",
        ) ||
        "Sistema o usuario no disponible",
    );
    const resource = (data[String(r.resource_type)] ?? []).find(
      (x) => x.id === r.resource_id,
    );
    const title = String(
      m.resource_name ||
        (resource && (value(resource, "title") || value(resource, "name"))) ||
        "",
    );
    return { r, m, actor, title };
  });
  const rows = all
    .filter(
      ({ r, actor, title }) =>
        (!module || r.resource_type === module) &&
        (!action || r.action === action) &&
        [
          actor,
          title,
          modules[String(r.resource_type)],
          actions[String(r.action)] || r.action,
          r.resource_id,
        ]
          .join(" ")
          .toLowerCase()
          .includes(filter.toLowerCase()),
    )
    .sort((a, b) =>
      String(b.r.created_at).localeCompare(String(a.r.created_at)),
    );
  const pages = Math.max(1, Math.ceil(rows.length / 30));
  const currentPage = Math.min(page, pages);
  const offset = (currentPage - 1) * 30;
  const visibleRows = rows.slice(offset, offset + 30);
  return (
    <section className="panel">
      <h2>Historial de cambios de la plataforma</h2>
      <p>
        Consulta quién realizó cada cambio, cuándo ocurrió y los valores
        anteriores y nuevos disponibles.
      </p>
      <div className="chart-filters">
        <label>
          Buscar persona o registro
          <input
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
            placeholder="Nombre, título o identificador"
          />
        </label>
        <label>
          Módulo
          <select
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los módulos</option>
            {Array.from(new Set(all.map(({ r }) => String(r.resource_type))))
              .sort()
              .map((m) => (
                <option key={m} value={m}>
                  {modules[m] || m}
                </option>
              ))}
          </select>
        </label>
        <label>
          Tipo de cambio
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los cambios</option>
            {Array.from(new Set(all.map(({ r }) => String(r.action))))
              .sort()
              .map((a) => (
                <option key={a} value={a}>
                  {actions[a] || a}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p>
        {rows.length} eventos en los registros cargados. Se consultan hasta los
        1000 eventos más recientes; los filtros se aplican a esa muestra. Los
        registros antiguos pueden no contener valores anteriores.
      </p>
      <div className="record-grid">
        {visibleRows.map(({ r, m, actor, title }) => {
          const changes =
            m.changes && typeof m.changes === "object"
              ? (m.changes as Record<
                  string,
                  { before: unknown; after: unknown }
                >)
              : {};
          const changed = Array.isArray(m.changed_fields)
            ? m.changed_fields.map(String)
            : [];
          return (
            <article className="record" key={r.id}>
              <h3>
                {actions[String(r.action)] || String(r.action)} ·{" "}
                {modules[String(r.resource_type)] || String(r.resource_type)}
              </h3>
              {title && (
                <p>
                  <strong>{title}</strong>
                </p>
              )}
              <p>
                {actor}
                {m.actor_role ? " · " + stateLabel(String(m.actor_role)) : ""}
              </p>
              <time dateTime={String(r.created_at)}>
                {new Date(String(r.created_at)).toLocaleString("es-MX")}
              </time>
              <details>
                <summary>Ver cambios ({changed.length})</summary>
                {Object.entries(changes).map(([field, change]) => (
                  <div key={field} className="audit-change">
                    <strong>{fields[field] || field}</strong>
                    <p>Antes: {display(field, change.before)}</p>
                    <p>Después: {display(field, change.after)}</p>
                  </div>
                ))}
                {!Object.keys(changes).length && (
                  <p>
                    {m.previous_status || m.new_status
                      ? "Estado: " +
                        display("status", m.previous_status) +
                        " → " +
                        display("status", m.new_status)
                      : "Este evento no conserva valores anteriores y nuevos."}
                  </p>
                )}
                {changed.length > 0 && (
                  <p>
                    Campos modificados:{" "}
                    {changed.map((f) => fields[f] || f).join(", ")}.
                  </p>
                )}
                <p className="muted">
                  No se copian contraseñas, documentos, respuestas anónimas ni
                  contenidos de IA al historial de cambios.
                </p>
                <small>Referencia del registro: {String(r.resource_id)}</small>
              </details>
            </article>
          );
        })}
      </div>
      {!rows.length && <p>No hay eventos que coincidan con los filtros.</p>}
      {rows.length > 0 && (
        <nav aria-label="Paginación de auditoría" className="chart-filters">
          <button
            className="secondary"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Anterior
          </button>
          <p role="status">
            Página {currentPage} de {pages} · Cambios {offset + 1}–
            {Math.min(offset + 30, rows.length)} de {rows.length}
          </p>
          <button
            className="secondary"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
          >
            Siguiente
          </button>
        </nav>
      )}
    </section>
  );
}
