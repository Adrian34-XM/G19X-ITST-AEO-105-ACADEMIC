"use client";
import { useId, useState } from "react";
import { DataChart } from "./data-chart";
import { chartKind } from "@/lib/charts/data";

/** Compara promedios reales; no transforma promedios en frecuencias de respuestas. */
export function ClimateQuestionChart({
  values,
}: {
  values: { label: string; count: number }[];
}) {
  const id = useId();
  const [kind, setKind] = useState("columns");
  return (
    <article className="record climate-question-chart">
      <h3>Resultados por pregunta</h3>
      <p>
        Compara el promedio de las respuestas a cada pregunta, en escala de 1 a
        5.
      </p>
      <label htmlFor={id}>Tipo de gráfica de preguntas</label>
      <select id={id} value={kind} onChange={(e) => setKind(e.target.value)}>
        <option value="columns">Columnas por pregunta</option>
        <option value="bars">Barras horizontales por pregunta</option>
      </select>
      <DataChart
        title="Promedio de respuestas por pregunta"
        kind={chartKind(kind)}
        values={values.map((value, index) => ({
          ...value,
          axisLabel: `P${index + 1}`,
        }))}
        unit="Promedio (1 a 5)"
        maximum={5}
        decimals={2}
      />
      <ol className="climate-question-legend">
        {values.map((v, i) => (
          <li key={`${i}-${v.label}`}>
            <span className="badge">P{i + 1}</span>
            <span>{v.label}</span>
            <strong>{v.count}/5</strong>
          </li>
        ))}
      </ol>
      <p className="muted">
        Las barras representan promedios, no personas ni porcentajes. Un
        promedio no permite saber cuántas personas eligieron cada opción.
      </p>
    </article>
  );
}
