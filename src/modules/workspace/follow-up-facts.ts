/**
 * @file Hechos de seguimiento calculados en servidor para tareas e incorporación: antigüedad de
 * evidencias y documentos, días de atraso y si un registro sigue abierto. La IA solo redacta sobre
 * estos hechos; cuando no hay registros que respondan, la ruta contesta sin llamar al modelo.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { type Row, type Snapshot, value } from "./types";
import { labels } from "./labels";

const DAY = 86400000;
function daysBetween(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to.slice(0, 10)}T00:00:00Z`) -
      Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) /
      DAY,
  );
}
function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
const closedTaskStates = ["APPROVED", "CANCELLED"];
const closedItemStates = ["COMPLETED", "CANCELLED"];

/** Motivo de seguimiento literal; null cuando el registro está cerrado o al corriente. */
function followUp(status: string, due: string, today: string, closed: boolean) {
  if (closed) return null;
  if (status === "SUBMITTED") return "entregada, pendiente de revisión";
  if (!due) return "abierta sin fecha límite";
  const overdue = daysBetween(due, today);
  if (overdue > 0) return `vencida hace ${overdue} días`;
  if (overdue === 0) return "vence hoy";
  if (overdue >= -7) return `vence en ${-overdue} días`;
  return null;
}
export const followUpRules =
  "Reglas verificadas: una tarea o actividad aprobada, completada o cancelada está cerrada y NUNCA requiere seguimiento ni atención. Solo requieren seguimiento los registros con follow_up distinto de null, y por ese motivo literal. overdue_days mayor que cero significa que el plazo ya se incumplió: no digas que falta cumplirlo. days_ago indica la antigüedad real de una evidencia o documento; recientes son solo los incluidos en el periodo indicado. Si una lista está vacía, di que no hay registros de ese tipo en el periodo y filtros; no sustituyas la pregunta por otros datos.";

export function taskFollowUpFacts(
  data: Snapshot,
  today = new Date().toISOString().slice(0, 10),
  periodDays = 30,
) {
  const tasks = (data.tasks ?? []).slice(0, 200).map((t) => {
    const status = value(t, "status");
    const due = value(t, "due_date");
    const closed = closedTaskStates.includes(status);
    const overdue = due && !closed ? daysBetween(due, today) : 0;
    return {
      title: value(t, "title"),
      status,
      priority: value(t, "priority") || null,
      due_date: due || null,
      closed,
      overdue_days: overdue > 0 ? overdue : 0,
      evidence_files: (data.task_evidence ?? []).filter(
        (e) => e.task_id === t.id,
      ).length,
      follow_up: followUp(status, due, today, closed),
    };
  });
  const titles = new Map((data.tasks ?? []).map((t) => [t.id, t]));
  const evidence = (data.task_evidence ?? [])
    .filter((e) => titles.has(String(e.task_id)))
    .map((e) => {
      const task = titles.get(String(e.task_id)) as Row;
      const submitted = value(e, "created_at").slice(0, 10);
      return {
        task_title: value(task, "title"),
        task_status: value(task, "status"),
        submitted_on: submitted,
        days_ago: submitted ? daysBetween(submitted, today) : null,
        pending_review: value(task, "status") === "SUBMITTED",
        content_read: false,
      };
    })
    .filter((e) => e.days_ago !== null && e.days_ago <= periodDays)
    .sort((a, b) => (a.days_ago ?? 0) - (b.days_ago ?? 0));
  return {
    today,
    evidence_period_days: periodDays,
    evidence_available: Array.isArray(data.task_evidence),
    recent_evidence: evidence,
    tasks,
    rules: followUpRules,
  };
}

export function onboardingFollowUpFacts(
  data: Snapshot,
  today = new Date().toISOString().slice(0, 10),
  periodDays = 30,
) {
  const plans = new Map((data.onboarding ?? []).map((o) => [o.id, o]));
  const items = (data.onboarding_items ?? [])
    .filter((i) => plans.has(String(i.onboarding_id)))
    .slice(0, 200)
    .map((i) => {
      const status = value(i, "status");
      const due = value(i, "due_date");
      const closed = closedItemStates.includes(status);
      const overdue = due && !closed ? daysBetween(due, today) : 0;
      return {
        title: value(i, "title"),
        status,
        owner_role: value(i, "owner_role") || null,
        employee_id: String(plans.get(String(i.onboarding_id))?.employee_id),
        due_date: due || null,
        closed,
        overdue_days: overdue > 0 ? overdue : 0,
        follow_up: followUp(status, due, today, closed),
      };
    });
  const documents = (data.onboarding_documents ?? [])
    .filter((d) => plans.has(String(d.onboarding_id)))
    .map((d) => {
      const submitted = value(d, "created_at").slice(0, 10);
      return {
        employee_id: String(plans.get(String(d.onboarding_id))?.employee_id),
        submitted_on: submitted,
        days_ago: submitted ? daysBetween(submitted, today) : null,
        content_read: false,
      };
    })
    .filter((d) => d.days_ago !== null && d.days_ago <= periodDays)
    .sort((a, b) => (a.days_ago ?? 0) - (b.days_ago ?? 0));
  return {
    today,
    document_period_days: periodDays,
    documents_available: Array.isArray(data.onboarding_documents),
    recent_documents: documents,
    items,
    rules: followUpRules,
  };
}

export function asksAboutEvidence(prompt: string) {
  return /\bevidencias?\b|\bentreg(?:as|aron|ado|ada|ados|adas)\b|\barchivos?\b/.test(
    normalize(prompt),
  );
}
export function asksAboutDocuments(prompt: string) {
  return /\bdocumentos?\b|\bentreg(?:as|aron|ado|ada|ados|adas)\b|\barchivos?\b/.test(
    normalize(prompt),
  );
}
export function periodDaysFrom(days?: string, fallback = 30) {
  const n = Number(days);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Respuesta fija y verdadera cuando no hay registros del tipo preguntado; evita que el modelo rellene. */
export function emptyEvidenceAnswer(
  kind: "evidencias" | "documentos",
  periodDays: number,
  available: boolean,
  pendingReview: number,
) {
  if (!available)
    return `No se dispone del listado de ${kind} para esta consulta, así que no puedo confirmar entregas recientes. Revisa el módulo directamente.`;
  return `No hay ${kind} ${kind === "evidencias" ? "entregadas" : "entregados"} en los últimos ${periodDays} días con los filtros actuales, así que no hay nada reciente que requiera seguimiento${
    pendingReview
      ? `. Sí hay ${pendingReview} ${pendingReview === 1 ? "registro entregado pendiente" : "registros entregados pendientes"} de revisión de fechas anteriores`
      : ""
  }.`;
}

/** Títulos entrecomillados en la respuesta que no coinciden con ningún registro autorizado. */
export function inventedTitles(text: string, knownTitles: string[]) {
  // Las etiquetas de estado («En revisión», «Pendiente») se citan a menudo y no son registros.
  const known = [...knownTitles, ...Object.values(labels)]
    .map(normalize)
    .filter(Boolean);
  const quoted = [...text.matchAll(/[«"“']([^»"”']{8,160})[»"”']/g)].map(
    (m) => m[1],
  );
  return quoted.filter((candidate) => {
    const needle = normalize(candidate);
    return (
      needle.length >= 8 &&
      !known.some((title) => title.includes(needle) || needle.includes(title))
    );
  });
}
