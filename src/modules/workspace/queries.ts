/**
 * @file Carga tablas con la sesión y un máximo de 1000 filas por tabla. Auditoría se obtiene solo
 * para superusuario; un fallo de consulta se informa como error y no se transforma en un conjunto
 * vacío.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Carga en paralelo las tablas visibles para la sesión. RLS determina qué filas puede leer cada usuario. El límite de 1000 filas por tabla implica que esta vista no representa un reporte completo para volúmenes mayores.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot } from "./types";
import { applicationAnalyses } from "@/lib/private-analyses";
export const tables = [
  "profiles",
  "departments",
  "positions",
  "vacancies",
  "candidates",
  "applications",
  "interviews",
  "employees",
  "onboarding",
  "onboarding_items",
  "onboarding_documents",
  "courses",
  "course_assignments",
  "tasks",
  "task_evidence",
  "audit_logs",
] as const;
/** Obtiene hasta 1000 filas por tabla con los permisos del cliente recibido. */
export async function snapshot(
  client: SupabaseClient,
  week?: { start: string; end: string },
): Promise<Snapshot> {
  const { data: identity } = await client.auth.getUser();
  const { data: profile } = identity.user
    ? await client
        .from("profiles")
        .select("role")
        .eq("id", identity.user.id)
        .single()
    : { data: null };
  const results = await Promise.all(
    tables.map(async (table) => {
      if (table === "audit_logs" && profile?.role !== "SUPERUSER")
        return [table, []] as const;
      let query = client.from(table).select("*");
      // Catálogos y relaciones permanecen para resolver permisos y áreas. Los movimientos
      // se filtran en SQL, antes de descargarlos; no se interpreta creación como finalización.
      if (
        week &&
        ![
          "profiles",
          "departments",
          "positions",
          "candidates",
          "employees",
          "courses",
        ].includes(table)
      ) {
        const date = table === "applications" ? "applied_at" : "created_at";
        query = query.gte(date, week.start).lt(date, week.end);
      }
      const { data, error } = await (
        table === "audit_logs"
          ? query.order("created_at", { ascending: false })
          : query
      ).limit(1000);
      if (error) throw new Error("DATA_UNAVAILABLE");
      if (table === "applications")
        return [
          table,
          await applicationAnalyses(client, data ?? [], profile?.role ?? ""),
        ] as const;
      return [table, data] as const;
    }),
  );
  return Object.fromEntries(results);
}
