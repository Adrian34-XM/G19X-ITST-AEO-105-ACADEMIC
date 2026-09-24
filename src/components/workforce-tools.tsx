"use client";
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
  values: { label: string; count: number }[];
};
export function DataGraph({ chart }: { chart: Graph }) {
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
      {!total ? (
        <p>Sin datos con estos filtros.</p>
      ) : (
        <>
          {chart.kind === "pie" && (
            <div
              role="img"
              aria-label={`${chart.title}: ${chart.values.map((v) => `${v.label} ${v.count}`).join(", ")}`}
              style={{
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: `conic-gradient(${slices.join(",")})`,
                margin: "12px auto",
              }}
            />
          )}
          {chart.values.map((v, i) => (
            <div key={v.label} className="chart-count">
              <span>
                {v.label}: <strong>{v.count}</strong>
              </span>
              {chart.kind === "bars" ? (
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
  employeeId,
  section,
  filters = {},
}: {
  mode: "chart" | "profile" | "onboarding";
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
        {mode === "chart"
          ? "Gráficas a partir de tus instrucciones"
          : mode === "profile"
            ? "Resumen de esta persona con IA"
            : "Resumen de incorporación con IA"}
      </h2>
      <p>
        {mode === "chart"
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
            mode === "chart"
              ? "Compara las incorporaciones por estado en una gráfica de barras"
              : "Resume avances y próximos pasos"
          }
        />
      </label>
      <button disabled={busy} onClick={() => void analyze()}>
        {busy
          ? "Analizando…"
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
  const [status, setStatus] = useState("SUBMITTED"),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const person = (id: unknown) => {
    const e = (data.employees ?? []).find((e) => e.id === id);
    return (data.profiles ?? []).find((p) => p.id === e?.profile_id);
  };
  const rows = (data.course_assignments ?? []).filter(
    (a) =>
      (!status || a.status === status) &&
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
          {a.status === "SUBMITTED" &&
            (isHR(profile.role) || profile.role === "JEFE") &&
            person(a.employee_id)?.id !== profile.id && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setBusy(true);
                  setError("");
                  try {
                    await request("/api/commands", {
                      op: "course.review",
                      payload: {
                        id: a.id,
                        status: f.get("status"),
                        comments: f.get("comments"),
                      },
                    });
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
                  <select name="status">
                    <option value="COMPLETED">Confirmar finalización</option>
                    <option value="IN_PROGRESS">Solicitar correcciones</option>
                  </select>
                </label>
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
