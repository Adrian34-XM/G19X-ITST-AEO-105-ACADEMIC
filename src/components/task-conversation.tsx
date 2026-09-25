"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { stateLabel } from "@/modules/workspace/labels";
type Message = {
  id: string;
  sequence: number;
  author_id: string;
  author_name: string;
  author_role: string;
  body: string;
  created_at: string;
};
export function TaskConversation({
  taskId,
  userId,
}: {
  taskId: string;
  userId: string;
}) {
  const search = useSearchParams();
  const [toggled, setOpen] = useState<boolean | null>(null);
  const open = toggled ?? search.get("conversation") === "open";
  return (
    <section className="task-conversation" id={`conversation-${taskId}`}>
      <button
        type="button"
        className="secondary"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Cerrar conversación" : "Conversación de la tarea"}
      </button>
      {open && <Conversation key={taskId} taskId={taskId} userId={userId} />}
    </section>
  );
}
function Conversation({ taskId, userId }: { taskId: string; userId: string }) {
  const [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false),
    [older, setOlder] = useState(false),
    [hasMore, setHasMore] = useState(false),
    [closed, setClosed] = useState(false);
  const initialized = useRef(false);
  const pending = useRef<{ id: string; text: string } | null>(null);
  async function load(before?: number, signal?: AbortSignal) {
    const r = await fetch(
      `/api/task-messages?task=${taskId}${before ? `&before=${before}` : ""}`,
      { cache: "no-store", signal },
    );
    const data = await r.json();
    if (!r.ok) {
      if (r.status === 403 || r.status === 404) {
        setMessages([]);
        setClosed(true);
      }
      throw new Error(data.error || "No se pudo cargar la conversación.");
    }
    setMessages((old) =>
      Array.from(
        new Map(
          [...old, ...data.messages].map((m: Message) => [m.id, m]),
        ).values(),
      ).sort((a, b) => a.sequence - b.sequence),
    );
    if (before || !initialized.current) setHasMore(data.hasMore);
    initialized.current = true;
    setClosed(data.closed);
    setError("");
    // Confirma únicamente el lote entregado, nunca mensajes que lleguen después.
    const latest = data.messages.at(-1)?.sequence;
    if (!before && latest && !document.hidden) {
      const ack = await fetch("/api/task-messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: taskId, through_sequence: latest }),
        signal,
      });
      if (!ack.ok)
        throw new Error(
          "Los mensajes se cargaron, pero no se pudieron marcar como leídos.",
        );
      window.dispatchEvent(new Event("task-messages-read"));
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        await load(undefined, controller.signal);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "No se pudo cargar.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
    // La conversación se desmonta al cerrar o cambiar de tarea.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);
  return (
    <div className="task-chat-panel">
      <h4>Conversación de la tarea</h4>
      <p>
        Visible para el responsable de la tarea, los jefes autorizados y RH. Se
        actualiza cada 15 segundos mientras está abierta.
      </p>
      <button
        type="button"
        className="quiet"
        disabled={loading}
        onClick={() => void load().catch((e) => setError(e.message))}
      >
        Actualizar mensajes
      </button>
      {hasMore && (
        <button
          type="button"
          className="secondary"
          disabled={older}
          onClick={async () => {
            setOlder(true);
            try {
              await load(messages[0]?.sequence);
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo cargar.");
            } finally {
              setOlder(false);
            }
          }}
        >
          {older ? "Cargando…" : "Ver mensajes anteriores"}
        </button>
      )}
      <div
        className="task-chat-messages"
        role="log"
        aria-label="Mensajes de la tarea"
        aria-live="polite"
      >
        {messages.map((m) => (
          <article
            key={m.id}
            className="task-chat-message"
            data-own={m.author_id === userId}
          >
            <strong>
              {m.author_name}
              {m.author_id === userId ? " (tú)" : ""}
            </strong>
            <small>
              {stateLabel(m.author_role)} ·{" "}
              {new Date(m.created_at).toLocaleString("es-MX")}
            </small>
            <p>{m.body}</p>
          </article>
        ))}
        {loading && <p>Cargando conversación…</p>}
        {!loading && !messages.length && !error && (
          <p>
            Aún no hay mensajes. Puedes preguntar o aclarar las instrucciones
            aquí.
          </p>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {closed ? (
        <p>
          La tarea está aprobada. La conversación queda disponible para
          consulta.
        </p>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (sending || !text.trim()) return;
            setSending(true);
            setError("");
            const draft = text.trim();
            if (!pending.current || pending.current.text !== draft)
              pending.current = { id: crypto.randomUUID(), text: draft };
            try {
              const r = await fetch("/api/task-messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  task: taskId,
                  message: draft,
                  message_id: pending.current.id,
                }),
              });
              const result = await r.json();
              if (!r.ok)
                throw new Error(
                  result.error || "No se pudo enviar el mensaje.",
                );
              setText("");
              pending.current = null;
              await load();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo enviar.");
            } finally {
              setSending(false);
            }
          }}
        >
          <label>
            Mensaje
            <textarea
              value={text}
              maxLength={3000}
              disabled={sending || loading}
              onChange={(e) => setText(e.target.value)}
              required
              rows={3}
              placeholder="Escribe una duda o aclaración sobre esta tarea…"
            />
          </label>
          <small>{text.length}/3000 caracteres</small>
          <button disabled={sending || loading || !text.trim()}>
            {sending ? "Enviando…" : "Enviar mensaje"}
          </button>
        </form>
      )}
    </div>
  );
}
