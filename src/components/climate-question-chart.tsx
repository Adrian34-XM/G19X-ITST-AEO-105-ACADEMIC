"use client";
import { useId, useState } from "react";

/** Compara promedios reales; no transforma promedios en frecuencias de respuestas. */
export function ClimateQuestionChart({
  values,
}: {
  values: { label: string; count: number }[];
}) {
  const id = useId();
  const [kind, setKind] = useState("columns");
  const horizontal = kind === "bars";
  const width = Math.max(600, horizontal ? 600 : values.length * 85 + 80);
  const height = horizontal ? Math.max(220, values.length * 52 + 65) : 310;
  const left = 48,
    top = 20,
    bottom = height - 42;
  const plotWidth = width - left - 24;
  const plotHeight = bottom - top;
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
      <div className="climate-question-plot">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="Promedio de respuestas por pregunta, escala de 1 a 5"
        >
          <title>Promedio de respuestas por pregunta</title>
          <desc>
            {values
              .map((v, i) => `P${i + 1}: ${v.label}, promedio ${v.count} de 5`)
              .join(". ")}
          </desc>
          {[0, 1, 2, 3, 4, 5].map((tick) => {
            const x = left + (plotWidth * tick) / 5;
            const y = bottom - (plotHeight * tick) / 5;
            return (
              <g key={tick}>
                <line
                  x1={horizontal ? x : left}
                  y1={horizontal ? top : y}
                  x2={horizontal ? x : width - 24}
                  y2={horizontal ? bottom : y}
                  stroke="var(--border)"
                />
                <text
                  x={horizontal ? x : left - 12}
                  y={horizontal ? bottom + 24 : y + 5}
                  textAnchor={horizontal ? "middle" : "end"}
                  fill="currentColor"
                >
                  {tick}
                </text>
              </g>
            );
          })}
          {values.map((value, i) => {
            const step = (horizontal ? plotHeight : plotWidth) / values.length;
            const x = horizontal ? left : left + step * i + step * 0.2;
            const y = horizontal
              ? top + step * i + step * 0.2
              : bottom - (plotHeight * value.count) / 5;
            const barWidth = horizontal
              ? (plotWidth * value.count) / 5
              : step * 0.6;
            const barHeight = horizontal
              ? step * 0.6
              : (plotHeight * value.count) / 5;
            return (
              <g key={`${i}-${value.label}`}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  fill={i % 2 ? "#8059aa" : "#258d78"}
                >
                  <title>
                    {value.label}: {value.count}/5
                  </title>
                </rect>
                <text
                  x={horizontal ? left - 10 : x + barWidth / 2}
                  y={horizontal ? y + barHeight / 2 + 5 : bottom + 24}
                  textAnchor={horizontal ? "end" : "middle"}
                  fill="currentColor"
                >
                  P{i + 1}
                </text>
                <text
                  x={horizontal ? x + barWidth - 8 : x + barWidth / 2}
                  y={horizontal ? y + barHeight / 2 + 5 : y - 8}
                  textAnchor={horizontal ? "end" : "middle"}
                  fill={horizontal ? "#fff" : "currentColor"}
                  fontWeight="700"
                >
                  {value.count}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
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
