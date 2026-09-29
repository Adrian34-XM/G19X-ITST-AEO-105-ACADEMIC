/**
 * @file Catálogo de roles, destinos y permisos de navegación. Compartido por interfaz y servidor;
 * ocultar una ruta o botón no sustituye las políticas RLS.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Catálogo de roles, páginas iniciales y transiciones visibles de postulaciones. Las reglas definitivas de escritura también se comprueban en PostgreSQL.
 */
export const roles = [
  "SUPERUSER",
  "RH_ADMIN",
  "JEFE",
  "EMPLEADO",
  "CANDIDATO",
] as const;
export type Role = (typeof roles)[number];
export const home: Record<Role, string> = {
  SUPERUSER: "/admin",
  RH_ADMIN: "/rh",
  JEFE: "/manager",
  EMPLEADO: "/employee",
  CANDIDATO: "/candidate",
};
export function mayEnter(role: Role, path: string) {
  if (path.split("/")[2] === "audit") return role === "SUPERUSER";
  const prefix = path.split("/")[1];
  const allowed: Record<string, Role[]> = {
    admin: ["SUPERUSER"],
    rh: ["RH_ADMIN", "SUPERUSER"],
    manager: ["JEFE", "RH_ADMIN", "SUPERUSER"],
    employee: ["EMPLEADO", "JEFE"],
    candidate: ["CANDIDATO"],
  };
  return !allowed[prefix] || allowed[prefix].includes(role);
}
export const applicationTransitions: Record<string, string[]> = {
  POSTULADO: ["EN_REVISION", "RECHAZADO"],
  EN_REVISION: ["PRESELECCIONADO", "RECHAZADO"],
  PRESELECCIONADO: ["ENTREVISTA", "RECHAZADO"],
  ENTREVISTA: ["RECHAZADO"],
  CONTRATADO: [],
  RECHAZADO: [],
};

/** Superadministración hereda las operaciones de RH conservando su identidad. */
export function isHR(role: string | undefined) {
  return role === "RH_ADMIN" || role === "SUPERUSER";
}
