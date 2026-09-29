/**
 * @file Calendario laboral implementado: fines de semana y descansos nacionales codificados.
 * mexicoDate interpreta instantes en Ciudad de México; no incluye automáticamente descansos
 * empresariales o electorales extraordinarios.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Semana laboral de lunes a viernes y descansos nacionales del artículo 74 LFT. */
export function nonWorkingDay(date: string): string | null {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "Fecha inválida";
  const day = d.getUTCDate(),
    month = d.getUTCMonth() + 1,
    year = d.getUTCFullYear(),
    week = d.getUTCDay();
  if (week === 0 || week === 6) return "Fin de semana";
  if (month === 1 && day === 1) return "Año Nuevo";
  if (month === 2 && week === 1 && day <= 7)
    return "Conmemoración de la Constitución";
  if (month === 3 && week === 1 && day >= 15 && day <= 21)
    return "Natalicio de Benito Juárez";
  if (month === 5 && day === 1) return "Día del Trabajo";
  if (month === 9 && day === 16) return "Independencia de México";
  if (month === 11 && week === 1 && day >= 15 && day <= 21)
    return "Revolución mexicana";
  if (month === 12 && day === 25) return "Navidad";
  if (year >= 2024 && (year - 2024) % 6 === 0 && month === 10 && day === 1)
    return "Transmisión del Poder Ejecutivo Federal";
  return null;
}
/** Convierte un instante con zona horaria a la fecha civil usada para agendar en México. */
export function mexicoDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
