"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { home } from "@/lib/permissions";
import type { Profile } from "@/modules/workspace/types";
type UnreadTask = {
  task_id: string;
  title: string;
  unread_count: number;
  last_message_at: string;
};
export function TaskMessageAlerts({ profile }: { profile: Profile }) {
  const [tasks, setTasks] = useState<UnreadTask[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function refresh() {
      if (document.hidden) return;
      try {
        const response = await fetch("/api/task-messages?unread=true", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "No se pudieron consultar los mensajes.",
          );
        if (!controller.signal.aborted) {
          setTasks(data.tasks);
          setError("");
          setLoaded(true);
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setTasks([]);
          setError(
            e instanceof Error
              ? e.message
              : "No se pudieron consultar los mensajes.",
          );
        }
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    window.addEventListener("task-messages-read", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("task-messages-read", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [profile.id]);
  return (
    <section
      className="task-message-alerts"
      aria-label="Mensajes nuevos de tareas"
    >
      <h3>
        Mensajes nuevos de tareas
        {loaded && !error
          ? ` (${tasks.reduce((sum, t) => sum + Number(t.unread_count), 0)})`
          : ""}
      </h3>
      <p className="muted">
        Mensajes de otras personas que aún no has leído. Se actualizan cada 15
        segundos.
      </p>
      {error ? (
        <p role="status">{error}</p>
      ) : !loaded ? (
        <p>Cargando mensajes…</p>
      ) : !tasks.length ? (
        <p>No tienes mensajes nuevos.</p>
      ) : (
        <div className="record-grid">
          {tasks.map((t) => (
            <article className="record" key={t.task_id}>
              <span className="badge">{t.unread_count} sin leer</span>
              <h4>{t.title}</h4>
              <p>
                Último mensaje:{" "}
                {new Date(t.last_message_at).toLocaleString("es-MX")}
              </p>
              <Link
                href={`${home[profile.role]}/tasks/${t.task_id}?conversation=open#conversation-${t.task_id}`}
              >
                Abrir conversación
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
