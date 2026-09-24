"use client";
import { useState } from "react";
import { request } from "./forms";
import { type Snapshot, value } from "@/modules/workspace/types";
export function HireCandidate({
  applicationId,
  positionId,
  data,
  onSaved,
}: {
  applicationId: string;
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
    [manager, setManager] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button onClick={() => setOpen(true)}>Confirmar contratación</button>
      {open && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar contratación y equipo"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await request("/api/commands", {
                  op: "application.hire",
                  payload: {
                    id: applicationId,
                    department_id: department,
                    position_id: position,
                    manager_id: manager,
                  },
                });
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
            <h2>Contratación y equipo</h2>
            <p>
              Confirma el destino del nuevo colaborador. Se crearán su
              incorporación y actividades iniciales.
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
                {busy ? "Contratando…" : "Contratar y guardar asignación"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </>
  );
}
