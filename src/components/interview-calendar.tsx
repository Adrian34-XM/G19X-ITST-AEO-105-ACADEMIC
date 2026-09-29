"use client";
/**
 * @file Calendario de entrevistas con indicación de días ocupados y selección de fecha. Las
 * comprobaciones visuales se complementan con validaciones de fechas y conflictos en servidor y
 * SQL.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Agenda local: el servidor conserva la validación definitiva de conflictos. */
import { nonWorkingDay, mexicoDate } from "@/lib/working-days";
import { useState } from "react";
import { type Snapshot, type Row, value } from "@/modules/workspace/types";
export function InterviewCalendar({
  data,
  onSelect,
}: {
  data: Snapshot;
  onSelect: (row: Row) => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState("");
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const active = (data.interviews ?? []).filter(
    (i) => i.status === "SCHEDULED",
  );
  const dayItems = active.filter(
    (i) => mexicoDate(value(i, "scheduled_at")) === selected,
  );
  const offset = (month.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const person = (i: Row) => {
    const a = (data.applications ?? []).find((a) => a.id === i.application_id);
    const c = (data.candidates ?? []).find((c) => c.id === a?.candidate_id);
    return (
      value(
        (data.profiles ?? []).find((p) => p.id === c?.profile_id) ?? { id: "" },
        "full_name",
      ) || "Candidato"
    );
  };
  return (
    <section className="panel interview-calendar">
      <div className="section-head">
        <h2>Calendario de entrevistas</h2>
        <div className="actions">
          <button
            className="secondary"
            aria-label="Mes anterior"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
            }
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
            aria-label="Mes siguiente"
            onClick={() =>
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
            }
          >
            →
          </button>
        </div>
      </div>
      <p>
        Selecciona un día para elegir candidato y horario. Hora local:{" "}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}. Cada cita reserva 60
        minutos.
      </p>
      <div className="calendar-grid">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
          <strong key={d}>{d}</strong>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`empty-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = key(
            new Date(month.getFullYear(), month.getMonth(), i + 1),
          );
          const total = active.filter(
            (a) => mexicoDate(value(a, "scheduled_at")) === date,
          ).length;
          return (
            <button
              className={`calendar-day${total ? " calendar-day--scheduled" : ""}`}
              aria-pressed={selected === date}
              aria-label={`${date}: ${total ? `${total} entrevista${total === 1 ? " agendada" : "s agendadas"}` : "Sin entrevistas agendadas"}`}
              key={date}
              disabled={!!nonWorkingDay(date) && total === 0}
              title={nonWorkingDay(date) ?? "Día hábil"}
              onClick={() => setSelected(date)}
            >
              <span>{i + 1}</span>
              <small>
                {total
                  ? `${total} cita${total === 1 ? "" : "s"}`
                  : (nonWorkingDay(date) ?? "Disponible")}
              </small>
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="calendar-agenda">
          <h3>Agenda del {selected}</h3>
          {dayItems.map((i) => (
            <button
              className="secondary"
              key={i.id}
              onClick={() => onSelect(i)}
            >
              {new Date(value(i, "scheduled_at")).toLocaleTimeString("es-MX", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {person(i)} · Editar
            </button>
          ))}
          {!dayItems.length && <p>No hay citas programadas este día.</p>}
          <button
            disabled={selected < key(new Date()) || !!nonWorkingDay(selected)}
            onClick={() =>
              onSelect({
                id: "",
                scheduled_at:
                  selected === key(new Date())
                    ? `${key(new Date(Date.now() + 60000))}T${String(new Date(Date.now() + 60000).getHours()).padStart(2, "0")}:${String(new Date(Date.now() + 60000).getMinutes()).padStart(2, "0")}`
                    : `${selected}T09:00`,
                status: "SCHEDULED",
              })
            }
          >
            {selected < key(new Date())
              ? "No se puede agendar en fechas pasadas"
              : nonWorkingDay(selected) ?? "Agendar candidato en este día"}
          </button>
        </div>
      )}
    </section>
  );
}
