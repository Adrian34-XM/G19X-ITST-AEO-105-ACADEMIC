/**
 * @file Filtra el conjunto de trabajo por área, persona, proceso y periodo relacionando empleados,
 * puestos y registros. Debe recibir datos previamente autorizados; un filtro visual no concede
 * acceso.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { filterModule, type ModuleFilters } from "./module-filters";
/** Filtra un conjunto ya autorizado; no sustituye RLS ni acepta filas del navegador. */
import type { Snapshot } from "./types";
export type WorkspaceFilters = ModuleFilters & {
  department?: string;
  employee?: string;
  employees?: string[];
  days?: string;
  process?: string;
  onboarding_ids?: string[];
};
function filterBase(
  data: Snapshot,
  filters: WorkspaceFilters,
  now = Date.now(),
): Snapshot {
  const {
    department,
    employee,
    employees: selectedPeople,
    days,
    process,
  } = filters;
  if (
    !department &&
    !employee &&
    !selectedPeople?.length &&
    (!days || days === "all") &&
    (!process || process === "all")
  )
    return data;
  const positions = (data.positions ?? []).filter(
    (p) => !department || p.department_id === department,
  );
  const positionIds = new Set(positions.map((p) => p.id));
  const employees = (data.employees ?? []).filter(
    (e) =>
      (!department || positionIds.has(String(e.position_id))) &&
      (!employee || e.id === employee) &&
      (!selectedPeople?.length || selectedPeople.includes(e.id)),
  );
  const employeeIds = new Set(employees.map((e) => e.id));
  const vacancies = (data.vacancies ?? []).filter(
    (v) => !department || positionIds.has(String(v.position_id)),
  );
  const vacancyIds = new Set(vacancies.map((v) => v.id));
  const cutoff =
    days && days !== "all"
      ? new Date(now - Number(days) * 86400000).toISOString()
      : "";
  const recent = (r: Record<string, unknown>, field = "created_at") =>
    !cutoff || String(r[field] ?? "") >= cutoff;
  const applications = (data.applications ?? []).filter(
    (a) =>
      !employee &&
      vacancyIds.has(String(a.vacancy_id)) &&
      recent(a, "applied_at"),
  );
  const applicationIds = new Set(applications.map((a) => a.id));
  const candidateIds = new Set(applications.map((a) => a.candidate_id));
  const onboarding = (data.onboarding ?? []).filter(
    (o) => employeeIds.has(String(o.employee_id)) && recent(o),
  );
  const onboardingIds = new Set(onboarding.map((o) => o.id));
  const result: Snapshot = {
    ...data,
    employees,
    positions,
    vacancies,
    applications,
    departments: (data.departments ?? []).filter(
      (d) => !department || d.id === department,
    ),
    candidates: (data.candidates ?? []).filter((c) => candidateIds.has(c.id)),
    interviews: (data.interviews ?? []).filter((i) =>
      applicationIds.has(String(i.application_id)),
    ),
    onboarding,
    onboarding_items: (data.onboarding_items ?? []).filter((i) =>
      onboardingIds.has(String(i.onboarding_id)),
    ),
    onboarding_documents: (data.onboarding_documents ?? []).filter((i) =>
      onboardingIds.has(String(i.onboarding_id)),
    ),
  };
  for (const table of [
    "tasks",
    "task_evidence",
    "course_assignments",
    "performance_reviews",
  ])
    result[table] = (data[table] ?? []).filter(
      (r) => employeeIds.has(String(r.employee_id)) && recent(r),
    );
  if (process && process !== "all") {
    if (process !== "tasks") {
      result.tasks = [];
      result.task_evidence = [];
    }
    if (process !== "courses") result.course_assignments = [];
    if (process !== "applications") {
      result.applications = [];
      result.interviews = [];
      result.candidates = [];
      result.vacancies = [];
    }
  }
  return result;
}

export function filterWorkspace(
  data: Snapshot,
  filters: WorkspaceFilters,
  now = Date.now(),
): Snapshot {
  // La búsqueda de desempeño restringe también las métricas y el contexto de IA.
  if (
    ["performance", "analytics"].includes(filters.module ?? "") &&
    filters.query
  ) {
    const normalize = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase();
    const matches = (data.employees ?? [])
      .filter((e) => {
        const person = (data.profiles ?? []).find((p) => p.id === e.profile_id);
        const position = (data.positions ?? []).find(
          (p) => p.id === e.position_id,
        );
        const department = (data.departments ?? []).find(
          (d) => d.id === position?.department_id,
        );
        return normalize(
          `${person?.full_name ?? ""} ${department?.name ?? ""}`,
        ).includes(normalize(filters.query!));
      })
      .map((e) => e.id)
      .filter(
        (id) => !filters.employees?.length || filters.employees.includes(id),
      );
    filters = {
      ...filters,
      ...(matches.length
        ? { employees: matches }
        : { employee: "00000000-0000-4000-8000-000000000000" }),
    };
  }
  const base = filterBase(data, filters, now);
  if (
    filters.module === "courses" &&
    (filters.department || filters.employee || filters.employees?.length)
  ) {
    const assigned = new Set(
      (base.course_assignments ?? []).map((a) => a.course_id),
    );
    base.courses = (base.courses ?? []).filter(
      (c) =>
        assigned.has(c.id) ||
        (!filters.employee &&
          !filters.employees?.length &&
          (c.department_id === filters.department ||
            (base.positions ?? []).some((p) => p.id === c.position_id))),
    );
  }
  return filterModule(base, filters, new Date(now).toISOString().slice(0, 10));
}
