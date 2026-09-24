"use client";
/** Filtros y recomendaciones de las postulaciones visibles. Los enlaces apuntan
 * a las tarjetas del listado; el CV se obtiene mediante la descarga autorizada. */
import { applicationSections } from "@/modules/workspace/application-sections";
import { useState } from "react";
import { recommendation } from "@/lib/ai/schemas";
import { type Row, type Snapshot, value } from "@/modules/workspace/types";

export function rankApplications(applications: Row[]) {
  const score = (r: Row) => {
    const p = recommendation.safeParse(r.ai_result);
    return p.success ? p.data.score : -1;
  };
  return applications
    .slice()
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

export function recommendedApplications(applications: Row[], minimum: number) {
  return applications
    .flatMap((application) => {
      if (["CONTRATADO", "RECHAZADO"].includes(value(application, "status")))
        return [];
      const parsed = recommendation.safeParse(application.ai_result);
      return parsed.success && parsed.data.score >= minimum
        ? [{ application, result: parsed.data }]
        : [];
    })
    .sort(
      (a, b) =>
        b.result.score - a.result.score ||
        a.application.id.localeCompare(b.application.id),
    );
}

export function ApplicationSummary({
  data,
  applications,
  selected,
  select,
  busy,
  openCv,
  status = "POSTULADO",
}: {
  data: Snapshot;
  applications: Row[];
  selected: string;
  select: (id: string) => void;
  busy: boolean;
  openCv: (id: string) => Promise<void>;
  status?: string;
}) {
  const [minimum, setMinimum] = useState(70);
  const all = (data.applications ?? []).filter((a) => a.status === status);
  const history = ["CONTRATADO", "RECHAZADO"].includes(status);
  const vacancies = data.vacancies ?? [];
  const visible = applications.filter((a) => a.status === status);
  const ranked = recommendedApplications(visible, minimum);
  const pending = visible.filter(
    (a) =>
      !["CONTRATADO", "RECHAZADO"].includes(value(a, "status")) &&
      !recommendation.safeParse(a.ai_result).success,
  ).length;
  return (
    <section className="panel" aria-label="Resumen de postulaciones">
      <h2>{applicationSections[status]} por vacante</h2>
      <label htmlFor="application-vacancy">Filtrar por vacante</label>
      <select
        id="application-vacancy"
        value={selected}
        onChange={(e) => select(e.target.value)}
      >
        <option value="">Todas las vacantes ({all.length})</option>
        {vacancies.map((v) => (
          <option value={v.id} key={v.id}>
            {value(v, "title")} (
            {all.filter((a) => a.vacancy_id === v.id).length})
          </option>
        ))}
      </select>
      <div className="chips" aria-label="Cantidad por vacante">
        {vacancies.map((v) => (
          <button
            type="button"
            className="secondary"
            key={v.id}
            aria-pressed={selected === v.id}
            onClick={() => select(selected === v.id ? "" : v.id)}
          >
            {value(v, "title")}:{" "}
            {all.filter((a) => a.vacancy_id === v.id).length}
          </button>
        ))}
      </div>
      <p>
        Los conteos corresponden a {applicationSections[status].toLowerCase()}{" "}
        de las vacantes cargadas. Se muestran {visible.length} con los filtros
        actuales.
      </p>
      {!history && (
        <>
          <h2>✧ Candidatos recomendados</h2>
          <label htmlFor="application-score">
            Puntuación mínima: {minimum}/100
          </label>
          <input
            id="application-score"
            type="range"
            min="0"
            max="100"
            step="1"
            value={minimum}
            onChange={(e) => setMinimum(Number(e.target.value))}
          />
          <p role="status">
            {ranked.length} postulaciones cumplen la puntuación mínima.{" "}
            {pending} pendientes de evaluación.
          </p>
          <p className="muted">
            Se utilizan evaluaciones de IA guardadas y se excluyen contratados y
            rechazados. La puntuación corresponde a cada vacante; requiere
            revisión humana.
          </p>
          <div className="record-grid">
            {ranked.map(({ application: a, result }) => {
              const candidate = (data.candidates ?? []).find(
                (c) => c.id === a.candidate_id,
              );
              const person = (data.profiles ?? []).find(
                (p) => p.id === candidate?.profile_id,
              );
              const vacancy = vacancies.find((v) => v.id === a.vacancy_id);
              return (
                <article className="ai-result" key={a.id}>
                  <h3>
                    {person ? value(person, "full_name") : "Postulante"} ·{" "}
                    {result.score}/100
                  </h3>
                  <p>{vacancy ? value(vacancy, "title") : "Vacante"}</p>
                  <p>{result.summary}</p>
                  <div className="actions">
                    <a className="secondary" href={`#postulacion-${a.id}`}>
                      Ir a su tarjeta
                    </a>
                    <button
                      className="secondary"
                      disabled={busy || !candidate?.cv_path}
                      onClick={() => void openCv(value(a, "candidate_id"))}
                    >
                      Ver CV privado
                    </button>
                  </div>
                </article>
              );
            })}
            {!ranked.length && (
              <p className="empty">
                No hay evaluaciones que alcancen esta puntuación. Ajusta el
                mínimo o evalúa las postulaciones pendientes desde sus tarjetas.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
