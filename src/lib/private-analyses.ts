import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/auth";
import { databaseError } from "@/lib/api";

type RecordWithId = { id: string; [key: string]: unknown };
/** Componer la respuesta con la sesión: RLS de la tabla privada decide cada fila. */
async function mergeAnalyses(
  client: SupabaseClient,
  rows: RecordWithId[],
  table: "application_assessments" | "climate_analyses",
) {
  if (!rows.length) return rows;
  const applications = table === "application_assessments";
  const key = applications ? "application_id" : "survey_id";
  const analyses = new Map<string, Record<string, unknown>>();
  // Mantener acotada la URL de PostgREST incluso con snapshots de 1000 registros.
  for (let start = 0; start < rows.length; start += 100) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .in(key, rows.slice(start, start + 100).map((row) => row.id));
    if (error) {
      if (["42P01", "PGRST205"].includes(error.code))
        throw new ApiError(
          503,
          "Aplica supabase/migrations/202610080001_private_ai_analyses.sql para proteger y consultar los análisis internos.",
        );
      databaseError(error);
    }
    for (const analysis of data ?? []) analyses.set(analysis[key], analysis);
  }
  return rows.map((row) => {
    const analysis = analyses.get(row.id);
    return applications
      ? { ...row, ai_result: analysis?.result ?? null }
      : { ...row, summary: analysis?.summary ?? null, model: analysis?.model ?? null };
  });
}

export async function applicationAnalyses(
  client: SupabaseClient,
  rows: RecordWithId[],
  role: string,
) {
  // Nunca reutilizar la columna antigua aunque el despliegue esté desactualizado.
  const safe = rows.map((row) => {
    const safe = { ...row };
    delete safe.ai_result;
    return safe;
  });
  return ["RH_ADMIN", "SUPERUSER"].includes(role)
    ? mergeAnalyses(client, safe, "application_assessments")
    : safe;
}

export async function climateAnalyses(
  client: SupabaseClient,
  rows: RecordWithId[],
  role: string,
) {
  const safe = rows.map((row) => {
    const safe = { ...row };
    delete safe.summary;
    delete safe.model;
    return safe;
  });
  return ["RH_ADMIN", "SUPERUSER", "JEFE"].includes(role)
    ? mergeAnalyses(client, safe, "climate_analyses")
    : safe;
}
