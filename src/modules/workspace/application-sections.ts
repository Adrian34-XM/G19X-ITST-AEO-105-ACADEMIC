/**
 * @file Define la agrupación visual de postulaciones por estado. Separa el seguimiento activo de
 * los historiales sin alterar las transiciones permitidas por la base.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Secciones de selección y archivos históricos; no modifica los estados persistidos. */
export const applicationSections: Record<string, string> = {
  POSTULADO: "Postuladas",
  EN_REVISION: "En revisión",
  PRESELECCIONADO: "Preseleccionadas",
  ENTREVISTA: "En entrevista",
  CONTRATADO: "Historial de contratados",
  RECHAZADO: "Historial de rechazados",
  RETIRADO: "Historial de retiradas",
};
