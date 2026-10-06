"use client";
/**
 * @file Gestión de planes, plantillas y actividades de incorporación con entrega y revisión. Separa
 * acciones del colaborador y del responsable y mantiene visibles avances e historial.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Planes y documentos sobre el conjunto ya autorizado por RLS y los filtros de la vista. */
import { WorkforceAI } from "./workforce-tools";
import { OnboardingLearning } from "./onboarding-learning";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { request, Upload } from "./forms";
import { isHR } from "@/lib/permissions";
import {
  type Snapshot,
  type Profile,
  type Row,
  value,
} from "@/modules/workspace/types";
import { stateLabel } from "@/modules/workspace/labels";
import { planSchema, type Plan } from "@/modules/onboarding/schemas";
const owners = {
  EMPLOYEE: "Persona incorporada",
  MANAGER: "Jefatura del equipo",
  HR: "Recursos Humanos",
};
const initial: Plan = {
  title: "Plan de incorporación",
  steps: [
    {
      title: "Bienvenida al equipo",
      description: "Presentación y objetivos del puesto",
      owner_role: "MANAGER",
      days: 1,
      requires_document: false,
    },
  ],
};
export function OnboardingPanel({
  data,
  profile,
  detail,
}: {
  data: Snapshot;
  profile: Profile;
  detail?: string;
}) {
  const router = useRouter();
  const [history, setHistory] = useState(false);
  const [search, setSearch] = useState("");
  const [pendingReview, setPendingReview] = useState(false);
  const [section, setSection] = useState("follow");
  const [newEmployee, setNewEmployee] = useState("");
  const hr = isHR(profile.role),
    manager = profile.role === "JEFE";
  const [templates, setTemplates] = useState<Row[]>([]),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Plan>(initial),
    [position, setPosition] = useState(""),
    [department, setDepartment] = useState(""),
    [context, setContext] = useState("");
  const [target, setTarget] = useState(""),
    [template, setTemplate] = useState(""),
    [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    if (!hr && !manager) return;
    let active = true;
    fetch("/api/onboarding-plans")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (active) setTemplates(body.templates);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [hr, manager, notice]);
  const name = (id: unknown) =>
    value(
      (data.profiles ?? []).find((p) => p.id === id) ?? { id: "" },
      "full_name",
    ) || "Persona";
  const processes = (data.onboarding ?? []).filter(
    (o) => !detail || o.id === detail,
  );
  const employee = (o: Row) =>
    (data.employees ?? []).find((e) => e.id === o.employee_id);
  // La búsqueda solo reduce procesos previamente autorizados; no amplía el alcance del rol.
  const visibleProcesses = processes
    .filter((o) => detail || (o.status === "COMPLETED") === history)
    .filter((o) =>
      name(employee(o)?.profile_id)
        .toLocaleLowerCase("es")
        .includes(search.trim().toLocaleLowerCase("es")),
    )
    .filter(
      (o) =>
        history ||
        !pendingReview ||
        (data.onboarding_items ?? []).some(
          (i) => i.onboarding_id === o.id && i.status === "SUBMITTED",
        ),
    );
  const canManage = (o: Row) =>
    hr || (manager && employee(o)?.profile_id !== profile.id);
  const today = new Date().toISOString().slice(0, 10);
  const late = (data.onboarding_items ?? []).filter(
    (i) =>
      processes.some((o) => o.id === i.onboarding_id) &&
      i.status !== "COMPLETED" &&
      value(i, "due_date") &&
      value(i, "due_date") < today,
  );
  async function execute(op: string, payload: unknown) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await request("/api/onboarding-plans", { op, payload });
      if (op === "ai.draft") {
        setDraft(planSchema.parse(result.draft));
        setNotice(
          "Borrador generado. Revisa cada actividad antes de guardarlo o asignarlo.",
        );
      } else {
        if (op === "plan.start" && result.id) setTarget(result.id);
        setNotice("Cambios guardados.");
        router.refresh();
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function openDocument(id: string) {
    try {
      const r = await fetch(`/api/files?bucket=onboarding-documents&id=${id}`);
      const b = await r.json();
      if (!r.ok) throw new Error(b.error);
      window.open(b.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Documento no disponible.");
    }
  }
  return (
    <section className="onboarding-workspace">
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="onboarding-overview">
        <span className="org-eyebrow">ACOMPAÑA CADA NUEVO COMIENZO</span>
        <h2>Seguimiento de incorporaciones</h2>
        <p>
          Consulta el avance de cada persona, revisa sus entregas y organiza sus
          próximos pasos.
        </p>
        <div className="onboarding-metrics">
          <div>
            <strong>
              {processes.filter((o) => o.status !== "COMPLETED").length}
            </strong>
            <span>En incorporación</span>
          </div>
          <div>
            <strong>
              {
                (data.onboarding_items ?? []).filter(
                  (i) =>
                    i.status === "SUBMITTED" &&
                    processes.some((o) => o.id === i.onboarding_id),
                ).length
              }
            </strong>
            <span>Actividades por revisar</span>
          </div>
          <div data-warning={late.length > 0}>
            <strong>{late.length}</strong>
            <span>Actividades fuera de plazo</span>
          </div>
          <div>
            <strong>
              {processes.filter((o) => o.status === "COMPLETED").length}
            </strong>
            <span>Procesos completados</span>
          </div>
        </div>
        {late.length > 0 && (
          <details className="onboarding-late">
            <summary>
              Consultar actividades fuera de plazo ({late.length})
            </summary>
            <ul>
              {late.map((i) => (
                <li key={i.id}>
                  <a
                    href={`#onboarding-${i.onboarding_id}`}
                    onClick={() => {
                      setSection("follow");
                      setHistory(false);
                      setSearch("");
                      setPendingReview(false);
                    }}
                  >
                    {value(i, "title")}
                  </a>{" "}
                  · Venció el {value(i, "due_date")}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      {(hr || manager) && (
        <div className="module-tabs" aria-label="Vistas de incorporación">
          {[
            ["follow", "Seguimiento"],
            ["assign", "Asignar actividades"],
            ["templates", "Crear plantillas"],
            ...(hr ? [["ai", "Resumen IA"]] : []),
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={section === id}
              className={section === id ? "" : "secondary"}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {(hr || manager) && (
        <section
          className="panel onboarding-plan-assignment"
          hidden={section !== "assign"}
        >
          <h2>Asignar un plan de actividades</h2>
          <p>
            Elige al colaborador, una plantilla guardada y la fecha de inicio.
            También puedes usar el borrador de Crear plantillas.
          </p>
          <fieldset disabled={busy} className="onboarding-assignment">
            <label>
              1. Selecciona la persona
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Selecciona una persona</option>
                {processes
                  .filter((o) => canManage(o) && o.status !== "COMPLETED")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {name(employee(o)?.profile_id)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              2. Elige el plan de actividades
              <select
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
              >
                <option value="">Borrador de Crear plantillas</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {value(t, "title")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              3. Define la fecha de inicio
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <details open className="onboarding-plan-preview">
              <summary>Vista previa de actividades</summary>
              <ol>
                {(template
                  ? (planSchema.safeParse({
                      title: templates.find((t) => t.id === template)?.title,
                      steps: templates.find((t) => t.id === template)?.steps,
                    }).data?.steps ?? [])
                  : draft.steps
                ).map((step, i) => (
                  <li key={i}>
                    <strong>{step.title}</strong> · {owners[step.owner_role]} ·{" "}
                    {step.days} días{" "}
                    {step.requires_document ? "· Requiere documento" : ""}
                  </li>
                ))}
              </ol>
            </details>
            <button
              disabled={!target || !start}
              onClick={() =>
                void execute("plan.apply", {
                  id: target,
                  start_date: start,
                  ...(template
                    ? { template_id: template }
                    : { steps: draft.steps }),
                })
              }
            >
              Asignar plan revisado
            </button>
            <p>
              Solo se reemplazan planes sin avances ni documentos. Para los que
              ya comenzaron puedes ajustar responsables y fechas.
            </p>
          </fieldset>
        </section>
      )}
      {(hr || manager) && (
        <details className="panel" open hidden={section !== "templates"}>
          <summary>
            Plantillas y planes revisables · Crear con IA o manualmente
          </summary>
          <fieldset disabled={busy}>
            {hr && (
              <label>
                Área de la plantilla
                <select
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setPosition("");
                  }}
                >
                  <option value="">Todas las áreas</option>
                  {(data.departments ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {value(d, "name")}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Puesto
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="">
                  General (selecciona un puesto para usar IA)
                </option>
                {(data.positions ?? [])
                  .filter(
                    (p) =>
                      (!department || p.department_id === department) &&
                      (hr ||
                        (data.employees ?? []).some(
                          (e) =>
                            e.position_id === p.id &&
                            e.profile_id !== profile.id,
                        )),
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {value(p, "name")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Objetivos para la IA
              <textarea
                value={context}
                maxLength={1500}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Describe actividades y objetivos del puesto; evita nombres, documentos y datos personales."
              />
            </label>
            <button
              className="ai-button"
              disabled={!position || busy}
              onClick={() =>
                void execute("ai.draft", { position_id: position, context })
              }
            >
              ✧ Proponer plan con IA
            </button>
            <label>
              Nombre del plan
              <input
                value={draft.title}
                maxLength={160}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            {draft.steps.map((step, index) => (
              <div className="record" key={index}>
                <h3>Actividad {index + 1}</h3>
                <label>
                  Título
                  <input
                    value={step.title}
                    maxLength={160}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        steps: draft.steps.map((s, j) =>
                          j === index ? { ...s, title: e.target.value } : s,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Indicaciones
                  <textarea
                    value={step.description}
                    maxLength={2000}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        steps: draft.steps.map((s, j) =>
                          j === index
                            ? { ...s, description: e.target.value }
                            : s,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  Responsable
                  <select
                    value={step.owner_role}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        steps: draft.steps.map((s, j) =>
                          j === index
                            ? {
                                ...s,
                                owner_role: e.target
                                  .value as keyof typeof owners,
                              }
                            : s,
                        ),
                      })
                    }
                  >
                    {Object.entries(owners).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Días desde el inicio
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={step.days}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        steps: draft.steps.map((s, j) =>
                          j === index
                            ? { ...s, days: Number(e.target.value) }
                            : s,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={step.requires_document}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        steps: draft.steps.map((s, j) =>
                          j === index
                            ? { ...s, requires_document: e.target.checked }
                            : s,
                        ),
                      })
                    }
                  />{" "}
                  Requiere al menos un documento del expediente aprobado por RH
                </label>
                <button
                  className="secondary"
                  disabled={draft.steps.length === 1}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      steps: draft.steps.filter((_, j) => j !== index),
                    })
                  }
                >
                  Quitar actividad
                </button>
              </div>
            ))}
            <button
              className="secondary"
              disabled={draft.steps.length >= 30}
              onClick={() =>
                setDraft({
                  ...draft,
                  steps: [
                    ...draft.steps,
                    {
                      title: "Nueva actividad",
                      description: "",
                      owner_role: "EMPLOYEE",
                      days: 7,
                      requires_document: false,
                    },
                  ],
                })
              }
            >
              Añadir actividad
            </button>
            {hr && (
              <button
                onClick={() =>
                  void execute("template.save", {
                    ...draft,
                    position_id: position || null,
                    department_id: department || null,
                  })
                }
              >
                Guardar plantilla para nuevas contrataciones
              </button>
            )}
            <p>
              Se aplica automáticamente la plantilla activa del puesto, o del
              área si no hay una específica. Los responsables se resuelven según
              la persona contratada y su jefatura actual. RH atiende las
              actividades de Recursos Humanos.
            </p>
            {hr &&
              templates.map((t) => (
                <div className="list-line" key={t.id}>
                  <span>{value(t, "title")}</span>
                  <button
                    className="secondary"
                    onClick={() => {
                      const parsed = planSchema.safeParse({
                        title: t.title,
                        steps: t.steps,
                      });
                      if (parsed.success) {
                        setDraft(parsed.data);
                        setPosition(value(t, "position_id"));
                        setDepartment(value(t, "department_id"));
                        setNotice(
                          "Plantilla cargada para editar. Desactiva la anterior antes de guardar su reemplazo.",
                        );
                      }
                    }}
                  >
                    Editar copia
                  </button>
                  <button
                    className="secondary"
                    onClick={() =>
                      void execute("template.disable", { id: t.id })
                    }
                  >
                    Desactivar
                  </button>
                </div>
              ))}
          </fieldset>
        </details>
      )}
      {hr && (
        <>
          {processes.length > 0 && section === "ai" && (
            <WorkforceAI
              key={processes.map((o) => o.id).join(",")}
              mode="onboarding"
              filters={{
                employees: processes.map((o) => String(o.employee_id)),
              }}
            />
          )}
          <form
            className="panel onboarding-start-process"
            hidden={section !== "assign"}
            onSubmit={async (e) => {
              e.preventDefault();
              if (await execute("plan.start", { employee_id: newEmployee }))
                setNewEmployee("");
            }}
          >
            <h2>Iniciar incorporación de un colaborador</h2>
            <label>
              Colaborador nuevo
              <select
                required
                value={newEmployee}
                onChange={(e) => setNewEmployee(e.target.value)}
              >
                <option value="">Selecciona una persona</option>
                {(data.employees ?? [])
                  .filter(
                    (e) =>
                      e.status === "ACTIVE" &&
                      !(data.onboarding ?? []).some(
                        (o) => o.employee_id === e.id,
                      ),
                  )
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {name(e.profile_id)}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={busy || !newEmployee}>
              Crear tareas de incorporación
            </button>
          </form>
        </>
      )}
      <div hidden={section !== "follow"}>
        <div className="onboarding-follow-tools">
          {!detail && (
            <div className="actions">
              <button
                className={history ? "secondary" : ""}
                aria-pressed={!history}
                onClick={() => setHistory(false)}
              >
                Procesos en curso (
                {processes.filter((o) => o.status !== "COMPLETED").length})
              </button>
              <button
                className={history ? "" : "secondary"}
                aria-pressed={history}
                onClick={() => setHistory(true)}
              >
                Historial de incorporaciones (
                {processes.filter((o) => o.status === "COMPLETED").length})
              </button>
            </div>
          )}
          <label>
            Buscar persona
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Escribe un nombre…"
            />
          </label>
          {!history && (
            <label className="onboarding-review-filter">
              <input
                type="checkbox"
                checked={pendingReview}
                onChange={(e) => setPendingReview(e.target.checked)}
              />
              Solo con actividades por revisar
            </label>
          )}
        </div>
        <div className="onboarding-process-list">
          {visibleProcesses.map((o) => {
            const e = employee(o),
              own = e?.profile_id === profile.id,
              manages = canManage(o);
            const items = (data.onboarding_items ?? []).filter(
              (i) => i.onboarding_id === o.id,
            );
            const docs = (data.onboarding_documents ?? []).filter(
              (d) => d.onboarding_id === o.id,
            );
            const pct = items.length
              ? Math.round(
                  (items.filter((i) => i.status === "COMPLETED").length /
                    items.length) *
                    100,
                )
              : 0;
            const next = items
              .filter((i) => i.status !== "COMPLETED")
              .sort((a, b) =>
                value(a, "due_date").localeCompare(value(b, "due_date")),
              )[0];
            const boss = (data.employees ?? []).find(
              (m) => m.id === e?.manager_id,
            );
            return (
              <article
                className="record onboarding-person"
                key={o.id}
                id={`onboarding-${o.id}`}
              >
                <div className="onboarding-person-heading">
                  <div className="onboarding-initials" aria-hidden="true">
                    {name(e?.profile_id)
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </div>
                  <div>
                    <h2>{name(e?.profile_id)}</h2>
                    <p>
                      {items.filter((i) => i.status === "COMPLETED").length} de{" "}
                      {items.length} actividades completadas
                    </p>
                  </div>
                  <span className="badge">
                    {stateLabel(value(o, "status"))}
                  </span>
                </div>
                <p>{pct}% completado</p>
                <progress
                  max={100}
                  value={pct}
                  aria-label={`Avance de ${name(e?.profile_id)}`}
                />
                {next && (
                  <p className="onboarding-next">
                    <strong>Siguiente paso:</strong> {value(next, "title")}
                  </p>
                )}
                <details open={!!detail} className="onboarding-activities">
                  <summary>
                    Ver actividades y documentos ({items.length})
                  </summary>
                  {items
                    .filter((i) => i.status !== "COMPLETED")
                    .map((i) => {
                      const owner = (value(i, "owner_role") ||
                        "EMPLOYEE") as keyof typeof owners;
                      const canComplete =
                        (hr && owner === "HR") ||
                        (owner === "EMPLOYEE" && own) ||
                        (owner === "MANAGER" && manages);
                      const overdue =
                        i.status !== "COMPLETED" &&
                        value(i, "due_date") &&
                        value(i, "due_date") < today;
                      return (
                        <details className="onboarding-activity" key={i.id}>
                          <summary>
                            <span>
                              <strong>{value(i, "title")}</strong>
                              <small>
                                {owners[owner]} · Fecha límite:{" "}
                                {value(i, "due_date") || "Sin fecha"}
                              </small>
                            </span>
                            <span className="badge">
                              {stateLabel(value(i, "status"))}
                            </span>
                          </summary>
                          <div className="onboarding-activity-body">
                            <p>{value(i, "description")}</p>
                            {owner === "EMPLOYEE" && (
                              <OnboardingLearning
                                id={i.id}
                                manage={
                                  manages &&
                                  ["PENDING", "IN_PROGRESS"].includes(
                                    value(i, "status"),
                                  )
                                }
                                own={
                                  own &&
                                  ["PENDING", "IN_PROGRESS"].includes(
                                    value(i, "status"),
                                  )
                                }
                              />
                            )}
                            <p>
                              {owners[owner]}
                              {owner === "EMPLOYEE"
                                ? `: ${name(e?.profile_id)}`
                                : owner === "MANAGER"
                                  ? `: ${boss ? name(boss.profile_id) : "Sin jefe asignado; RH debe asignarlo"}`
                                  : ""}
                            </p>
                            <p>
                              {stateLabel(value(i, "status"))} · Fecha límite:{" "}
                              {value(i, "due_date") || "Sin fecha"}
                            </p>
                            {overdue && (
                              <p className="error">Actividad atrasada</p>
                            )}
                            {Boolean(i.requires_document) && (
                              <p>
                                Requiere documentos de esta actividad, revisados
                                por RH.
                              </p>
                            )}
                            {["PENDING", "IN_PROGRESS"].includes(
                              value(i, "status"),
                            ) &&
                              canComplete && (
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    void execute("item.complete", { id: i.id })
                                  }
                                >
                                  Marcar realizada y enviar a RH
                                </button>
                              )}
                            {own &&
                              ["PENDING", "IN_PROGRESS"].includes(
                                value(i, "status"),
                              ) && (
                                <Upload
                                  bucket="onboarding-documents"
                                  id={o.id}
                                  itemId={i.id}
                                  multiple
                                  onSaved={() => router.refresh()}
                                />
                              )}
                            <p>{value(i, "review_comments")}</p>
                            {hr &&
                              (!own || profile.role === "SUPERUSER") &&
                              i.status === "SUBMITTED" && (
                                <form
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const f = new FormData(event.currentTarget);
                                    void execute("item.review", {
                                      id: i.id,
                                      status: f.get("status"),
                                      comments: f.get("comments"),
                                    });
                                  }}
                                >
                                  <label>
                                    Comprobación de RH
                                    <textarea
                                      name="comments"
                                      required
                                      maxLength={2000}
                                    />
                                  </label>
                                  <label>
                                    Resultado
                                    <select name="status">
                                      <option value="COMPLETED">
                                        Confirmar y guardar en historial
                                      </option>
                                      <option value="IN_PROGRESS">
                                        Solicitar correcciones
                                      </option>
                                    </select>
                                  </label>
                                  <button disabled={busy}>
                                    Revisar actividad
                                  </button>
                                </form>
                              )}
                            {["PENDING", "IN_PROGRESS"].includes(
                              value(i, "status"),
                            ) &&
                              manages && (
                                <form
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    const f = new FormData(event.currentTarget);
                                    void execute("item.save", {
                                      id: i.id,
                                      owner_role: f.get("owner_role"),
                                      due_date: f.get("due_date"),
                                    });
                                  }}
                                >
                                  <label>
                                    Responsable
                                    <select
                                      name="owner_role"
                                      defaultValue={owner}
                                    >
                                      {Object.entries(owners).map(([v, l]) => (
                                        <option key={v} value={v}>
                                          {l}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label>
                                    Fecha límite
                                    <input
                                      name="due_date"
                                      type="date"
                                      required
                                      defaultValue={value(i, "due_date")}
                                    />
                                  </label>
                                  <button className="secondary" disabled={busy}>
                                    Guardar responsable y fecha
                                  </button>
                                </form>
                              )}
                          </div>
                        </details>
                      );
                    })}
                  <details>
                    <summary>
                      Historial de actividades aprobadas (
                      {items.filter((i) => i.status === "COMPLETED").length})
                    </summary>
                    {items
                      .filter((i) => i.status === "COMPLETED")
                      .map((i) => (
                        <article className="record" key={i.id}>
                          <h3>{value(i, "title")}</h3>
                          <p>{value(i, "description")}</p>
                          <p>{value(i, "review_comments")}</p>
                          <p>Completada: {value(i, "completed_at")}</p>
                        </article>
                      ))}
                  </details>
                  {(own || hr) && (
                    <>
                      <h3>Documentos privados</h3>
                      <p>
                        RH revisa los documentos. Si solicita correcciones, sube
                        una nueva versión; la anterior se conserva.
                      </p>

                      {docs.length === 0 && (
                        <p>Documentación pendiente de entrega.</p>
                      )}
                      {docs.map((d, index) => (
                        <div className="record" key={d.id}>
                          <button
                            className="secondary"
                            onClick={() => void openDocument(d.id)}
                          >
                            Ver documento {index + 1} ·{" "}
                            {value(
                              items.find((i) => i.id === d.item_id) ?? {
                                id: "",
                              },
                              "title",
                            ) || "Expediente anterior"}
                          </button>
                          <p>{stateLabel(value(d, "status") || "SUBMITTED")}</p>
                          <p>{value(d, "comments")}</p>
                          {hr && (d.status === "SUBMITTED" || !d.status) && (
                            <form
                              onSubmit={(event) => {
                                event.preventDefault();
                                const f = new FormData(event.currentTarget);
                                void execute("document.review", {
                                  id: d.id,
                                  status: f.get("status"),
                                  comments: f.get("comments"),
                                });
                              }}
                            >
                              <label>
                                Resultado
                                <select name="status">
                                  <option value="APPROVED">Aprobado</option>
                                  <option value="REJECTED">
                                    Solicitar correcciones
                                  </option>
                                </select>
                              </label>
                              <label>
                                Comentarios
                                <textarea
                                  name="comments"
                                  required
                                  maxLength={2000}
                                />
                              </label>
                              <button disabled={busy}>Guardar revisión</button>
                            </form>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </details>
              </article>
            );
          })}
        </div>
        {!visibleProcesses.length && (
          <p className="onboarding-empty" role="status">
            No hay incorporaciones con estos filtros. Prueba otro nombre o
            cambia la vista.
          </p>
        )}
      </div>
    </section>
  );
}
