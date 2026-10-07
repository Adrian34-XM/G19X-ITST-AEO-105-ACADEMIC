"use client";
import { useEffect, useRef, useState } from "react";
import { request } from "./forms";
import { DataGraph } from "./workforce-tools";
import {
  climateCharts,
  type ClimateChart,
} from "@/modules/workspace/climate-charts";

export type ClimateAnalysisResult = {
  summary: string;
  sentiment: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  response_count?: number;
  averages?: { question_index: number; average: number }[];
  charts?: ClimateChart[];
};
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
}: {
  id: string;
  title: string;
  questions: string[];
  saved: ClimateAnalysisResult | null;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [analysis, setAnalysis] = useState(saved);
  const [group, setGroup] = useState<Aggregate | null>(null);
  const [busy, setBusy] = useState(false);
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
    setError("");
    try {
      const aggregate = await readGroup();
      if (update || !(analysis || saved)) {
        const response = await request("/api/climate", {
          op: "ai.summary",
          payload: { id },
        });
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
            {busy && (
              <p role="status">
                {result
                  ? "Actualizando resultados…"
                  : "Preparando el análisis y las gráficas…"}
              </p>
            )}
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
                {charts.length > 0 && (
                  <section>
                    <h3>Gráficas de las respuestas</h3>
                    <div className="climate-analysis-charts">
                      {charts.map((chart) =>
                        chart.kind === "pie" ? (
                          <DataGraph key={chart.title} chart={chart} />
                        ) : (
                          <article
                            className="record climate-average-chart"
                            key={chart.title}
                          >
                            <h3>{chart.title}</h3>
                            {chart.values.map((v) => (
                              <div key={v.label}>
                                <p>
                                  {v.label} <strong>{v.count}/5</strong>
                                </p>
                                <progress
                                  aria-label={v.label}
                                  value={v.count}
                                  max={5}
                                />
                              </div>
                            ))}
                            <p className="muted">
                              Cada barra muestra un promedio en escala de 1 a 5.
                              Los promedios no se suman ni equivalen a
                              cantidades de personas.
                            </p>
                          </article>
                        ),
                      )}
                    </div>
                    <p className="muted">
                      La participación no mide satisfacción. Los promedios usan
                      una escala de 1 a 5; no permiten deducir autores, causas
                      ni la distribución de respuestas individuales.
                    </p>
                  </section>
                )}
                {!charts.length && (
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
