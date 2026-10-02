import { mexicoDate } from "@/lib/working-days";

/** Ciudad de México: lunes 00:00 a lunes siguiente 00:00; final exclusivo. */
export function currentWeek(now = new Date()) {
  const day = new Date(`${mexicoDate(now.toISOString())}T00:00:00-06:00`);
  const localDay = new Date(`${mexicoDate(now.toISOString())}T12:00:00Z`).getUTCDay();
  day.setUTCDate(day.getUTCDate() - ((localDay + 6) % 7));
  return { start: day.toISOString(), end: new Date(day.getTime() + 7 * 86400000).toISOString(), timezone: "America/Mexico_City" };
}
