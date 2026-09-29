"use client";
/**
 * @file Creación, asignación y respuesta de encuestas, comentarios anónimos y análisis de clima.
 * Separa la administración de encuestas de las pendientes del usuario y respeta los requisitos de
 * agregación.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Ambiente laboral: encuesta de escala 1–5, comentarios anónimos y borradores revisables. */
import { ClimateResults, AnonymousComment } from "./climate-results";
import { isHR } from "@/lib/permissions";
import { useCallback, useEffect, useState } from "react";
import { request } from "./forms";
import { type Profile, type Snapshot, value } from "@/modules/workspace/types";
type Draft = {
  id?: string;
  title: string;
  description: string;
  questions: string[];
};
type Summary = {
  summary: string;
  sentiment: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  response_count?: number;
  averages?: { question_index: number; average: number }[];
};
type Survey = Draft & {
  id: string;
  created_by: string;
  status: "DRAFT" | "OPEN" | "CLOSED";
  summary: Summary | null;
};
type Assignment = { survey_id: string; employee_id: string };
type Loaded = {
  surveys: Survey[];
  assignments: Assignment[];
  participation: Assignment[];
};
async function readSurveys(): Promise<Loaded> {
  const response = await fetch("/api/climate", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error);
  return body;
}
const initial: Draft = {
  title: "Encuesta de ambiente laboral",
  description:
    "Valora cada afirmación de 1 (muy en desacuerdo) a 5 (muy de acuerdo).",
  questions: [
    "Cuento con los recursos necesarios para trabajar.",
    "La comunicación en mi equipo es clara y respetuosa.",
    "Mi carga de trabajo es razonable.",
  ],
};

