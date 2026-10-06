"use client";
/**
 * @file Diálogo de contratación y elección de puesto, área y jefe. Envía la operación de negocio al
 * servidor para que los registros asociados se creen con las validaciones de la base.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { useState } from "react";
import { Bell } from "lucide-react";
import { request } from "./forms";
import { type Snapshot, value } from "@/modules/workspace/types";
export function HireCandidate({
  applicationId,
  employeeId,
  positionId,
  data,
  onSaved,
}: {
  applicationId?: string;
  employeeId?: string;
  positionId: string;
  data: Snapshot;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [department, setDepartment] = useState(
      String(
        (data.positions ?? []).find((p) => p.id === positionId)
          ?.department_id || "",
      ),
    ),
    [position, setPosition] = useState(positionId),
    [manager, setManager] = useState(
      String(
        (data.employees ?? []).find((e) => e.id === employeeId)?.manager_id ??
          "",
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button onClick={() => setOpen(true)}>
        {employeeId ? "Asignar área y puesto" : "Confirmar contratación"}
      </button>
      {open && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              employeeId
                ? "Asignar área y puesto"
                : "Confirmar contratación y equipo"
            }
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await request(
                  employeeId ? "/api/employee-assignment" : "/api/commands",
                  employeeId
                    ? {
                        employee: employeeId,
                        department,
                        position,
                        manager: manager || null,
                      }
                    : {
                        op: "application.hire",
                        payload: {
                          id: applicationId,
                          department_id: department,
                          position_id: position,
                          manager_id: manager,
                        },
                      },
                );
                setOpen(false);
                onSaved();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "No se pudo contratar.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>
              {employeeId ? "Asignar área y puesto" : "Contratación y equipo"}
            </h2>
            <p>
              {employeeId
                ? "Confirma el área, puesto y jefe del colaborador. Su avance de incorporación se conserva."
                : "Confirma el destino del nuevo colaborador. Se crearán su incorporación y actividades iniciales."}
            </p>
            <label>
              Área
              <select
                required
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setPosition("");
                }}
              >
                <option value="">Selecciona un área</option>
                {(data.departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {value(d, "name")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Puesto
              <select
                required
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="">Selecciona un puesto</option>
                {(data.positions ?? [])
                  .filter((p) => p.department_id === department)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {value(p, "name")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Jefe directo
              <select
                value={manager}
                onChange={(e) => setManager(e.target.value)}
              >
                <option value="">Sin jefe asignado por ahora</option>
                {(data.employees ?? [])
                  .filter((e) => e.status === "ACTIVE")
                  .flatMap((e) => {
                    const p = (data.profiles ?? []).find(
                      (p) =>
                        p.id === e.profile_id &&
                        p.active &&
                        ["JEFE", "RH_ADMIN"].includes(String(p.role)),
                    );
                    return p
                      ? [
                          <option key={e.id} value={e.id}>
                            {value(p, "full_name")}
                          </option>,
                        ]
                      : [];
                  })}
              </select>
            </label>
            {error && <p role="alert">{error}</p>}
            <footer>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
              <button disabled={busy}>
                {busy
                  ? "Guardando…"
                  : employeeId
                    ? "Guardar asignación"
                    : "Contratar y guardar asignación"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}

/** Pendientes persistentes visibles solo desde los espacios autorizados de RH. */
export function HiringAssignmentNotices({
  data,
  onSaved,
}: {
  data: Snapshot;
  onSaved: () => void;
}) {
  const pending = (data.employees ?? []).filter(
    (e) => e.assignment_pending === true && e.status === "ACTIVE",
  );
  const [open, setOpen] = useState(false);
  return (
    <div
      className="hiring-notifications"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        className="icon-button notification-trigger"
        type="button"
        aria-label={`Asignaciones pendientes: ${pending.length}`}
        aria-expanded={open}
        aria-controls="hiring-notification-panel"
        onClick={() => setOpen(!open)}
      >
        <Bell size={21} />
        {pending.length > 0 && (
          <span className="notification-count">{pending.length}</span>
        )}
      </button>
      {open && (
        <section
          id="hiring-notification-panel"
          className="panel notification-popover"
          aria-label="Asignaciones pendientes de contratación"
        >
          <h2>
            Personas contratadas · asignación pendiente ({pending.length})
          </h2>
          <p>Revisa y confirma el área y puesto de cada nueva contratación.</p>
          {!pending.length && (
            <p className="muted">
              No hay contrataciones pendientes de asignación.
            </p>
          )}
          <div className="record-grid">
            {pending.map((e) => (
              <article className="record" key={e.id}>
                <h3>
                  {value(
                    (data.profiles ?? []).find(
                      (p) => p.id === e.profile_id,
                    ) ?? {
                      id: "",
                    },
                    "full_name",
                  ) || "Nuevo colaborador"}
                </h3>
                <p>Contratación completada. Falta confirmar su asignación.</p>
                <HireCandidate
                  employeeId={e.id}
                  positionId={String(e.position_id ?? "")}
                  data={data}
                  onSaved={onSaved}
                />
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
