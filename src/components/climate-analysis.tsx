"use client";
import { useEffect, useRef, useState } from "react";
import { request } from "./forms";
import { ContentSkeleton, LoadingStatus } from "./loading-skeleton";
import { requestAnalysis } from "./ai-requests";
import { ClimateQuestionChart } from "./climate-question-chart";
import { climateCharts } from "@/modules/workspace/climate-charts";
import type { ClimateGroupAnalysis } from "@/modules/workspace/climate-overview";

export type ClimateAnalysisResult = ClimateGroupAnalysis;
type Aggregate = {
  status: string;
  responses: number;
  invited: number;
  averages: { question_index: number; average: number }[];
};
export function ClimateAnalysis({
  id,
  title,
  questions,
  saved,
  onSaved,
  viewer,
}: {
  id: string;
  title: string;
  questions: string[];
  saved: ClimateAnalysisResult | null;
  onSaved: () => Promise<void>;
  viewer?: string;
}) {
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState(saved);
  const [group, setGroup] = useState<Aggregate | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    return () => {
      if (element?.open) element.close();
    };
  }, [open]);
  async function readGroup() {
    const response = await fetch(
      `/api/climate?survey=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    const body = await response.json();
    if (!response.ok)
      throw new Error(body.error || "No se pudieron cargar los resultados.");
    setGroup(body);
    return body as Aggregate;
  }
  async function show(update = false) {
    setOpen(true);
    setBusy(true);
    setWaiting(false);
    setError("");
    try {
      const aggregate = await readGroup();
      if (update || !(analysis || saved)) {
        const payload = {
          op: "ai.summary",
          payload: { id },
        };
        const response = viewer
          ? await requestAnalysis(viewer, "/api/climate", payload, {
              onWaiting: setWaiting,
            })
          : await request("/api/climate", payload);
        setAnalysis({
          ...response.result,
          response_count: aggregate.responses,
          averages: aggregate.averages,
          charts: response.result.charts ?? climateCharts(aggregate, questions),
        });
        await onSaved();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo generar el análisis.",
      );
    } finally {
      setBusy(false);
    }
  }
  const result = analysis || saved;
  const charts =
    result?.charts ?? (group ? climateCharts(group, questions) : []);
  const questionValues =
    charts.find((chart) => chart.kind === "bars")?.values ?? [];
  return (
    <>
      <button className="ai-button" disabled={busy} onClick={() => void show()}>
        {result ? "Ver análisis guardado" : "✧ Analizar ambiente laboral"}
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="climate-analysis-dialog"
          aria-labelledby={`climate-analysis-${id}`}
          onCancel={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <header className="climate-analysis-header">
            <div>
              <span className="eyebrow">
                AMBIENTE LABORAL · ANÁLISIS CON IA
              </span>
              <h2 id={`climate-analysis-${id}`}>{title}</h2>
            </div>
            <button
              className="secondary"
              onClick={() => setOpen(false)}
              aria-label="Cerrar análisis"
            >
              Cerrar
            </button>
          </header>
          <div className="climate-analysis-body">
            {busy &&
              (result ? (
                <LoadingStatus
                  label={
                    waiting
                      ? "Esperando a que termine el otro análisis de tu cuenta…"
                      : "Actualizando resultados…"
                  }
                />
              ) : (
                <ContentSkeleton
                  variant="charts"
                  label={
                    waiting
                      ? "Esperando a que termine el otro análisis de tu cuenta…"
                      : "Preparando el análisis y las gráficas…"
                  }
                />
              ))}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {result && (
              <>
                <section className="ai-result">
                  <h3>Resumen del grupo</h3>
                  <p style={{ whiteSpace: "pre-wrap" }}>{result.summary}</p>
                  <span className="badge">
                    {{
                      POSITIVE: "Positivo",
                      MIXED: "Mixto",
                      CONCERNING: "Requiere atención",
                    }[result.sentiment] ?? "Revisar"}
                  </span>
                  <p className="muted">
                    {result.response_count ?? group?.responses} respuestas
                    anónimas. Interpretación orientativa que requiere revisión
                    humana.
                  </p>
                </section>
                {questionValues.length > 0 && (
                  <section>
                    <h3>Gráficas de las respuestas</h3>
                    <ClimateQuestionChart values={questionValues} />
                    <p className="muted">
                      La participación no mide satisfacción. Los promedios usan
                      una escala de 1 a 5; no permiten deducir autores, causas
                      ni la distribución de respuestas individuales.
                    </p>
                  </section>
                )}
                {!questionValues.length && !busy && (
                  <p className="muted">
                    Las gráficas requieren cinco respuestas y promedios
                    disponibles. Los mensajes anónimos por sí solos no permiten
                    calcularlas.
                  </p>
                )}
                <div className="climate-analysis-findings">
                  {(
                    [
                      ["Fortalezas", result.strengths],
                      ["Aspectos por atender", result.risks],
                      ["Recomendaciones", result.recommendations],
                    ] as [string, string[]][]
                  ).map(([heading, items]) => (
                    <section className="record" key={heading}>
                      <h3>{heading}</h3>
                      {items.length ? (
                        <ul>
                          {items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>No se identificaron elementos respaldados.</p>
                      )}
                    </section>
                  ))}
                </div>
              </>
            )}
          </div>
          <footer className="climate-analysis-footer">
            <p className="muted">
              El análisis guardado puede consultarse de nuevo sin volver a
              ejecutar la IA.
            </p>
            <button
              className="ai-button"
              disabled={busy}
              onClick={() => void show(true)}
            >
              {busy
                ? "Analizando…"
                : result
                  ? "Actualizar análisis con IA"
                  : "Reintentar análisis"}
            </button>
          </footer>
        </dialog>
      )}
    </>
  );
}
