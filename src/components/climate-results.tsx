"use client";
/**
 * @file Muestra participación, resultados agregados y análisis de gráficas de encuestas. Mantiene
 * separados los datos de participación y el contenido anónimo de respuestas.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { useEffect, useState } from "react";
import { request } from "./forms";
import { ClimateQuestionChart } from "./climate-question-chart";
import { climateCharts } from "@/modules/workspace/climate-charts";
type Results = {
  responses: number;
  status?: string;
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
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<{
    summary: string;
    strengths: string[];
    risks: string[];
    recommendations: string[];
  } | null>(null);
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
      <button
        className="secondary"
        disabled={busy}
        onClick={() => {
          setAnalysis(null);
          setRevision((r) => r + 1);
        }}
      >
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
            {data.averages.length > 0 ? (
              <ClimateQuestionChart
                values={
                  climateCharts(data, questions).find(
                    (chart) => chart.kind === "bars",
                  )?.values ?? []
                }
              />
            ) : (
              <p>
                Los promedios y comentarios de la encuesta se muestran al cerrar
                con al menos cinco respuestas.
              </p>
            )}
            <article className="record">
              <h4>Lectura de las gráficas</h4>
              <p>
                Han respondido {data.responses} personas; faltan{" "}
                {Math.max(0, data.invited - data.responses)} de las{" "}
                {data.invited} invitadas. La participación no mide satisfacción.
              </p>
              <p>
                Los promedios describen las respuestas recibidas, no la opinión
                de quienes aún no respondieron. No permiten deducir causas ni
                cambios a lo largo del tiempo.
              </p>
              <button
                disabled={
                  busy ||
                  data.status !== "CLOSED" ||
                  data.responses < 5 ||
                  !data.averages.length
                }
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setAnalysis(null);
                  try {
                    const response = await request("/api/climate", {
                      op: "ai.graphs",
                      payload: { id },
                    });
                    setAnalysis(response.result);
                  } catch (e) {
                    setError(
                      e instanceof Error
                        ? e.message
                        : "No se pudo analizar las gráficas.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Analizando gráficas…" : "Analizar gráficas con IA"}
              </button>
              <p className="muted">
                Disponible al cerrar la encuesta y reunir al menos cinco
                respuestas. La IA recibe preguntas, participación y promedios;
                no recibe comentarios ni identidades.
              </p>
              {analysis && (
                <div className="ai-result" role="status">
                  <h4>Análisis de las gráficas con IA</h4>
                  <p>{analysis.summary}</p>
                  {[
                    ["Fortalezas", analysis.strengths],
                    ["Aspectos por revisar", analysis.risks],
                    ["Próximos pasos", analysis.recommendations],
                  ].map(([title, items]) => (
                    <div key={String(title)}>
                      <strong>{title}</strong>
                      <ul>
                        {(items as string[]).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                  <p className="muted">
                    Interpretación orientativa: contrasta las conclusiones con
                    las cifras de las gráficas. Requiere revisión humana.
                  </p>
                </div>
              )}
            </article>
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
