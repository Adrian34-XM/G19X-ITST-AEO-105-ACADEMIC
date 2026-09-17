/**
 * Carga en paralelo las tablas visibles para la sesión. RLS determina qué filas puede leer cada usuario. El límite de 1000 filas por tabla implica que esta vista no representa un reporte completo para volúmenes mayores.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot } from "./types";
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
export async function snapshot(client: SupabaseClient): Promise<Snapshot> {
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
      const query = client.from(table).select("*");
      const { data, error } = await (
        table === "audit_logs"
          ? query.order("created_at", { ascending: false })
          : query
      ).limit(1000);
      if (error) throw new Error("DATA_UNAVAILABLE");
      return [table, data] as const;
    }),
  );
  return Object.fromEntries(results);
}
