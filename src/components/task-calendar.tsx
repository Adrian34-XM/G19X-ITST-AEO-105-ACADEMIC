"use client";
import { nonWorkingDay } from "@/lib/working-days";
import { useState } from "react";
import Link from "next/link";
import { type Row, value } from "@/modules/workspace/types";
import { sortTasks } from "@/modules/workspace/tasks";
import { stateLabel } from "@/modules/workspace/labels";

/** Recibe exclusivamente las tareas ya autorizadas y filtradas por el espacio de trabajo. */
export function TaskCalendar({
  tasks,
  basePath,
}: {
  tasks: Row[];
  basePath: string;
}) {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selected, setSelected] = useState("");
  const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (month.getDay() + 6) % 7;
  const monthTasks = tasks.filter(
    (t) => value(t, "due_date").slice(0, 7) === prefix,
  );
  const selectedTasks = sortTasks(
    tasks.filter((t) => value(t, "due_date").slice(0, 10) === selected),
  );
  function move(delta: number) {
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
    setSelected("");
  }
  return (
    <section className="panel task-calendar" aria-label="Calendario de tareas">
      <div className="section-head">
        <h2>Calendario de tareas</h2>
        <div className="actions">
          <button
            className="secondary"
            aria-label="Mes anterior de tareas"
            onClick={() => move(-1)}
          >
            ←
          </button>
          <strong aria-live="polite">
            {month.toLocaleDateString("es-MX", {
              month: "long",
              year: "numeric",
            })}
          </strong>
          <button
            className="secondary"
            aria-label="Mes siguiente de tareas"
            onClick={() => move(1)}
          >
            →
          </button>
        </div>
      </div>
      <p>
        <strong>{monthTasks.length} tareas este mes</strong> · {tasks.length} en
        los resultados filtrados, incluyendo pendientes, entregadas y aprobadas.
      </p>
      <p>
        Se agrupan por fecha límite. El recuadro toma el color de la prioridad
        más alta del día: alta (rojo), media (ámbar), baja (verde).
      </p>
      <div className="calendar-grid">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <strong key={d}>{d}</strong>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${prefix}-${String(i + 1).padStart(2, "0")}`;
          const items = sortTasks(
            monthTasks.filter(
              (t) => value(t, "due_date").slice(0, 10) === date,
            ),
          );
          const counts = ["HIGH", "MEDIUM", "LOW"]
            .map((p) => ({
              priority: p,
              count: items.filter((t) => t.priority === p).length,
            }))
            .filter((p) => p.count);
          return (
            <button
              key={date}
              className="calendar-day task-calendar-day"
              title={nonWorkingDay(date) ?? "Día hábil"}
              data-priority={items[0]?.priority as string | undefined}
              aria-pressed={selected === date}
              aria-label={`${date}: ${items.length} tareas${counts.map((p) => `, ${p.count} prioridad ${stateLabel(p.priority)}`).join("")}`}
              onClick={() => setSelected(date)}
            >
              <span>{i + 1}</span>
              <small>
                {items.length
                  ? `${items.length} tarea${items.length === 1 ? "" : "s"}`
                  : "Sin tareas"}
              </small>
              {counts.map((p) => (
                <small
                  key={p.priority}
                  className="task-calendar-count"
                  data-priority={p.priority}
                >
                  {stateLabel(p.priority)}: {p.count}
                </small>
              ))}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="calendar-agenda" aria-live="polite">
          <h3>
            Tareas con fecha límite {selected.split("-").reverse().join("/")}
          </h3>
          {selectedTasks.map((t) => (
            <article
              className="record task-priority-card"
              data-priority={value(t, "priority")}
              key={t.id}
            >
              <h4>{value(t, "title")}</h4>
              <p>
                Prioridad {stateLabel(value(t, "priority"))} ·{" "}
                {stateLabel(value(t, "status"))}
              </p>
              <Link href={`${basePath}/${t.id}`}>Ver tarea y evidencias</Link>
            </article>
          ))}
          {!selectedTasks.length && (
            <p>No hay tareas con fecha límite en este día.</p>
          )}
        </div>
      )}
    </section>
  );
}
