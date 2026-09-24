"use client";
import { useEffect, useState } from "react";
import { request } from "./forms";
import { DataGraph } from "./workforce-tools";
type Results = {
  responses: number;
  invited: number;
  comments: string[];
  feedback?: string[];
  averages: { question_index: number; average: number }[];
};
export function ClimateResults({
  id,
  questions,
}: {
  id: string;
  questions: string[];
}) {
  const [data, setData] = useState<Results | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    fetch(`/api/climate?survey=${encodeURIComponent(id)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error);
        if (active) {
          setData(body);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, revision]);
  return (
    <section>
      <button className="secondary" onClick={() => setRevision((r) => r + 1)}>
        Actualizar participación
      </button>
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <p>
            <strong>
              {data.responses} de {data.invited}
            </strong>{" "}
            personas respondieron (
            {data.invited
              ? Math.round((data.responses / data.invited) * 100)
              : 0}
            %).
          </p>
          <progress value={data.responses} max={Math.max(1, data.invited)} />
          <details>
            <summary>Gráficas y comentarios anónimos</summary>
            <DataGraph
              chart={{
                title: "Participación de la encuesta",
                kind: "pie",
                values: [
                  { label: "Respondieron", count: data.responses },
                  {
                    label: "Pendientes",
                    count: Math.max(0, data.invited - data.responses),
                  },
                ],
              }}
            />
            {data.averages.length > 0 ? (
              <article className="record">
                <h4>Promedio por pregunta (escala de 1 a 5)</h4>
                {data.averages.map((a) => (
                  <div key={a.question_index}>
                    <p>
                      {questions[a.question_index - 1]}:{" "}
                      <strong>{a.average}/5</strong>
                    </p>
                    <progress value={a.average} max={5} />
                  </div>
                ))}
              </article>
            ) : (
              <p>
                Los promedios y comentarios de la encuesta se muestran al cerrar
                con al menos cinco respuestas.
              </p>
            )}
            <h4>Comentarios anónimos de encuestas</h4>
            {data.comments.map((c, i) => (
              <blockquote key={i}>{c}</blockquote>
            ))}
            {!data.comments.length && <p>Sin comentarios publicables.</p>}
            <h4>Buzón anónimo</h4>
            {data.feedback?.map((c, i) => (
              <blockquote key={i}>{c}</blockquote>
            ))}
            {!data.feedback?.length && (
              <p>
                Los comentarios del buzón se publican juntos al cerrar y reunir
                al menos cinco participantes. No se muestran autores ni
                horarios.
              </p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
export function AnonymousComment({
  surveys,
}: {
  surveys: { id: string; title: string }[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!surveys.length) return null;
  return (
    <details className="panel">
      <summary>Escribir un comentario anónimo</summary>
      <p>
        Un comentario por persona y encuesta, independiente de tus respuestas.
        Evita nombres y datos que puedan identificarte o identificar a otras
        personas. Se publica junto con al menos otros cuatro comentarios al
        cerrar la encuesta.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          setBusy(true);
          setMessage("");
          try {
            await request("/api/climate", {
              op: "comment",
              payload: { id: f.get("id"), comment: f.get("comment") },
            });
            form.reset();
            setMessage("Comentario recibido sin identidad en su contenido.");
          } catch (e) {
            setMessage(e instanceof Error ? e.message : "No se pudo enviar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Encuesta o tema
          <select name="id" required>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Comentario
          <textarea name="comment" required minLength={3} maxLength={3000} />
        </label>
        <button disabled={busy}>Enviar comentario anónimo</button>
      </form>
      {message && <p role="status">{message}</p>}
    </details>
  );
}
