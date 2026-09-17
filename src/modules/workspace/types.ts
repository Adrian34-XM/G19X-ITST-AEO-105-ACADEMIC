/**
 * Contratos compartidos para filas, perfiles y conjuntos de tablas. Los valores de cada fila son desconocidos hasta que el consumidor los comprueba o convierte para mostrarlos.
 */
export type Row = { id: string; [key: string]: unknown };
export type Snapshot = Record<string, Row[]>;
export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: import("@/lib/permissions").Role;
};
export function value(row: Row, key: string): string {
  const v = row[key];
  return v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v);
}
