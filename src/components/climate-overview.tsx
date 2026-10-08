"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MessageCircleHeart, RefreshCw } from "lucide-react";
import { isHR, home } from "@/lib/permissions";
import type { Profile } from "@/modules/workspace/types";
import type { ClimateOverview } from "@/modules/workspace/climate-overview";
import { stateLabel } from "@/modules/workspace/labels";
import { ClimateAnalysis } from "./climate-analysis";

function preview(text: string, limit: number) {
  return text.length <= limit
    ? text
    : text.slice(0, limit).replace(/\s+\S*$/, "") + "…";
}

async function readOverview(signal?: AbortSignal): Promise<ClimateOverview> {
  const response = await fetch("/api/climate/overview", {
    cache: "no-store",
    signal,
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error ||
        "No se pudieron consultar las novedades de ambiente laboral.",
    );
  return body;
}

/** Consulta totales y análisis agregados, sin cargar respuestas ni identidades al tablero. */
export function ClimateOverviewPanel({ profile }: { profile: Profile }) {
  const [data, setData] = useState<ClimateOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const allowed = isHR(profile.role);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!allowed) return;
      try {
        const body = await readOverview(signal);
        if (!signal?.aborted) {
          setData(body);
          setError("");
        }
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron consultar las novedades.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [allowed],
  );
  useEffect(() => {
    const controller = new AbortController();
    if (allowed)
      void readOverview(controller.signal)
        .then((body) => {
          if (!controller.signal.aborted) {
            setData(body);
            setError("");
          }
        })
        .catch((error: Error) => {
          if (!controller.signal.aborted) setError(error.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    const refresh = () => {
      setLoading(true);
      void load(controller.signal);
    };
    window.addEventListener("climate-updated", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("climate-updated", refresh);
    };
  }, [load, allowed]);
  if (!allowed) return null;
  return (
    <section
      className="panel overview-climate"
      aria-labelledby="overview-climate-title"
    >
      <div className="section-head">
        <div>
          <span className="eyebrow">ESCUCHA Y BIENESTAR</span>
          <h2 id="overview-climate-title">
            <MessageCircleHeart size={21} aria-hidden="true" /> Ambiente laboral
          </h2>
        </div>
        <Link href={`${home[profile.role]}/climate`}>
          Ver encuestas <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <p className="muted overview-climate-description">
        Novedades de esta semana, de lunes a domingo en Ciudad de México, con
        los análisis guardados de sus encuestas. También puedes dar seguimiento
        a las encuestas que siguen abiertas.
      </p>
      {loading && (
        <p role="status">Consultando novedades de ambiente laboral…</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!error && data && (
        <>
          <div className="overview-climate-counts">
            <div>
              <strong>{data.new_surveys}</strong>
              <span>Nuevas esta semana</span>
            </div>
            <div>
              <strong>{data.open}</strong>
              <span>Encuestas abiertas</span>
            </div>
            <div>
              <strong>
                {data.surveys.filter((survey) => !!survey.summary).length}
              </strong>
              <span>Análisis disponibles</span>
            </div>
          </div>
          <div className="overview-climate-news">
            {data.surveys.slice(0, 3).map((survey) => (
              <article
                className={`overview-climate-survey${survey.summary ? " overview-climate-survey-featured" : ""}`}
                key={survey.id}
              >
                <div className="overview-climate-survey-heading">
                  <h3>{survey.title}</h3>
                  <span
                    className={`badge ${survey.status === "OPEN" ? "green" : ""}`}
                  >
                    {stateLabel(survey.status)}
                  </span>
                </div>
                <div className="overview-climate-tags">
                  {survey.created_this_week && (
                    <span className="badge">Nueva esta semana</span>
                  )}
                  {survey.analyzed_this_week && (
                    <span className="badge">Análisis reciente</span>
                  )}
                </div>
                <p className="muted">
                  {survey.responses} de {survey.invited} personas respondieron.
                  Resultados del grupo de esta encuesta.
                </p>
                {survey.summary ? (
                  <div className="overview-climate-reading">
                    <span
                      className={`badge ${survey.summary.sentiment === "CONCERNING" ? "red" : survey.summary.sentiment === "POSITIVE" ? "green" : ""}`}
                    >
                      {{
                        POSITIVE: "Balance positivo",
                        MIXED: "Balance mixto",
                        CONCERNING: "Requiere atención",
                      }[survey.summary.sentiment] ?? "Revisar"}
                    </span>
                    <p>{preview(survey.summary.summary, 380)}</p>
                    {survey.summary.risks[0] && (
                      <p>
                        <strong>Por atender: </strong>
                        {preview(survey.summary.risks[0], 180)}
                      </p>
                    )}
                    {survey.summary.recommendations[0] && (
                      <p>
                        <strong>Siguiente paso sugerido: </strong>
                        {preview(survey.summary.recommendations[0], 180)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="muted">
                    {survey.status === "DRAFT"
                      ? "Este borrador todavía no recibe respuestas. Revísalo y publícalo desde Ambiente laboral."
                      : survey.status === "OPEN"
                        ? "La encuesta sigue recibiendo respuestas. Los resultados se muestran después del cierre y con suficiente participación."
                        : survey.can_analyze
                          ? "El grupo ya permite generar un análisis con IA."
                          : "Los resultados permanecen protegidos: se requieren al menos cinco respuestas o cinco comentarios anónimos."}
                  </p>
                )}
                {survey.can_analyze && (
                  <ClimateAnalysis
                    id={survey.id}
                    title={survey.title}
                    questions={survey.questions}
                    saved={survey.summary}
                    viewer={profile.id}
                    onSaved={async () => {
                      await load();
                    }}
                  />
                )}
              </article>
            ))}
            {!data.surveys.length && !loading && (
              <p className="muted">
                No hay encuestas abiertas ni novedades de esta semana en los
                datos disponibles.
              </p>
            )}
          </div>
          {data.surveys.length > 3 && (
            <p className="muted">
              Se muestran tres encuestas. Consulta las demás en Ambiente
              laboral.
            </p>
          )}
          {data.limited && (
            <p className="muted">
              Resumen limitado a 200 encuestas y 12 grupos. Consulta el módulo
              para revisar otros resultados.
            </p>
          )}
          <p className="overview-climate-privacy">
            Los análisis son orientativos y requieren revisión humana. No se
            atribuyen respuestas a personas ni a áreas: cada encuesta representa
            a su grupo completo.
          </p>
        </>
      )}
      <button
        type="button"
        className="secondary"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          void load();
        }}
      >
        <RefreshCw size={14} aria-hidden="true" />{" "}
        {loading ? "Consultando…" : "Actualizar novedades"}
      </button>
    </section>
  );
}
