"use client";
/**
 * @file Entrega y consulta de evidencias formativas, recursos sugeridos y opinión de IA. Conserva
 * observaciones de rechazo para orientar una nueva entrega; la validación final corresponde al
 * responsable autorizado.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { request } from "./forms";
import { type Row, value } from "@/modules/workspace/types";

/** Conserva las instrucciones de la última revisión mientras se prepara otra entrega. */
export function TrainingReviewMessage({
  assignment,
  reviewer,
}: {
  assignment: Row;
  reviewer?: string;
}) {
  const message = value(assignment, "review_comments").trim();
  if (!message) return null;
  const correctionDate = value(assignment, "evidence_required_after");
  const reviewDate = value(assignment, "reviewed_at");
  const rejected =
    assignment.status !== "COMPLETED" &&
    !!correctionDate &&
    (!reviewDate || Date.parse(correctionDate) >= Date.parse(reviewDate));
  return (
    <aside
      className="training-review-message"
      role="note"
      aria-label="Observaciones de la revisión"
      data-rejected={rejected}
    >
      <h4>
        {rejected
          ? "Evidencia rechazada: requiere correcciones"
          : "Observaciones del responsable"}
      </h4>
      <p>
        <strong>{reviewer || "Responsable de la revisión"}</strong>
        {(reviewDate || correctionDate) && (
          <>
            {" "}
            · {new Date(reviewDate || correctionDate).toLocaleString("es-MX")}
          </>
        )}
      </p>
      <p className="training-review-comments">{message}</p>
      {rejected && (
        <p>
          {assignment.progress_review_pending
            ? "Tu nueva evidencia está pendiente de revisión. Estas son las correcciones que se solicitaron."
            : "Revisa lo solicitado, adjunta una nueva evidencia corregida y registra el avance correspondiente para enviarlo nuevamente a revisión."}
        </p>
      )}
    </aside>
  );
}
type Resource = {
  title: string;
  kind: "VIDEO" | "RESOURCE";
  query: string;
  reason: string;
};
type Opinion = {
  summary: string;
  demonstrated: string[];
  missing: string[];
  recommendation: string;
};
export function TrainingResources({ courseId }: { courseId: string }) {
  const [prompt, setPrompt] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [items, setItems] = useState<Resource[]>([]);
  return (
    <details>
      <summary>Videos y recursos recomendados con IA</summary>
      <label>
        ¿Qué necesitas aprender o reforzar?
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={1500}
        />
      </label>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const r = await request("/api/training", {
              mode: "resources",
              id: courseId,
              prompt,
            });
            setItems(r.result.resources);
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo recomendar.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Buscando sugerencias…" : "Recomendar videos y recursos"}
      </button>
      <p>
        La IA sugiere búsquedas. Revisa el contenido y confirma que sea gratuito
        antes de utilizarlo.
      </p>
      {items.map((r, i) => (
        <article className="record" key={i}>
          <h4>{r.title}</h4>
          <p>{r.reason}</p>
          <a
            href={
              r.kind === "VIDEO"
                ? `https://www.youtube.com/results?search_query=${encodeURIComponent(r.query)}`
                : `https://www.google.com/search?q=${encodeURIComponent(r.query + " recurso gratuito")}`
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            {r.kind === "VIDEO" ? "Buscar video" : "Buscar recurso"} ↗
          </a>
        </article>
      ))}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
export function TrainingEvidence({
  assignmentId,
  progress,
  status,
  own,
  canReview,
  onSaved,
  reviewMessage,
}: {
  assignmentId: string;
  progress: number;
  status: string;
  own: boolean;
  canReview: boolean;
  onSaved: () => void;
  reviewMessage?: ReactNode;
}) {
  const [items, setItems] = useState<
      { id: string; progress: number; created_at: string }[]
    >([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [opinions, setOpinions] = useState<Record<string, Opinion>>({});
  async function load() {
    const r = await fetch("/api/training?assignment=" + assignmentId);
    const b = await r.json();
    if (!r.ok) throw new Error(b.error);
    setItems(b.evidence);
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {reviewMessage}
      <details
        onToggle={(e) => {
          if (e.currentTarget.open) void run(load);
        }}
      >
        <summary>Evidencias de avance y opinión de IA</summary>
        <p>
          El avance se respalda con archivos. Solo RH o tu jefe autorizado
          pueden confirmar la finalización; la IA aporta una opinión.
        </p>
        {own && !["SUBMITTED", "COMPLETED"].includes(status) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const element = e.currentTarget;
              const form = new FormData(element);
              void run(async () => {
                const files = form.getAll("file");
                if (files.length > 10)
                  throw new Error("Selecciona hasta diez archivos.");
                let count = 0;
                setMessage("");
                try {
                  for (const file of files) {
                    const f = new FormData();
                    f.set("bucket", "course-evidence");
                    f.set("id", assignmentId);
                    f.set("progress", String(form.get("progress")));
                    f.set("file", file);
                    const r = await fetch("/api/files", {
                      method: "POST",
                      body: f,
                    });
                    const b = await r.json();
                    if (!r.ok) throw new Error(b.error);
                    count++;
                  }
                } finally {
                  if (count) {
                    element.reset();
                    setMessage(
                      `${count} archivos guardados. Registra ahora el avance correspondiente.`,
                    );
                    await load();
                    onSaved();
                  }
                }
              });
            }}
          >
            <label>
              Avance que respalda la evidencia (%)
              <input
                name="progress"
                type="number"
                min={Math.max(1, progress)}
                max={100}
                defaultValue={Math.min(100, progress + 25)}
                required
              />
            </label>
            <label>
              Archivos (PDF, TXT, PNG o JPG; hasta 5 MB cada uno)
              <input
                name="file"
                type="file"
                accept=".pdf,.txt,.png,.jpg,.jpeg"
                multiple
                required
              />
            </label>
            <button disabled={busy}>Subir evidencias</button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}
        {items.map((e) => (
          <article className="record" key={e.id}>
            <strong>Evidencia de avance: {e.progress}%</strong>
            <p>{new Date(e.created_at).toLocaleString("es-MX")}</p>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await fetch(
                    "/api/files?bucket=course-evidence&id=" + e.id,
                  );
                  const b = await r.json();
                  if (!r.ok) throw new Error(b.error);
                  window.open(b.url, "_blank", "noopener,noreferrer");
                })
              }
            >
              Abrir archivo
            </button>
            {canReview && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await request("/api/training", {
                      mode: "evidence",
                      id: e.id,
                    });
                    setOpinions((old) => ({ ...old, [e.id]: r.result }));
                  })
                }
              >
                Analizar evidencia con IA
              </button>
            )}
            {opinions[e.id] && (
              <div>
                <p>{opinions[e.id].summary}</p>
                <h4>Qué se puede comprobar</h4>
                {!opinions[e.id].demonstrated.length && (
                  <p>
                    No se identificaron resultados comprobables en este archivo.
                  </p>
                )}
                <ul>
                  {opinions[e.id].demonstrated.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                <h4>Qué falta por comprobar</h4>
                {!opinions[e.id].missing.length && (
                  <p>
                    El análisis no señaló faltantes; confirma el resultado
                    revisando el archivo.
                  </p>
                )}
                <ul>
                  {opinions[e.id].missing.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
                <p>
                  Opinión orientativa:{" "}
                  {
                    {
                      SUFFICIENT: "La evidencia parece suficiente",
                      MORE_EVIDENCE: "Se necesita más evidencia",
                      HUMAN_REVIEW: "Requiere revisión humana",
                    }[opinions[e.id].recommendation]
                  }
                  . La aprobación final es del responsable.
                </p>
                <p>
                  <strong>Siguiente paso: </strong>
                  {opinions[e.id].recommendation === "MORE_EVIDENCE"
                    ? "Solicita una evidencia que cubra los puntos pendientes y explica al colaborador qué debe completar."
                    : opinions[e.id].recommendation === "SUFFICIENT"
                      ? "Contrasta el archivo con lo solicitado y decide qué porcentaje de avance puedes validar."
                      : "Revisa el archivo manualmente y pide una aclaración si no permite comprobar lo solicitado."}
                </p>
              </div>
            )}
          </article>
        ))}
        {!busy && !items.length && <p>Aún no hay evidencias registradas.</p>}
      </details>
    </>
  );
}
