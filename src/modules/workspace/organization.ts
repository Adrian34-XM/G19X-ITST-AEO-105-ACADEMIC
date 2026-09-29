/**
 * @file Construye el organigrama, conserva ancestros autorizados y protege recorridos contra
 * ciclos. También refleja en la interfaz quién puede editar a integrantes de RH; PostgreSQL vuelve
 * a exigir esa regla.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import type { Snapshot, Row, Profile } from "./types";
/** RH solo puede modificar a otro RH si es su superior de RH más alto. */
export function canEditStaff(data: Snapshot, actor: Profile, employee: Row) {
  if (actor.role === "SUPERUSER") return true;
  const target = (data.profiles ?? []).find(
    (p) => p.id === employee.profile_id,
  );
  if (target?.role !== "RH_ADMIN") return actor.role === "RH_ADMIN";
  if (actor.role !== "RH_ADMIN" || employee.profile_id === actor.id)
    return false;
  const seen = new Set([employee.id]);
  let parent = employee.manager_id;
  let highest: unknown;
  while (typeof parent === "string" && !seen.has(parent)) {
    seen.add(parent);
    const e = (data.employees ?? []).find((e) => e.id === parent);
    if (!e) return false;
    const p = (data.profiles ?? []).find((p) => p.id === e.profile_id);
    if (p?.role === "RH_ADMIN")
      highest = e.status === "ACTIVE" && p.active ? p.id : null;
    parent = e.manager_id;
  }
  return highest === actor.id;
}
/** Conserva ancestros autorizados como contexto al reducir el organigrama por área. */
export function organization(
  data: Snapshot,
  department = "",
  selectedIds?: string[],
) {
  const all = data.employees ?? [],
    byId = new Map(all.map((e) => [e.id, e]));
  const matches = new Set(
    all
      .filter(
        (e) =>
          (!selectedIds || selectedIds.includes(e.id)) &&
          (!department ||
            (data.positions ?? []).some(
              (p) => p.id === e.position_id && p.department_id === department,
            )),
      )
      .map((e) => e.id),
  );
  const included = new Set(matches);
  for (const id of matches) {
    let parent = byId.get(id)?.manager_id;
    const seen = new Set([id]);
    while (
      typeof parent === "string" &&
      byId.has(parent) &&
      !seen.has(parent)
    ) {
      seen.add(parent);
      included.add(parent);
      parent = byId.get(parent)?.manager_id;
    }
  }
  const employees = all.filter((e) => included.has(e.id));
  const roots = employees.filter((e) => !included.has(String(e.manager_id)));
  // Permite visualizar y advertir ciclos históricos sin recursión infinita ni perder filas.
  const visited = new Set<string>();
  const visit = (e: Row) => {
    if (visited.has(e.id)) return;
    visited.add(e.id);
    employees.filter((c) => c.manager_id === e.id).forEach(visit);
  };
  roots.forEach(visit);
  for (const e of employees)
    if (!visited.has(e.id)) {
      roots.push(e);
      visit(e);
    }
  return { employees, roots, matches };
}
