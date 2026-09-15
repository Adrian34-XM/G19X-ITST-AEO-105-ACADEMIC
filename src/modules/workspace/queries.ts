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
export async function snapshot(client: SupabaseClient): Promise<Snapshot> {
  const results = await Promise.all(
    tables.map(async (table) => {
      const { data, error } = await client.from(table).select("*").limit(1000);
      if (error) throw new Error("DATA_UNAVAILABLE");
      return [table, data] as const;
    }),
  );
  return Object.fromEntries(results);
}
