"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Bell, Check, ChevronRight, Circle, Clock3 } from "lucide-react";
import { stateLabel } from "@/modules/workspace/labels";
import type { Row } from "@/modules/workspace/types";
import {
  applicationProgressCopy,
  progressStages,
  type ApplicationUpdate,
  type TrackedApplication,
} from "@/modules/workspace/application-progress";

type Tracking = {
  applications: TrackedApplication[];
  updates: ApplicationUpdate[];
  unread: ApplicationUpdate[];
  markRead: (ids: string[]) => void;
  loaded: boolean;
  error: string;
  notice: string;
};
const CandidateUpdates = createContext<Tracking>({
  applications: [],
  updates: [],
  unread: [],
  markRead: () => {},
  loaded: false,
  error: "",
  notice: "",
});
function signature(
  applications: { id: string; status?: unknown; updated_at?: unknown }[],
) {
  return applications
    .map((a) => `${a.id}:${a.status}:${a.updated_at}`)
    .sort()
    .join("|");
}
function dateLabel(date: string) {
  return new Date(date).toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
function subscribeReadNotices(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("candidate-notices-read", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("candidate-notices-read", listener);
  };
}

/** Consulta solo el seguimiento propio; los recibos de lectura se conservan en este navegador. */
export function CandidateUpdatesProvider({
  profileId,
  initialApplications,
  children,
}: {
  profileId: string;
  initialApplications: Row[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [applications, setApplications] = useState<TrackedApplication[]>([]);
  const [updates, setUpdates] = useState<ApplicationUpdate[]>([]);
  const [sessionReadIds, setSessionReadIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const last = useRef(signature(initialApplications));
  const initialKey = signature(initialApplications);
  const storageKey = `nexo:application-notices:${profileId}`;
  const getReadSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(storageKey) || "[]";
    } catch {
      return "[]";
    }
  }, [storageKey]);
  const storedRead = useSyncExternalStore(
    subscribeReadNotices,
    getReadSnapshot,
    () => "[]",
  );
  let savedIds: string[] = [];
  try {
    const saved: unknown = JSON.parse(storedRead);
    if (Array.isArray(saved))
      savedIds = saved
        .filter((id): id is string => typeof id === "string")
        .slice(-1000);
  } catch {
    /* Un recibo inválido no interrumpe la consulta de avances. */
  }
  const readIds = [...new Set([...savedIds, ...sessionReadIds])];
  useEffect(() => {
    last.current = initialKey;
  }, [initialKey]);
  useEffect(() => {
    if (!profileId) return;
    const controller = new AbortController();
    let pending = false;
    let first = true;
    let seen = new Set<string>();
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      try {
        const response = await fetch("/api/application-updates", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error || "No se pudieron consultar los avances.",
          );
        if (controller.signal.aborted) return;
        const next: ApplicationUpdate[] = body.updates;
        const arrived = next.filter(
          (event) => !event.initial && !seen.has(event.id),
        );
        if (!first && arrived.length)
          setNotice(
            arrived.length === 1
              ? "Tu postulación tiene una actualización. Revisa la campana de notificaciones."
              : "Tienes nuevas actualizaciones en tus postulaciones. Revisa la campana de notificaciones.",
          );
        first = false;
        seen = new Set(next.map((event) => event.id));
        setApplications(body.applications);
        setUpdates(next);
        setLoaded(true);
        setError("");
        const nextKey = signature(body.applications);
        if (last.current !== nextKey) {
          last.current = nextKey;
          router.refresh();
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron consultar los avances.",
          );
      } finally {
        pending = false;
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [profileId, router]);
  function markRead(ids: string[]) {
    const next = [...new Set([...readIds, ...ids])].slice(-1000);
    setSessionReadIds(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Se conserva la lectura durante la sesión. */
    }
    window.dispatchEvent(new Event("candidate-notices-read"));
    setNotice("");
  }
  const read = new Set(readIds);
  const unread = updates.filter(
    (event) => !event.initial && !read.has(event.id),
  );
  return (
    <CandidateUpdates.Provider
      value={{ applications, updates, unread, markRead, loaded, error, notice }}
    >
      {children}
    </CandidateUpdates.Provider>
  );
}

export function CandidateApplicationNotifications({
  applicationHref = "/candidate/applications",
}: {
  applicationHref?: string;
}) {
  const { applications, updates, unread, loaded, error, markRead } =
    useContext(CandidateUpdates);
  const [open, setOpen] = useState(false);
  const unreadIds = new Set(unread.map((event) => event.id));
  const changes = updates.filter((event) => !event.initial).slice(0, 30);
  return (
    <div
      className="hiring-notifications candidate-notifications"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className="icon-button notification-trigger"
        aria-label={`Notificaciones de postulaciones: ${unread.length} sin leer`}
        aria-expanded={open}
        aria-controls="candidate-notification-panel"
        onClick={() => setOpen(!open)}
      >
        <Bell size={21} aria-hidden="true" />
        {unread.length > 0 && (
          <span className="notification-count">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <section
          className="panel notification-popover"
          id="candidate-notification-panel"
          aria-label="Avances de mis postulaciones"
        >
          <div className="section-head">
            <h2>Tu proceso de selección</h2>
            <span className="badge">{unread.length} sin leer</span>
          </div>
          <p className="muted">
            Aquí aparecen los cambios de etapa de tus postulaciones.
          </p>
          {error && <p role="status">{error}</p>}
          {!loaded && !error && <p role="status">Consultando avances…</p>}
          {loaded && !changes.length && (
            <p>
              Aún no tienes cambios de etapa. Podrás consultar aquí las
              novedades.
            </p>
          )}
          {unread.length > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={() => markRead(unread.map((event) => event.id))}
            >
              Marcar todas como leídas
            </button>
          )}
          <div className="candidate-notice-list">
            {changes.map((event) => {
              const app = applications.find(
                (a) => a.id === event.application_id,
              );
              return (
                <Link
                  className={`candidate-notice ${unreadIds.has(event.id) ? "unread" : ""}`}
                  key={event.id}
                  href={
                    applicationHref === "/candidate/applications"
                      ? `${applicationHref}?stage=${app?.status || event.status}&application=${event.application_id}#postulacion-${event.application_id}`
                      : applicationHref
                  }
                  onClick={() => {
                    markRead([event.id]);
                    setOpen(false);
                  }}
                >
                  <span className="candidate-notice-dot" aria-hidden="true" />
                  <span>
                    <strong>{app?.title || "Mi postulación"}</strong>
                    <span>{stateLabel(event.status)}</span>
                    <small>{dateLabel(event.created_at)}</small>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
          <small className="muted">
            Los avisos se actualizan automáticamente. La lectura se guarda en
            este navegador.
          </small>
        </section>
      )}
    </div>
  );
}

export function CandidateProgressNotice() {
  const { notice } = useContext(CandidateUpdates);
  return notice ? (
    <p className="candidate-progress-notice" role="status">
      <Bell size={18} aria-hidden="true" />
      {notice}
    </p>
  ) : null;
}

export function CandidateApplicationProgress({
  application,
}: {
  application: Row;
}) {
  const { applications, updates, error } = useContext(CandidateUpdates);
  const live = applications.find((a) => a.id === application.id);
  const status = live?.status || String(application.status ?? "POSTULADO");
  const history = updates.filter(
    (event) => event.application_id === application.id,
  );
  const stages = progressStages(status, history);
  const closed = ["RECHAZADO", "RETIRADO"].includes(status);
  return (
    <section
      className={`candidate-progress ${closed ? "closed" : ""}`}
      aria-label="Avance de mi postulación"
    >
      <div className="candidate-progress-heading">
        <span className="eyebrow">TU PROCESO</span>
        <strong>{stateLabel(status)}</strong>
      </div>
      <p>
        {applicationProgressCopy[status] ||
          "Consulta el estado de tu postulación."}
      </p>
      <ol className="candidate-progress-stages" aria-label="Etapas del proceso">
        {stages.map((stage, index) => (
          <li
            key={stage.status}
            className={
              stage.current ? "current" : stage.recorded ? "recorded" : ""
            }
            aria-current={stage.current ? "step" : undefined}
          >
            <span className="candidate-stage-marker" aria-hidden="true">
              {stage.current ? (
                index + 1
              ) : stage.recorded ? (
                <Check size={14} />
              ) : (
                <Circle size={12} />
              )}
            </span>
            <span>
              {stage.label}
              {stage.current && <small>Etapa actual</small>}
            </span>
          </li>
        ))}
      </ol>
      <p className="candidate-progress-caption">
        Las etapas señaladas corresponden a estados registrados; pueden omitirse
        etapas según la vacante.
      </p>
      {status === "ENTREVISTA" && (
        <Link className="candidate-agenda-link" href="/candidate/interviews">
          Consultar mis entrevistas{" "}
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      )}
      <details className="candidate-progress-history">
        <summary>
          <Clock3 size={15} aria-hidden="true" />
          Cambios registrados ({history.length})
        </summary>
        {history.length ? (
          <ol>
            {history.slice(0, 20).map((event) => (
              <li key={event.id}>
                <strong>
                  {event.initial
                    ? "Solicitud recibida"
                    : stateLabel(event.status)}
                </strong>
                <time dateTime={event.created_at}>
                  {dateLabel(event.created_at)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p>Aún no hay cambios de etapa disponibles para consultar.</p>
        )}
        {error && (
          <p role="status">{error} Se muestra el último estado disponible.</p>
        )}
      </details>
    </section>
  );
}
