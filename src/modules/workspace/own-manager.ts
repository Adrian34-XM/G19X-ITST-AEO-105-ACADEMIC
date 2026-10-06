import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminDb } from "@/lib/supabase/server";
import type { Row } from "./types";

/** Resuelve únicamente el nombre del jefe del usuario autenticado, sin abrir su expediente. */
export async function ownManagerName(client: SupabaseClient): Promise<Row[]> {
  const { data: identity, error: authError } = await client.auth.getUser();
  if (authError || !identity.user) return [];
  // El empleado propio se consulta con la sesión y RLS antes de usar privilegios.
  const { data: own, error } = await client
    .from("employees")
    .select("id,manager_id")
    .eq("profile_id", identity.user.id)
    .maybeSingle();
  if (error || !own?.manager_id) return [];
  const { data: manager, error: managerError } = await adminDb()
    .from("employees")
    .select("profiles(full_name)")
    .eq("id", own.manager_id)
    .maybeSingle();
  if (managerError) {
    console.error("own_manager_name_unavailable");
    return [];
  }
  const person = Array.isArray(manager?.profiles)
    ? manager.profiles[0]
    : manager?.profiles;
  return person?.full_name ? [{ id: own.id, full_name: person.full_name }] : [];
}
