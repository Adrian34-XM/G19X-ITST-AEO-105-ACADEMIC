"use client";
import Link from "next/link";
import { useState } from "react";
import { recommendation } from "@/lib/ai/schemas";
import { type Snapshot, value } from "@/modules/workspace/types";

export function RecruitmentRecommendations({
  data,
  initialVacancy,
  busy,
  analyze,
}: {
  data: Snapshot;
  initialVacancy?: string;
  busy: boolean;
  analyze: (kind: string, id: string) => Promise<void>;
}) {
  const vacancies = data.vacancies ?? [];
  const [selected, setSelected] = useState(
    initialVacancy ?? vacancies[0]?.id ?? "",
  );
  const [onlyHigh, setOnlyHigh] = useState(false);
  const vacancy = vacancies.find((v) => v.id === selected);
  const applications = (data.applications ?? []).filter(
    (a) =>
      a.vacancy_id === selected &&
      !["CONTRATADO", "RECHAZADO"].includes(value(a, "status")),
  );
  const ranked = applications
    .map((application) => {
      const parsed = recommendation.safeParse(application.ai_result);
      return { application, result: parsed.success ? parsed.data : null };
    })
    .sort(
      (a, b) =>
        (b.result?.score ?? -1) - (a.result?.score ?? -1) ||
        a.application.id.localeCompare(b.application.id),
    );
  const evaluated = ranked.filter((r) => r.result).length;
  const visible = ranked.filter(
    (r) => !onlyHigh || r.result?.match_level === "HIGH",
  );
  return (
    <section aria-label="Recomendaciones de postulantes">
      <div className="panel">
        <span className="eyebrow">RECLUTAMIENTO · ASISTENCIA IA</span>
        <h2>Postulantes recomendados por vacante</h2>
        <p>
          Compara la experiencia, habilidades y CV con los requisitos de la
          vacante. La puntuación expresa afinidad estimada, no una probabilidad
          de éxito. Revisa el perfil antes de decidir.
        </p>
        <label htmlFor="recommendation-vacancy">Vacante</label>
        <select
          id="recommendation-vacancy"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={busy}
        >
          {!vacancies.length && <option value="">No hay vacantes</option>}
          {vacancies.map((v) => (
            <option key={v.id} value={v.id}>
              {value(v, "title")}
            </option>
          ))}
        </select>
        {vacancy && (
          <>
            <p>
              <strong>Requisitos:</strong> {value(vacancy, "requirements")}
            </p>
            <p>
              <strong>Habilidades:</strong> {value(vacancy, "skills")} ·{" "}
              {value(vacancy, "experience_required")} años de experiencia
            </p>
            <p>
              {applications.length} postulaciones activas · {evaluated}{" "}
              evaluadas · {applications.length - evaluated} pendientes
            </p>
          </>
        )}
        <label>
          <input
            type="checkbox"
            checked={onlyHigh}
            onChange={(e) => setOnlyHigh(e.target.checked)}
          />{" "}
          Mostrar solo afinidad alta
        </label>
        <p className="muted">
          Ordenadas por puntuación de mayor a menor; las pendientes aparecen al
          final. Se excluyen postulaciones contratadas y rechazadas. Los
          análisis guardados corresponden a la información disponible cuando se
          generaron.
        </p>
      </div>
      <div className="record-grid">
        {visible.map(({ application: a, result }) => {
          const candidate = (data.candidates ?? []).find(
            (c) => c.id === a.candidate_id,
          );
          const person = (data.profiles ?? []).find(
            (p) => p.id === candidate?.profile_id,
          );
          return (
            <article className="record" key={a.id}>
              <span className="eyebrow">
                {result ? "EVALUACIÓN GUARDADA" : "PENDIENTE DE EVALUAR"}
              </span>
              <h3>{person ? value(person, "full_name") : "Postulante"}</h3>
              {candidate && (
                <p>
                  {value(candidate, "skills")} ·{" "}
                  {value(candidate, "experience_years")} años de experiencia
                </p>
              )}
              {result ? (
                <section className="ai-result">
                  <h3>
                    {result.score}/100 · Afinidad{" "}
                    {
                      { HIGH: "alta", MEDIUM: "media", LOW: "baja" }[
                        result.match_level
                      ]
                    }
                  </h3>
                  <p>{result.summary}</p>
                  <strong>Fortalezas</strong>
                  <ul>
                    {result.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  <strong>Brechas por revisar</strong>
                  <ul>
                    {result.gaps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                  <small>
                    Recomendación orientativa. Requiere revisión humana.
                  </small>
                </section>
              ) : (
                <p>
                  Genera una evaluación para incluir esta postulación en la
                  comparación. Si el proveedor falla, seguirá pendiente.
                </p>
              )}
              <div className="actions">
                {!result && (
                  <button
                    className="ai-button"
                    disabled={busy}
                    onClick={() => void analyze("recruitment", a.id)}
                  >
                    {busy ? "Procesando…" : "✧ Evaluar con IA"}
                  </button>
                )}
                <Link className="secondary" href={`/rh/applications/${a.id}`}>
                  Revisar postulación
                </Link>
              </div>
            </article>
          );
        })}
        {!visible.length && (
          <p className="empty">
            {onlyHigh
              ? "No hay evaluaciones de afinidad alta para esta vacante. Desactiva el filtro para ver las pendientes."
              : "Esta vacante todavía no tiene postulaciones activas."}
          </p>
        )}
      </div>
    </section>
  );
}
