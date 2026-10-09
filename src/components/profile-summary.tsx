"use client";
import { useEffect, useState } from "react";
import { requestAnalysis } from "./ai-requests";
import { ContentSkeleton } from "./loading-skeleton";
type Summary = { summary: string; recommendations?: string[] };
// Comparte únicamente solicitudes en vuelo de la misma sesión y persona, también en StrictMode.
const pending = new Map<string, Promise<Summary>>();
function generate(viewer: string, employee: string) {
  const key = `${viewer}:${employee}`;
  let promise = pending.get(key);
  if (!promise) {
    promise = requestAnalysis(viewer, "/api/ai/workforce", {
      mode: "profile",
      employee_id: employee,
      prompt:
        "Resume brevemente los avances y pendientes de esta persona en tareas, capacitación e incorporación. Propón próximos pasos verificables. Distingue datos ausentes de bajo desempeño. Usa español natural y no repitas cifras.",
    }).then((r) => r.result as Summary);
    pending.set(key, promise);
    void promise
      .finally(() => {
        if (pending.get(key) === promise) pending.delete(key);
      })
      .catch(() => {});
  }
  return promise;
}
export function ProfileSummary({
  viewer,
  employee,
  onSection,
}: {
  viewer: string;
  employee: string;
  onSection: (section: "tasks" | "courses" | "onboarding") => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    result?: Summary;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    let active = true;
    generate(viewer, employee)
      .then((result) => {
        if (active) setState({ result, loading: false });
      })
      .catch((error) => {
        if (active)
          setState({
            error:
              error instanceof Error
                ? error.message
                : "No fue posible generar el resumen.",
            loading: false,
          });
      });
    return () => {
      active = false;
    };
  }, [viewer, employee, attempt]);
  return (
    <section
      className="panel profile-ai"
      aria-live="polite"
      aria-busy={state.loading}
    >
      <div className="profile-section-heading">
        <div>
          <span className="eyebrow">RESUMEN CON IA</span>
          <h3>Avances y próximos pasos</h3>
        </div>
        <button
          className="secondary"
          disabled={state.loading}
          onClick={() => {
            setState({ loading: true });
            setAttempt((n) => n + 1);
          }}
        >
          Actualizar resumen
        </button>
      </div>
      {state.loading && (
        <ContentSkeleton label="Preparando el resumen con la información que puedes consultar…" />
      )}
      {state.error && (
        <p role="alert">
          {state.error} Puedes seguir consultando el expediente y volver a
          intentarlo.
        </p>
      )}
      {state.result && (
        <>
          <p>{state.result.summary}</p>
          <div
            className="profile-actions"
            aria-label="Consultar registros del resumen"
          >
            <button className="secondary" onClick={() => onSection("tasks")}>
              Ver tareas
            </button>
            <button className="secondary" onClick={() => onSection("courses")}>
              Ver capacitaciones
            </button>
            <button
              className="secondary"
              onClick={() => onSection("onboarding")}
            >
              Ver incorporación
            </button>
          </div>
          {!!state.result.recommendations?.length && (
            <ul>
              {state.result.recommendations.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          <small>
            Generado al abrir el perfil. Consulta los registros de las secciones
            inferiores para verificarlo. No constituye una evaluación integral
            ni modifica estados.
          </small>
        </>
      )}
    </section>
  );
}
