"use client";
import { stateLabel } from "@/modules/workspace/labels";
import { type Snapshot, value } from "@/modules/workspace/types";
import { type WorkspaceFilters } from "@/modules/workspace/filters";
const states: Record<string, string[]> = {
  jobs: ["PUBLISHED"],
  vacancies: ["DRAFT", "PUBLISHED", "CLOSED"],
  interviews: ["SCHEDULED", "COMPLETED", "CANCELLED"],
  employees: ["ACTIVE", "INACTIVE"],
  onboarding: ["PENDING", "IN_PROGRESS", "COMPLETED"],
  tasks: ["PENDING", "IN_PROGRESS", "SUBMITTED", "REJECTED", "APPROVED"],
  users: ["true", "false"],
  courses: ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "COMPLETED"],
};
export function ModuleFilterBar({
  view,
  data,
  filters,
  onChange,
  onReset,
}: {
  view: string;
  data: Snapshot;
  filters: WorkspaceFilters;
  onChange: (f: WorkspaceFilters) => void;
  onReset: () => void;
}) {
  const set = (key: keyof WorkspaceFilters, v: string) =>
    onChange({ ...filters, [key]: v });
  const dates = [
    "vacancies",
    "applications",
    "recommendations",
    "interviews",
    "onboarding",
    "tasks",
    "courses",
    "users",
    "audit",
  ].includes(view);
  const select = (
    key: keyof WorkspaceFilters,
    label: string,
    options: { value: string; label: string }[],
  ) => (
    <label key={key}>
      {label}
      <select
        value={String(filters[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
      >
        <option value="">Todos</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="chart-filters" aria-label="Filtros del módulo">
      {states[view] &&
        select(
          "state",
          "Estado",
          states[view].map((s) => ({
            value: s,
            label:
              s === "true"
                ? "Activo"
                : s === "false"
                  ? "Inactivo"
                  : stateLabel(s),
          })),
        )}
      {view === "tasks" && (
        <>
          {select(
            "priority",
            "Prioridad",
            ["HIGH", "MEDIUM", "LOW"].map((s) => ({
              value: s,
              label: stateLabel(s),
            })),
          )}
          {select("overdue", "Vencimiento", [
            { value: "yes", label: "Atrasadas" },
            { value: "no", label: "Sin atraso pendiente" },
          ])}
        </>
      )}
      {["employees", "vacancies", "jobs", "positions", "courses"].includes(
        view,
      ) &&
        view !== "positions" &&
        select(
          "position",
          "Puesto",
          (data.positions ?? []).map((p) => ({
            value: p.id,
            label: value(p, "name"),
          })),
        )}
      {view === "users" &&
        select(
          "role",
          "Rol",
          ["SUPERUSER", "RH_ADMIN", "JEFE", "EMPLEADO", "CANDIDATO"].map(
            (s) => ({ value: s, label: stateLabel(s) }),
          ),
        )}
      {view === "courses" &&
        select("required", "Tipo de curso", [
          { value: "true", label: "Obligatorio" },
          { value: "false", label: "Opcional" },
        ])}
      {dates && (
        <>
          <label>
            {view === "tasks"
              ? "Vence desde"
              : view === "interviews"
                ? "Entrevista desde"
                : "Registro desde"}
            <input
              type="date"
              value={filters.from ?? ""}
              max={filters.to || undefined}
              onChange={(e) => set("from", e.target.value)}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              min={filters.from || undefined}
              value={filters.to ?? ""}
              onChange={(e) => set("to", e.target.value)}
            />
          </label>
        </>
      )}
      <button className="secondary" onClick={onReset}>
        Limpiar filtros
      </button>
    </div>
  );
}
