"use client";
/** Selector reutilizable: filtra opciones sin perder las personas ya seleccionadas. */
import { useState } from "react";
import { type Snapshot, value } from "@/modules/workspace/types";
export function EmployeePicker({
  data,
  selected,
  onChange,
  disabled = false,
  activeOnly = true,
  showAreaFilter = false,
  department,
  onDepartmentChange,
}: {
  data: Snapshot;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  activeOnly?: boolean;
  showAreaFilter?: boolean;
  department?: string;
  onDepartmentChange?: (id: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [localArea, setLocalArea] = useState("");
  const area = showAreaFilter ? (department ?? localArea) : "";
  const employees = (data.employees ?? []).filter(
    (e) =>
      !activeOnly ||
      (e.status === "ACTIVE" &&
        (data.profiles ?? []).some(
          (p) =>
            p.id === e.profile_id &&
            p.active &&
            ["EMPLEADO", "JEFE"].includes(value(p, "role")),
        )),
  );
  const name = (id: unknown) =>
    value(
      (data.profiles ?? []).find((p) => p.id === id) ?? { id: "" },
      "full_name",
    ) || "Integrante";
  const position = (id: unknown) =>
    (data.positions ?? []).find((p) => p.id === id);
  const available = employees.filter(
    (e) =>
      (!area || position(e.position_id)?.department_id === area) &&
      name(e.profile_id)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(
          query
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase(),
        ),
  );
  return (
    <div className="people-picker">
      <section className="record">
        <h3>Buscar personas</h3>
        {showAreaFilter && (
          <label>
            Área de las personas
            <select
              disabled={disabled}
              value={area}
              onChange={(e) =>
                onDepartmentChange
                  ? onDepartmentChange(e.target.value)
                  : setLocalArea(e.target.value)
              }
            >
              <option value="">Todas las áreas autorizadas</option>
              {(data.departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {value(d, "name")}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Buscar persona por nombre
          <input
            disabled={disabled}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe el nombre…"
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={disabled || !available.length}
          onClick={() =>
            onChange([...new Set([...selected, ...available.map((e) => e.id)])])
          }
        >
          Seleccionar resultados ({available.length})
        </button>
        <div className="people-options">
          {available.map((e) => (
            <label className="person-option" key={e.id}>
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(e.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, e.id]
                      : selected.filter((id) => id !== e.id),
                  )
                }
              />
              <span>
                <strong>{name(e.profile_id)}</strong>
                <small>
                  {value(position(e.position_id) ?? { id: "" }, "name")}
                </small>
              </span>
            </label>
          ))}
          {!available.length && <p>No hay personas que coincidan.</p>}
        </div>
      </section>
      <section className="record selected-people" aria-live="polite">
        <h3>Personas seleccionadas ({selected.length})</h3>
        {!selected.length && <p>Selecciona personas para añadirlas aquí.</p>}
        {selected.map((id) => {
          const e = employees.find((e) => e.id === id);
          return (
            <div className="list-line" key={id}>
              <span>{e ? name(e.profile_id) : "Persona no disponible"}</span>
              <button
                type="button"
                className="quiet"
                disabled={disabled}
                aria-label={`Quitar ${e ? name(e.profile_id) : "persona"}`}
                onClick={() =>
                  onChange(selected.filter((other) => other !== id))
                }
              >
                Quitar ×
              </button>
            </div>
          );
        })}
        {selected.length > 0 && (
          <button
            type="button"
            className="secondary"
            disabled={disabled}
            onClick={() => onChange([])}
          >
            Quitar todas
          </button>
        )}
      </section>
    </div>
  );
}