export function WorkplaceClimate({
  data,
  profile,
}: {
  data: Snapshot;
  profile: Profile;
}) {
  const [loaded, setLoaded] = useState<Loaded>({
      surveys: [],
      assignments: [],
      participation: [],
    }),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [draft, setDraft] = useState<Draft | null>(null),
    [preview, setPreview] = useState(false),
    [topic, setTopic] = useState(
      "Comunicación, colaboración y carga de trabajo",
    ),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [surveyQuery, setSurveyQuery] = useState(""),
    [surveyStatus, setSurveyStatus] = useState("");
  const myEmployee = (data.employees ?? []).find(
    (e) => e.profile_id === profile.id,
  );
  const pendingSurveys = loaded.surveys.filter(
    (s) =>
      s.status === "OPEN" &&
      !!myEmployee &&
      loaded.assignments.some(
        (a) => a.survey_id === s.id && a.employee_id === myEmployee.id,
      ) &&
      !loaded.participation.some(
        (a) => a.survey_id === s.id && a.employee_id === myEmployee.id,
      ),
  );
  const visibleSurveys = loaded.surveys.filter(
    (s) =>
      !pendingSurveys.some((p) => p.id === s.id) &&
      (!surveyStatus || s.status === surveyStatus) &&
      s.title.toLocaleLowerCase().includes(surveyQuery.toLocaleLowerCase()),
  );
  const manager = ["SUPERUSER", "RH_ADMIN", "JEFE"].includes(profile.role);
  const load = useCallback(async () => {
    try {
      setLoaded(await readSurveys());
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar las encuestas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    // Actualiza al recibir la respuesta externa y descarta respuestas tras desmontar.
    readSurveys()
      .then((result) => {
        if (active) setLoaded(result);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las encuestas.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  function edit(d: Draft) {
    setDraft(d);
    setPreview(false);
    setNotice("");
  }
  async function generateDraft() {
    setBusy(true);
    setError("");
    try {
      const r = await request("/api/climate", {
        op: "ai.draft",
        payload: { topic },
      });
      edit(r.result);
      setNotice(
        "Borrador generado por IA. Revisa y corrige todas las preguntas antes de guardarlo.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/climate", {
        op: "save",
        payload: {
          ...draft,
          questions: draft.questions.map((q) => q.trim()),
        },
      });
      setDraft(null);
      setNotice(
        "Borrador guardado. Ahora selecciona destinatarios y publícalo.",
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="panel">
        <h2>Ambiente laboral</h2>
        <p>
          Este espacio permite conocer la comunicación, colaboración, recursos y
          carga de trabajo del equipo mediante encuestas y comentarios anónimos.
          Sus resultados orientan mejoras colectivas.
        </p>
        <p>
          {loaded.surveys.filter((s) => s.status === "OPEN").length} encuestas
          abiertas ·{" "}
          {loaded.surveys.filter((s) => s.status === "CLOSED").length} cerradas.
        </p>
        <p>
          Encuestas de escala 1 a 5 con un espacio para comentarios anónimos.
          Las respuestas no guardan el identificador de la persona; la
          participación se controla por separado para evitar duplicados.
        </p>
        <p>
          Los responsables no pueden ver quién respondió ni comentarios
          individuales. El análisis se habilita con al menos cinco respuestas y
          la encuesta cerrada. No incluyas nombres, datos de salud ni detalles
          que te identifiquen; la protección no equivale a anonimato frente a
          administradores técnicos con acceso a la infraestructura.
        </p>
        {manager && (
          <>
            <div className="actions">
              <button onClick={() => edit(initial)} disabled={busy}>
                Crear encuesta manual
              </button>
            </div>
            <label>
              Tema para el borrador IA
              <input
                value={topic}
                maxLength={1000}
                onChange={(e) => setTopic(e.target.value)}
              />
            </label>
            <button
              className="ai-button"
              disabled={busy || topic.trim().length < 3}
              onClick={() => void generateDraft()}
            >
              {busy ? "Procesando…" : "✧ Crear encuesta con IA"}
            </button>
            <p>
              La IA propone preguntas; tú las corriges y eliges a quién
              asignarlas. Publicar no sucede automáticamente.
            </p>
          </>
        )}
        {notice && <p role="status">{notice}</p>}
        {error && <p role="alert">{error}</p>}
      </div>
      {draft && manager && (
        <section className="survey-builder">
          <div className="survey-heading">
            <h3>Diseña tu encuesta</h3>
            <p>Preguntas por tarjetas · Escala lineal · Comentario anónimo</p>
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => setPreview(!preview)}>
              {preview ? "Volver a editar" : "Vista previa del formulario"}
            </button>
          </div>
          <label>
            Título
            <input
              value={draft.title}
              maxLength={160}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            Descripción
            <textarea
              value={draft.description}
              maxLength={3000}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </label>
          {preview ? (
            <SurveyQuestions
              questions={draft.questions}
              prefix="preview"
              disabled
            />
          ) : (
            draft.questions.map((q, i) => (
              <div className="survey-question" key={i}>
                <div className="section-head">
                  <strong>Pregunta {i + 1}</strong>
                  <span className="badge">Escala lineal 1–5 · Obligatoria</span>
                </div>
                <label>
                  Afirmación
                  <textarea
                    value={q}
                    minLength={3}
                    maxLength={400}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        questions: draft.questions.map((old, j) =>
                          j === i ? e.target.value : old,
                        ),
                      })
                    }
                  />
                </label>
                <div className="actions">
                  <button
                    className="quiet"
                    disabled={i === 0}
                    onClick={() => {
                      const qs = [...draft.questions];
                      [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
                      setDraft({ ...draft, questions: qs });
                    }}
                  >
                    ↑ Subir
                  </button>
                  <button
                    className="quiet"
                    disabled={i === draft.questions.length - 1}
                    onClick={() => {
                      const qs = [...draft.questions];
                      [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
                      setDraft({ ...draft, questions: qs });
                    }}
                  >
                    ↓ Bajar
                  </button>
                  <button
                    className="quiet"
                    disabled={draft.questions.length <= 3}
                    onClick={() =>
                      setDraft({
                        ...draft,
                        questions: draft.questions.filter((_, j) => i !== j),
                      })
                    }
                  >
                    Eliminar pregunta
                  </button>
                </div>
              </div>
            ))
          )}
          {!preview && (
            <button
              className="secondary"
              disabled={draft.questions.length >= 12}
              onClick={() =>
                setDraft({ ...draft, questions: [...draft.questions, ""] })
              }
            >
              + Añadir pregunta ({draft.questions.length}/12)
            </button>
          )}
          <p>
            Redacta afirmaciones positivas y neutrales que puedan valorarse del
            1 al 5. Después de publicar no se modifican preguntas ni
            destinatarios.
          </p>
          <div className="actions">
            <button
              disabled={
                busy ||
                !draft.title.trim() ||
                draft.questions.some((q) => q.trim().length < 3)
              }
              onClick={() => void save()}
            >
              Guardar borrador
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setDraft(null)}
            >
              Cancelar edición
            </button>
          </div>
        </section>
      )}
      <section className="panel" aria-label="Mis encuestas pendientes">
        <h3>Mis encuestas pendientes ({pendingSurveys.length})</h3>
        <p>
          Encuestas dirigidas a ti que aún no has respondido. Esta sección es
          independiente de las encuestas que administras.
        </p>
        {loading ? (
          <p role="status">Consultando tus asignaciones…</p>
        ) : error ? (
          <p>No se pudieron verificar tus encuestas pendientes.</p>
        ) : !pendingSurveys.length ? (
          <p>No tienes encuestas pendientes de responder.</p>
        ) : (
          pendingSurveys.map((s) => (
            <details key={s.id} className="record">
              <summary>Responder: {s.title}</summary>
              <SurveyCard
                survey={s}
                assignments={loaded.assignments}
                participation={loaded.participation}
                data={data}
                profile={profile}
                reload={load}
                respondentOnly
                edit={() => {}}
              />
            </details>
          ))
        )}
      </section>
      <h3>Otras encuestas y seguimiento</h3>
      <div className="chart-filters">
        <label>
          Buscar encuesta
          <input
            value={surveyQuery}
            onChange={(e) => setSurveyQuery(e.target.value)}
          />
        </label>
        <label>
          Estado de encuesta
          <select
            value={surveyStatus}
            onChange={(e) => setSurveyStatus(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="DRAFT">Borrador</option>
            <option value="OPEN">Abierta</option>
            <option value="CLOSED">Cerrada</option>
          </select>
        </label>
        <button
          className="secondary"
          onClick={() => {
            setSurveyQuery("");
            setSurveyStatus("");
          }}
        >
          Limpiar filtros de encuestas
        </button>
        <p>{visibleSurveys.length} encuestas encontradas</p>
      </div>
      {loading && <p role="status">Cargando encuestas…</p>}
      {!loading && !loaded.surveys.length && !error && (
        <p className="empty">No tienes encuestas disponibles.</p>
      )}
      <AnonymousComment
        surveys={loaded.surveys.filter(
          (s) =>
            s.status === "OPEN" &&
            loaded.assignments.some(
              (a) =>
                a.survey_id === s.id &&
                (data.employees ?? []).some(
                  (e) => e.id === a.employee_id && e.profile_id === profile.id,
                ),
            ),
        )}
      />
      <div className="survey-list">
        {visibleSurveys.map((s) => (
          <SurveyCard
            key={s.id}
            survey={s}
            assignments={loaded.assignments}
            participation={loaded.participation}
            data={data}
            profile={profile}
            reload={load}
            edit={() =>
              edit({
                id: s.id,
                title: s.title,
                description: s.description,
                questions: s.questions,
              })
            }
          />
        ))}
      </div>
    </section>
  );
}
function SurveyCard({
  survey: s,
  assignments,
  participation,
  data,
  profile,
  reload,
  edit,
  respondentOnly = false,
}: {
  survey: Survey;
  assignments: Assignment[];
  participation: Assignment[];
  data: Snapshot;
  profile: Profile;
  reload: () => Promise<void>;
  edit: () => void;
  respondentOnly?: boolean;
}) {
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]),
    [ratings, setRatings] = useState<Record<number, number>>({}),
    [comment, setComment] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false);
  const manages =
    !respondentOnly &&
    (isHR(profile.role) ||
      (profile.role === "JEFE" && s.created_by === profile.id));
  const mine = (data.employees ?? []).find((e) => e.profile_id === profile.id);
  const assigned = assignments.some(
    (a) => a.survey_id === s.id && a.employee_id === mine?.id,
  );
  const responded =
    sent ||
    participation.some(
      (a) => a.survey_id === s.id && a.employee_id === mine?.id,
    );
  const eligible = (data.employees ?? []).filter(
    (e) =>
      e.status === "ACTIVE" &&
      (isHR(profile.role) || e.profile_id !== profile.id) &&
      (data.profiles ?? []).some(
        (p) =>
          p.id === e.profile_id &&
          p.active &&
          ["JEFE", "EMPLEADO"].includes(value(p, "role")),
      ),
  );
  const name = (id: unknown) =>
    value(
      (data.profiles ?? []).find((p) => p.id === id) ?? { id: "" },
      "full_name",
    );
  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const visibleRecipients = eligible.filter((e) =>
    normalize(name(e.profile_id)).includes(normalize(recipientSearch)),
  );
  async function action(op: string, payload: unknown) {
    setBusy(true);
    setError("");
    try {
      await request("/api/climate", { op, payload });
      if (op === "respond") {
        setSent(true);
        setComment("");
        setRatings({});
      }
      await reload();
      window.dispatchEvent(new Event("climate-updated"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="record survey-form">
      <span className="badge">
        {{ DRAFT: "Borrador", OPEN: "Abierta", CLOSED: "Cerrada" }[s.status]}
      </span>
      <h3>{s.title}</h3>
      {manages && s.status !== "DRAFT" && (
        <ClimateResults
          key={`${s.id}-${s.status}`}
          id={s.id}
          questions={s.questions}
        />
      )}
      <p>{s.description}</p>
      {s.status === "DRAFT" && manages && (
        <>
          <ol>
            {s.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
          <button className="secondary" disabled={busy} onClick={edit}>
            Editar preguntas
          </button>
          <details className="survey-assignment" open>
            <summary>
              Asignar destinatarios · {recipients.length} seleccionados
            </summary>
            <p className="muted">
              Busca personas y revisa la selección antes de publicar.
            </p>
            <div className="survey-assignment-grid">
              <fieldset disabled={busy}>
                <legend>1. Elegir personas de tu jerarquía</legend>
                <label>
                  Buscar por nombre
                  <input
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Escribe un nombre…"
                  />
                </label>
                <button
                  className="secondary"
                  type="button"
                  disabled={!visibleRecipients.length}
                  onClick={() =>
                    setRecipients((old) => [
                      ...new Set([
                        ...old,
                        ...visibleRecipients.map((e) => e.id),
                      ]),
                    ])
                  }
                >
                  Agregar resultados ({visibleRecipients.length})
                </button>
                <div className="survey-recipient-list">
                  {visibleRecipients.map((e) => (
                    <label className="climate-recipient" key={e.id}>
                      <input
                        type="checkbox"
                        checked={recipients.includes(e.id)}
                        onChange={(event) =>
                          setRecipients((old) =>
                            event.target.checked
                              ? [...new Set([...old, e.id])]
                              : old.filter((id) => id !== e.id),
                          )
                        }
                      />
                      <span>{name(e.profile_id)}</span>
                    </label>
                  ))}
                  {!visibleRecipients.length && <p>No hay coincidencias.</p>}
                </div>
              </fieldset>
              <section
                className="survey-selected"
                aria-label="Destinatarios seleccionados"
              >
                <h4>2. Revisar selección ({recipients.length})</h4>
                {!recipients.length && (
                  <p>Las personas que elijas aparecerán aquí.</p>
                )}
                <div className="survey-recipient-list">
                  {eligible
                    .filter((e) => recipients.includes(e.id))
                    .map((e) => (
                      <div className="survey-selected-person" key={e.id}>
                        <span>{name(e.profile_id)}</span>
                        <button
                          className="secondary"
                          type="button"
                          disabled={busy}
                          aria-label={"Quitar a " + name(e.profile_id)}
                          onClick={() =>
                            setRecipients((old) =>
                              old.filter((id) => id !== e.id),
                            )
                          }
                        >
                          Quitar
                        </button>
                      </div>
                    ))}
                </div>
                {!!recipients.length && (
                  <button
                    className="secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => setRecipients([])}
                  >
                    Vaciar selección
                  </button>
                )}
              </section>
            </div>
          </details>
          <p>
            {recipients.length} destinatarios seleccionados. Puedes asignar
            desde una persona. Los resultados anónimos y el análisis requieren
            al menos cinco participantes.
          </p>
          <button
            disabled={busy || recipients.length === 0}
            onClick={() =>
              void action("publish", { id: s.id, employees: recipients })
            }
          >
            Publicar y asignar encuesta
          </button>
        </>
      )}
      {s.status === "OPEN" && manages && (
        <>
          <p>
            Encuesta publicada. Las preguntas y los destinatarios están
            bloqueados para proteger el grupo de respuesta.
          </p>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  "Cerrar impide nuevas respuestas y no se puede reabrir. Se necesitan al menos cinco respuestas para analizar. ¿Cerrar la encuesta?",
                )
              )
                void action("close", { id: s.id });
            }}
          >
            Cerrar recepción de respuestas
          </button>
        </>
      )}
      {s.status === "OPEN" && assigned && !responded && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void action("respond", {
              id: s.id,
              ratings: s.questions.map((_, i) => ratings[i]),
              comment,
            });
          }}
        >
          <p>1 = muy en desacuerdo · 5 = muy de acuerdo</p>
          <p aria-live="polite">
            {Object.keys(ratings).length} de {s.questions.length} preguntas
            respondidas
          </p>
          <progress
            max={s.questions.length}
            value={Object.keys(ratings).length}
          />
          <SurveyQuestions
            questions={s.questions}
            prefix={s.id}
            ratings={ratings}
            onChange={(i, n) => setRatings({ ...ratings, [i]: n })}
            disabled={busy}
          />
          <label>
            Comentario anónimo (opcional)
            <textarea
              maxLength={3000}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Sugiere mejoras sin incluir nombres ni detalles que te identifiquen."
            />
          </label>
          <p>
            Tu comentario podrá enviarse al proveedor de IA configurado para
            elaborar el resumen del grupo. No podrás editarlo después del envío.
          </p>
          <button disabled={busy}>Enviar respuesta anónima</button>
        </form>
      )}
      {responded && (
        <p role="status">
          Tu respuesta quedó registrada. Gracias por participar.
        </p>
      )}
      {s.status === "CLOSED" && manages && !s.summary && (
        <>
          <p>
            El resumen solo se habilita con cinco o más respuestas. No se
            revelan resultados de grupos menores.
          </p>
          <button
            className="ai-button"
            disabled={busy}
            onClick={() => void action("ai.summary", { id: s.id })}
          >
            {busy ? "Analizando…" : "✧ Analizar ambiente laboral"}
          </button>
        </>
      )}
      {s.summary && (
        <section className="ai-result">
          <h3>Resumen del grupo</h3>
          <p>{s.summary.summary}</p>
          <p>
            Balance:{" "}
            {{
              POSITIVE: "Positivo",
              MIXED: "Mixto",
              CONCERNING: "Requiere atención",
            }[s.summary.sentiment] ?? "Revisar"}
          </p>
          <p>
            {s.summary.response_count} respuestas anónimas · interpretación
            orientativa, no representa necesariamente a toda el área.
          </p>
          {s.summary.averages?.map((a) => (
            <p key={a.question_index}>
              {s.questions[a.question_index - 1]}:{" "}
              <strong>{a.average}/5</strong>
            </p>
          ))}
          {(
            [
              ["Fortalezas", s.summary.strengths],
              ["Aspectos por atender", s.summary.risks],
              ["Recomendaciones", s.summary.recommendations],
            ] as [string, string[]][]
          ).map(([title, items]) => (
            <div key={title}>
              <strong>{title}</strong>
              <ul>
                {items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      {error && <p role="alert">{error}</p>}
    </article>
  );
}

/** Tarjetas compartidas entre vista previa y respuesta: etiquetas y grupos accesibles. */
function SurveyQuestions({
  questions,
  prefix,
  ratings = {},
  onChange,
  disabled = false,
}: {
  questions: string[];
  prefix: string;
  ratings?: Record<number, number>;
  onChange?: (index: number, value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      {questions.map((q, i) => (
        <fieldset className="survey-question" disabled={disabled} key={i}>
          <legend>
            {i + 1}. {q || "Nueva pregunta"}{" "}
            <span aria-label="obligatoria">*</span>
          </legend>
          <div className="survey-scale">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n}>
                <span>{n}</span>
                <input
                  type="radio"
                  name={prefix + "-question-" + i}
                  value={n}
                  required
                  checked={ratings[i] === n}
                  onChange={() => onChange?.(i, n)}
                />
              </label>
            ))}
          </div>
          <div className="section-head">
            <small>Muy en desacuerdo</small>
            <small>Muy de acuerdo</small>
          </div>
        </fieldset>
      ))}
    </div>
  );
}
