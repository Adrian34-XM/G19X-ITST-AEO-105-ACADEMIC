"use client";
/**
 * @file Herramientas de gráficas, propuestas de instrucciones, capacitación y revisión del
 * progreso. Las gráficas representan conteos recibidos, con leyendas y tipos intercambiables; el
 * modelo no aporta código ejecutable.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Herramientas revisables: el servidor determina el alcance y calcula las cifras. */
import { useState } from "react";
import Link from "next/link";
import { request } from "./forms";
import { type Snapshot, type Profile, value } from "@/modules/workspace/types";
import { type WorkspaceFilters } from "@/modules/workspace/filters";
import { home, isHR } from "@/lib/permissions";
import { stateLabel } from "@/modules/workspace/labels";
import { trainingDraft } from "@/modules/workspace/workforce-ai";
import { TrainingEvidence } from "./training-evidence";

type Graph = {
  title: string;
  kind: string;
  dataset?: string;
  group?: string;
  values: { label: string; count: number }[];
};
/**
 * Cambiar la representación reutiliza las mismas categorías y conteos del servidor.
 * Las fechas se traducen para lectura; agrupar por creación no implica disponer de
 * una serie histórica de cambios de estado o del rendimiento de una persona.
 */
export function DataGraph({ chart }: { chart: Graph }) {
  const [selectedKind, setSelectedKind] = useState("");
  const kind = selectedKind || chart.kind;
  const unit =
    chart.dataset === "tasks"
      ? "tareas"
      : chart.dataset === "course_assignments"
        ? "capacitaciones"
        : chart.dataset === "onboarding"
          ? "incorporaciones"
          : "registros";
  const dated =
    chart.group === "day" ||
    chart.group === "month" ||
    chart.values.every((v) => /^\d{4}-\d{2}(-\d{2})?$/.test(v.label));
  const label = (raw: string) => {
    if (!/^\d{4}-\d{2}(-\d{2})?$/.test(raw)) {
      const translated = stateLabel(raw);
      return translated === "Estado no reconocido" ? raw : translated;
    }
    const date = new Date(`${raw.length === 7 ? `${raw}-01` : raw}T12:00:00Z`);
    return Number.isNaN(date.getTime())
      ? raw
      : date.toLocaleDateString("es-MX", {
          timeZone: "UTC",
          year: "numeric",
          month: "long",
          ...(raw.length === 10 ? { day: "numeric" as const } : {}),
        });
  };
  const total = chart.values.reduce((s, v) => s + v.count, 0),
    max = Math.max(1, ...chart.values.map((v) => v.count));
  const colors = [
    "#2761a2",
    "#438947",
    "#d08b20",
    "#a04359",
    "#8059aa",
    "#279a99",
  ];
  const slices = chart.values.map((v, i) => {
    const start = total
      ? (chart.values.slice(0, i).reduce((sum, v) => sum + v.count, 0) /
          total) *
        100
      : 0;
    const offset = start + (total ? (v.count / total) * 100 : 0);
    return `${colors[i % colors.length]} ${start}% ${offset}%`;
  });
  return (
    <article className="record">
      <h3>{chart.title}</h3>
      <label>
        Tipo de gráfica
        <select value={kind} onChange={(e) => setSelectedKind(e.target.value)}>
          <option value="bars">Barras horizontales</option>
          <option value="columns">Columnas</option>
          <option value="line">Líneas</option>
          <option value="pie">Circular</option>
          <option value="donut">Dona</option>
        </select>
      </label>
      {!total ? (
        <p>Sin datos con estos filtros.</p>
      ) : (
        <>
          {["pie", "donut"].includes(kind) && (
            <div
              role="img"
              aria-label={`${chart.title}: ${chart.values.map((v) => `${v.label} ${v.count}`).join(", ")}`}
              style={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: `conic-gradient(${slices.join(",")})`,
                margin: "12px auto",
                ...(kind === "donut"
                  ? {
                      maskImage:
                        "radial-gradient(circle, transparent 38%, black 39%)",
                    }
                  : {}),
              }}
            />
          )}
          {["line", "columns"].includes(kind) && (
            <div style={{ overflowX: "auto" }}>
              <svg
                role="img"
                aria-label={`${chart.title}: ${chart.values.map((v) => `${v.label}: ${v.count}`).join(", ")}`}
                viewBox={`0 0 ${Math.max(360, chart.values.length * 65)} 230`}
                style={{
                  width: "100%",
                  minWidth: Math.max(360, chart.values.length * 65),
                  height: 230,
                }}
              >
                <line
                  x1={25}
                  y1={190}
                  x2={Math.max(360, chart.values.length * 65) - 10}
                  y2={190}
                  stroke="currentColor"
                />
                {kind === "line" && (
                  <polyline
                    fill="none"
                    stroke="#2761a2"
                    strokeWidth={3}
                    points={chart.values
                      .map(
                        (v, i) =>
                          `${40 + i * ((Math.max(360, chart.values.length * 65) - 70) / Math.max(1, chart.values.length - 1))},${190 - (v.count / max) * 150}`,
                      )
                      .join(" ")}
                  />
                )}
                {chart.values.map((v, i) => {
                  const x =
                    40 +
                    i *
                      ((Math.max(360, chart.values.length * 65) - 70) /
                        Math.max(1, chart.values.length - 1));
                  const y = 190 - (v.count / max) * 150;
                  return (
                    <g key={v.label}>
                      <title>
                        {label(v.label)}: {v.count} {unit}
                      </title>
                      {kind === "line" ? (
                        <circle cx={x} cy={y} r={4} fill="#2761a2" />
                      ) : (
                        <rect
                          x={x - 14}
                          y={y}
                          width={28}
                          height={190 - y}
                          fill={colors[i % colors.length]}
                        />
                      )}
                      <text
                        x={x}
                        y={y - 8}
                        textAnchor="middle"
                        fontSize={12}
                        fill="currentColor"
                      >
                        {v.count}
                      </text>
                      <text
                        x={x}
                        y={210}
                        textAnchor="middle"
                        fontSize={10}
                        fill="currentColor"
                      >
                        {i + 1}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <p className="muted">
                Los números del eje corresponden a las categorías del listado
                inferior. Eje vertical: cantidad de {unit}.
              </p>
            </div>
          )}
          <h4>Leyenda: qué representa cada color</h4>
          <p className="muted">
            {kind === "line"
              ? `La línea azul muestra la cantidad de ${unit} en cada categoría.`
              : dated
                ? `Los colores distinguen las fechas de creación de los registros; no indican su estado ni su prioridad.`
                : `Cada color identifica una categoría del listado.`}
          </p>
          {chart.values.map((v, i) => (
            <div key={v.label} className="chart-count">
              <span>
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    marginRight: 8,
                    background:
                      kind === "line" ? colors[0] : colors[i % colors.length],
                  }}
                />
                {["line", "columns"].includes(kind) ? `${i + 1}. ` : ""}
                {label(v.label)}:{" "}
                <strong>
                  {v.count} {unit}
                </strong>
              </span>
              {kind === "bars" ? (
                <div
                  style={{
                    height: 12,
                    borderRadius: 6,
                    background: colors[i % colors.length],
                    width: `${(v.count / max) * 100}%`,
                  }}
                />
              ) : (
                <span> ({Math.round((v.count / total) * 100)}%)</span>
              )}
            </div>
          ))}
          <p>Total: {total}</p>
        </>
      )}
    </article>
  );
}
export function WorkforceAI({
  mode,
  taskId,
  employeeId,
  section,
  filters = {},
}: {
  mode: "chart" | "profile" | "onboarding" | "tasks";
  taskId?: string;
  employeeId?: string;
  section?: "performance" | "analytics";
  filters?: WorkspaceFilters;
}) {
  const [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<{
    summary: string;
    recommendations?: string[];
    charts?: Graph[];
  } | null>(null);
  async function analyze() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const allowed = Object.fromEntries(
        Object.entries(filters).filter(([key]) =>
          [
            "department",
            "employee",
            "employees",
            "days",
            "process",
            "query",
          ].includes(key),
        ),
      );
      const r = await request("/api/ai/workforce", {
        mode,
        employee_id: employeeId,
        task_id: taskId,
        section,
        prompt,
        filters: allowed,
      });
      setResult(r.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo analizar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>
        {mode === "tasks"
          ? "Pregunta a la IA sobre tareas y evidencias"
          : mode === "chart"
            ? "Gráficas a partir de tus instrucciones"
            : mode === "profile"
              ? "Resumen de esta persona con IA"
              : "Resumen de incorporación con IA"}
      </h2>
      <p>
        {mode === "tasks"
          ? taskId
            ? "Consulta el estado, plazo y evidencias registradas de esta tarea. Para evaluar un archivo, utiliza su análisis específico."
            : "Pregunta por pendientes, plazos, prioridades y evidencias registradas del equipo visible. Se respetan tus filtros y permisos."
          : mode === "chart"
            ? "Describe lo que necesitas comparar: tareas, capacitación o incorporaciones, por estado o área. Se respetan los filtros y tus permisos."
            : "Resumen de avances y pendientes del ámbito autorizado. La interpretación requiere revisión humana."}
      </p>
      <label>
        Instrucciones de análisis
        <textarea
          maxLength={1500}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={
            mode === "tasks"
              ? "¿Qué tareas necesitan atención y cuáles tienen evidencias entregadas?"
              : mode === "chart"
                ? "Compara las incorporaciones por estado en una gráfica de barras"
                : "Resume avances y próximos pasos"
          }
        />
      </label>
      <button disabled={busy} onClick={() => void analyze()}>
        {busy
          ? "Analizando…"
          : mode === "tasks"
            ? "Preguntar a la IA"
            : mode === "chart"
              ? "Generar gráficas"
              : "Generar resumen"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result && (
        <>
          <p>{result.summary}</p>
          {result.recommendations?.map((r, i) => (
            <p key={i}>• {r}</p>
          ))}
          <div className="record-grid">
            {result.charts?.map((c, i) => (
              <DataGraph key={i} chart={c} />
            ))}
          </div>
          <small>
            Conteos del conjunto visible cargado (máximo 1000 registros por
            tabla). No equivalen a una evaluación integral de desempeño.
          </small>
        </>
      )}
    </section>
  );
}

export function StaffEnrollment({
  data,
  superuser = false,
  onSaved,
}: {
  data: Snapshot;
  superuser?: boolean;
  onSaved: () => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const candidates = (data.profiles ?? []).filter(
    (p) =>
      p.active &&
      (p.role !== "RH_ADMIN" || superuser) &&
      ["RH_ADMIN", "JEFE", "EMPLEADO"].includes(value(p, "role")) &&
      !(data.employees ?? []).some((e) => e.profile_id === p.id),
  );
  return (
    <details className="panel">
      <summary>Incorporar personal y RH al organigrama</summary>
      <p>
        Asigna un puesto a las cuentas existentes. Después podrás establecer su
        superior desde el árbol. El alta inicial de responsables de RH en el
        organigrama corresponde al superusuario.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMessage("");
          const f = new FormData(e.currentTarget);
          try {
            await request("/api/commands", {
              op: "employee.enroll",
              payload: {
                profile_id: f.get("profile_id"),
                position_id: f.get("position_id"),
                manager_id: "",
              },
            });
            setMessage(
              "Integrante incorporado. Ya puedes asignar su superior.",
            );
            onSaved();
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "No se pudo guardar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Cuenta
          <select name="profile_id" required>
            <option value="">Selecciona una cuenta</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {value(p, "full_name")} · {stateLabel(value(p, "role"))}
              </option>
            ))}
          </select>
        </label>
        <label>
          Puesto
          <select name="position_id" required>
            <option value="">Selecciona un puesto</option>
            {(data.positions ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {value(p, "name")}
              </option>
            ))}
          </select>
        </label>
        <button disabled={busy || !candidates.length}>
          Añadir al organigrama
        </button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}

export function TrainingAssistant({
  data,
  onSaved,
}: {
  data: Snapshot;
  onSaved: () => void;
}) {
  const [position, setPosition] = useState(""),
    [description, setDescription] = useState(""),
    [area, setArea] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [draft, setDraft] = useState<{
    title: string;
    description: string;
    content: string;
    duration_minutes: number;
  } | null>(null);
  return (
    <details className="panel">
      <summary>Crear capacitación gratuita con IA</summary>
      <p>
        Genera lecciones y ejercicios para impartir aquí. Revisa el contenido
        antes de guardarlo como plantilla reutilizable.
      </p>
      <fieldset disabled={busy}>
        <label>
          Área
          <select
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setPosition("");
              setDraft(null);
            }}
          >
            <option value="">Todas las áreas</option>
            {(data.departments ?? []).map((d) => (
              <option value={d.id} key={d.id}>
                {value(d, "name")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Puesto
          <select
            value={position}
            required
            onChange={(e) => {
              setPosition(e.target.value);
              setDraft(null);
            }}
          >
            <option value="">Selecciona el puesto</option>
            {(data.positions ?? [])
              .filter((p) => !area || p.department_id === area)
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {value(p, "name")}
                </option>
              ))}
          </select>
        </label>
        <label>
          Objetivos o necesidades
          <textarea
            maxLength={1500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button
          disabled={!position}
          onClick={async () => {
            setBusy(true);
            setMessage("");
            try {
              const r = await request("/api/ai/workforce", {
                mode: "training",
                position_id: position,
                prompt: description,
              });
              setDraft(trainingDraft.parse(r.result));
            } catch (e) {
              setMessage(
                e instanceof Error ? e.message : "No se pudo generar.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Crear borrador recomendado
        </button>
        {draft && (
          <>
            <label>
              Título
              <input
                maxLength={150}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <label>
              Descripción
              <textarea
                value={draft.description}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
              />
            </label>
            <label>
              Lecciones, ejercicios y criterios
              <textarea
                rows={14}
                value={draft.content}
                onChange={(e) =>
                  setDraft({ ...draft, content: e.target.value })
                }
              />
            </label>
            <label>
              Duración (minutos)
              <input
                type="number"
                min={5}
                max={10000}
                value={draft.duration_minutes}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    duration_minutes: Number(e.target.value),
                  })
                }
              />
            </label>
            <button
              onClick={async () => {
                setBusy(true);
                setMessage("");
                try {
                  await request("/api/commands", {
                    op: "course.save",
                    payload: {
                      ...trainingDraft.parse(draft),
                      department_id: area,
                      position_id: position,
                      required: false,
                    },
                  });
                  setDraft(null);
                  setMessage(
                    "Plantilla guardada. Puedes buscarla y asignarla desde el catálogo.",
                  );
                  onSaved();
                } catch (e) {
                  setMessage(
                    e instanceof Error ? e.message : "No se pudo guardar.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Guardar plantilla revisada
            </button>
          </>
        )}
      </fieldset>
      {message && <p role="status">{message}</p>}
    </details>
  );
}

export function TrainingProgress({
  data,
  profile,
  onSaved,
}: {
  data: Snapshot;
  profile: Profile;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState("REVIEW"),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const person = (id: unknown) => {
    const e = (data.employees ?? []).find((e) => e.id === id);
    return (data.profiles ?? []).find((p) => p.id === e?.profile_id);
  };
  const rows = (data.course_assignments ?? []).filter(
    (a) =>
      (!status ||
        (status === "REVIEW"
          ? a.progress_review_pending || a.status === "SUBMITTED"
          : a.status === status)) &&
      (
        value(person(a.employee_id) ?? { id: "" }, "full_name") +
        " " +
        value(
          (data.courses ?? []).find((c) => c.id === a.course_id) ?? { id: "" },
          "title",
        )
      )
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  return (
    <section className="panel">
      <h2>Seguimiento y revisión de capacitaciones</h2>
      <label>
        Buscar persona o curso
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label>
        Estado
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="REVIEW">Avances pendientes de revisión</option>
          {["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"].map((s) => (
            <option key={s} value={s}>
              {s === "COMPLETED" ? "Historial de completadas" : stateLabel(s)}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {rows.map((a) => (
        <article className="record" key={a.id}>
          <Link href={`${home[profile.role]}/employees/${a.employee_id}`}>
            {value(person(a.employee_id) ?? { id: "" }, "full_name")}
          </Link>
          <h3>
            {value(
              (data.courses ?? []).find((c) => c.id === a.course_id) ?? {
                id: "",
              },
              "title",
            )}
          </h3>
          <p>
            {stateLabel(value(a, "status"))} · {value(a, "progress")}%
          </p>
          <p>{value(a, "review_comments")}</p>
          {a.progress_review_pending === true && (
            <p role="status">
              Nuevo avance o evidencia pendiente de revisión · Último porcentaje
              aprobado: {Number(a.approved_progress) || 0}%
            </p>
          )}
          <TrainingEvidence
            assignmentId={a.id}
            progress={Number(a.progress)}
            status={value(a, "status")}
            own={person(a.employee_id)?.id === profile.id}
            canReview={
              (isHR(profile.role) || profile.role === "JEFE") &&
              person(a.employee_id)?.id !== profile.id
            }
            onSaved={onSaved}
          />
          {(a.progress_review_pending || a.status === "SUBMITTED") &&
            (isHR(profile.role) || profile.role === "JEFE") &&
            person(a.employee_id)?.id !== profile.id && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setBusy(true);
                  setError("");
                  try {
                    const response = await fetch("/api/training", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        assignment: a.id,
                        decision: f.get("decision"),
                        percentage: Number(f.get("percentage")),
                        comments: f.get("comments"),
                      }),
                    });
                    const result = await response.json();
                    if (!response.ok)
                      throw new Error(
                        result.error || "No se pudo guardar la revisión.",
                      );
                    onSaved();
                  } catch (e) {
                    setError(
                      e instanceof Error ? e.message : "No se pudo revisar.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Comprobación del avance
                  <textarea name="comments" required maxLength={2000} />
                </label>
                <label>
                  Resultado
                  <select name="decision">
                    <option value="ACCEPT">Aceptar avance</option>
                    <option value="REJECT">
                      Rechazar y solicitar correcciones
                    </option>
                  </select>
                </label>
                <label>
                  Porcentaje validado (%)
                  <input
                    name="percentage"
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={Number(a.progress)}
                    required
                  />
                </label>
                <p>
                  Al aceptar puedes ajustar el porcentaje respaldado por las
                  evidencias. Solo el 100% aceptado completa la capacitación. Al
                  rechazar, indica el último porcentaje aprobado o uno menor y
                  explica qué debe corregirse.
                </p>
                <button disabled={busy}>Guardar revisión</button>
              </form>
            )}
        </article>
      ))}
      {!rows.length && (
        <p>No hay capacitaciones en este estado con los filtros actuales.</p>
      )}
    </section>
  );
}
