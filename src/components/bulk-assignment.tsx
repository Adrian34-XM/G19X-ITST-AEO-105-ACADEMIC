"use client";
/**
 * @file Diálogo de asignación múltiple de tareas o cursos. Muestra personas seleccionadas, controla
 * el envío y comunica el resultado; la función SQL valida el conjunto antes de escribir.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { useState } from "react";
import { EmployeePicker } from "./employee-picker";
import { request } from "./forms";
import { type Snapshot, value } from "@/modules/workspace/types";
/**
 * course selecciona el modo curso; su ausencia activa la creación de tareas.
 * data debe venir restringido al alcance del actor. Los filtros solo reducen la lista;
 * onSaved permite al contenedor recargar el estado confirmado por el servidor.
 */
export function BulkAssignment({
  data,
  course,
  subordinatesOnly = false,
  showAreaFilter = false,
  onClose,
  onSaved,
}: {
  data: Snapshot;
  course?: string;
  subordinatesOnly?: boolean;
  showAreaFilter?: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="modal-backdrop">
      <section
        className="modal assignment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-title"
      >
        <div className="section-head">
          <h2 id="assignment-title">
            {course ? "Asignar curso a personas" : "Asignar tarea a personas"}
          </h2>
          <button
            type="button"
            className="icon-button"
            disabled={busy}
            aria-label="Cerrar asignación"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {subordinatesOnly && (
          <p>
            Solo puedes asignar tareas a tus subordinados directos e indirectos.
            La búsqueda por nombre se aplica dentro de esa jerarquía.
          </p>
        )}
        {course && (
          <p>
            {value(
              (data.courses ?? []).find((c) => c.id === course) ?? { id: "" },
              "title",
            )}
          </p>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const payload = course
                ? { id: course, due_date: form.get("due_date") }
                : {
                    title: form.get("title"),
                    description: form.get("description"),
                    priority: form.get("priority"),
                    due_date: form.get("due_date"),
                  };
              const result = await request("/api/assignments", {
                kind: course ? "course" : "task",
                employees: selected,
                payload,
              });
              onSaved(
                `${result.created} asignaciones creadas${result.skipped ? `; ${result.skipped} personas ya tenían el curso` : ""}.`,
              );
              onClose();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudo asignar.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <EmployeePicker
            data={data}
            showAreaFilter={showAreaFilter}
            selected={selected}
            onChange={setSelected}
            disabled={busy}
          />
          {!course && (
            <>
              <label>
                Título de la tarea
                <input name="title" required maxLength={150} disabled={busy} />
              </label>
              <label>
                Descripción y criterios de aceptación
                <textarea
                  name="description"
                  required
                  maxLength={14000}
                  disabled={busy}
                />
              </label>
              <label>
                Prioridad
                <select name="priority" defaultValue="MEDIUM" disabled={busy}>
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                </select>
              </label>
            </>
          )}
          <label>
            Fecha límite
            <input type="date" name="due_date" required disabled={busy} />
          </label>
          <p>
            {course
              ? "Las personas que ya tienen este curso se omiten sin cambiar su progreso."
              : "Cada persona recibe su propia tarea, con entregas y evidencias independientes."}{" "}
            Máximo 100 personas por envío.
          </p>
          {error && <p role="alert">{error}</p>}
          <button
            disabled={busy || selected.length === 0 || selected.length > 100}
          >
            {busy ? "Asignando…" : `Confirmar asignación (${selected.length})`}
          </button>
        </form>
      </section>
    </div>
  );
}
