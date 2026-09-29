/**
 * @file Traduce códigos internos a textos de interfaz en español. Conserva los identificadores
 * originales en almacenamiento y peticiones para mantener los contratos del sistema.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Etiquetas visibles en español. Los valores enviados a la API conservan sus códigos. */
export const labels: Record<string, string> = {
  OPEN: "Abierta",
  FAILED: "Fallido",
  RUNNING: "En ejecución",
  GREEN: "Favorable",
  YELLOW: "Requiere atención",
  RED: "Crítico",
  SUPERUSER: "Superadministrador",
  RH_ADMIN: "Administrador de RH",
  JEFE: "Jefe",
  EMPLEADO: "Empleado",
  CANDIDATO: "Candidato",
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  CLOSED: "Cerrada",
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  SUBMITTED: "En revisión",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  COMPLETED: "Completado",
  ASSIGNED: "Asignado",
  SCHEDULED: "Agendada",
  CANCELLED: "Cancelada",
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  POSTULADO: "Postulado",
  EN_REVISION: "En revisión",
  PRESELECCIONADO: "Preseleccionado",
  ENTREVISTA: "Entrevista",
  CONTRATADO: "Contratado",
  RECHAZADO: "Rechazado",
  NEEDS_REVIEW: "Revisión humana",
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};
export function stateLabel(code: string) {
  return labels[code] ?? "Estado no reconocido";
}
