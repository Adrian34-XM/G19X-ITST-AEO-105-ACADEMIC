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
  const prefix = path.split("/")[1];
  const allowed: Record<string, Role[]> = {
    admin: ["SUPERUSER"],
    rh: ["RH_ADMIN"],
    manager: ["JEFE", "RH_ADMIN"],
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
