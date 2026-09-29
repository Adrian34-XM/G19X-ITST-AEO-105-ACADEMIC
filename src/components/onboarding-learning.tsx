"use client";
/**
 * @file Material de lectura y evaluación opcional de una actividad. Envía respuestas para
 * calificación en servidor y muestra intentos; completar la lectura no sustituye aprobar una
 * evaluación cuando está exigida.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { useEffect, useState } from "react";
/**
 * id identifica la actividad. manage habilita edición y own el intento del colaborador;
 * estas banderas controlan la presentación, mientras la API vuelve a comprobar permisos.
 * Cada respuesta se envía por índice de opción; la solución correcta permanece en SQL.
 */
export function OnboardingLearning({
  id,
  manage,
  own,
}: {
  id: string;
  manage: boolean;
  own: boolean;
}) {
  const [data, setData] = useState<{
    url?: string;
    instructions?: string;
    minimum?: number;
    questions?: { question: string; options: string[] }[];
    attempts?: { score: number; passed: boolean }[];
  }>({});
  const [withQuiz, setWithQuiz] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [questions, setQuestions] = useState([
    { question: "", options: ["", ""], correct: 0 },
  ]);
  useEffect(() => {
    let active = true;
    fetch(`/api/onboarding-learning?id=${id}`, { cache: "no-store" })
      .then(async (r) => {
        const b = await r.json();
        if (!r.ok) throw Error(b.error);
        if (active) {
          setData(b);
          if (b.url) setWithQuiz(Boolean(b.questions?.length));
        }
      })
      .catch(() => {
        if (active)
          setError(
            "Evaluaciones no disponibles. Comprueba la migración de incorporación.",
          );
      });
    return () => {
      active = false;
    };
  }, [id, revision]);
  async function send(body: FormData | string) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/onboarding-learning", {
        method: "POST",
        body,
        ...(typeof body === "string"
          ? { headers: { "Content-Type": "application/json" } }
          : {}),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setRevision((n) => n + 1);
      setAnswers({});
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="record">
      <summary>Documento de lectura y evaluación</summary>
      {error && <p role="alert">{error}</p>}
      {data.url && (
        <>
          <a href={data.url} target="_blank" rel="noreferrer">
            Abrir documento de lectura
          </a>
          <p>{data.instructions}</p>
          {data.questions?.length ? (
            <p>Calificación mínima: {data.minimum}/100</p>
          ) : (
            <p>Solo lectura: esta actividad no requiere evaluación.</p>
          )}
          <button
            className="secondary"
            onClick={() => setRevision((n) => n + 1)}
          >
            Actualizar enlace del documento
          </button>
        </>
      )}
      {manage && !data.attempts?.length && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            f.set("id", id);
            if (!withQuiz) f.set("minimum", "1");
            f.set("questions", JSON.stringify(withQuiz ? questions : []));
            void send(f);
          }}
        >
          <p>
            Configura antes del primer intento. Las respuestas correctas no se
            muestran al colaborador.
          </p>
          <label>
            Documento de lectura
            <input
              name="file"
              type="file"
              required
              accept=".pdf,.png,.jpg,.jpeg,.txt"
            />
          </label>
          <label>
            Condiciones de la actividad
            <textarea name="instructions" required maxLength={2000} />
          </label>
          <label>
            <input
              type="checkbox"
              checked={withQuiz}
              onChange={(e) => setWithQuiz(e.target.checked)}
            />
            Incluir encuesta breve de comprensión
          </label>
          <p>
            {withQuiz
              ? "Debe aprobar las preguntas para enviar la actividad a revisión."
              : "Solo se requiere leer el documento y cumplir las condiciones; no se solicita calificación."}
          </p>
          {withQuiz && (
            <>
              <label>
                Nota mínima (sobre 100)
                <input
                  name="minimum"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={80}
                  required
                />
              </label>
              {questions.map((q, i) => (
                <fieldset key={i}>
                  <legend>Pregunta {i + 1}</legend>
                  <input
                    aria-label={`Pregunta ${i + 1}`}
                    required
                    minLength={3}
                    maxLength={400}
                    value={q.question}
                    onChange={(e) =>
                      setQuestions((old) =>
                        old.map((x, j) =>
                          j === i ? { ...x, question: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  {q.options.map((o, k) => (
                    <label key={k}>
                      Opción {k + 1}
                      <input
                        required
                        maxLength={200}
                        value={o}
                        onChange={(e) =>
                          setQuestions((old) =>
                            old.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    options: x.options.map((v, l) =>
                                      l === k ? e.target.value : v,
                                    ),
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <label>
                    Respuesta correcta
                    <select
                      value={q.correct}
                      onChange={(e) =>
                        setQuestions((old) =>
                          old.map((x, j) =>
                            j === i
                              ? { ...x, correct: Number(e.target.value) }
                              : x,
                          ),
                        )
                      }
                    >
                      {q.options.map((_, k) => (
                        <option key={k} value={k}>
                          Opción {k + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              ))}
              <button
                type="button"
                disabled={questions.length >= 20}
                onClick={() =>
                  setQuestions((old) => [
                    ...old,
                    { question: "", options: ["", ""], correct: 0 },
                  ])
                }
              >
                Agregar pregunta
              </button>
            </>
          )}
          <button disabled={busy}>Guardar actividad</button>
        </form>
      )}
      {own && !!data.questions?.length && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(
              JSON.stringify({
                id,
                answers: data.questions!.map((_, i) => answers[i]),
              }),
            );
          }}
        >
          {data.questions!.map((q, i) => (
            <fieldset key={i}>
              <legend>{q.question}</legend>
              {q.options.map((o, k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name={`${id}-${i}`}
                    required
                    checked={answers[i] === k}
                    onChange={() => setAnswers({ ...answers, [i]: k })}
                  />
                  {o}
                </label>
              ))}
            </fieldset>
          ))}
          <button disabled={busy}>Calificar intento</button>
        </form>
      )}
      {data.attempts?.map((a, i) => (
        <p key={i}>
          {i === 0 ? "Último intento" : "Intento anterior"}: {a.score}/100 ·{" "}
          {a.passed
            ? "Aprobado. Puedes enviar la actividad a revisión."
            : "No aprobado. Revisa el documento y vuelve a intentarlo."}
        </p>
      ))}
    </details>
  );
}
