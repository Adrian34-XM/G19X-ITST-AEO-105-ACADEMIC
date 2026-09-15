import "server-only";
import { db } from "@/lib/supabase/server";
import type { Role } from "@/lib/permissions";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function authenticate() {
  const client = await db();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new ApiError(401, "Inicia sesión para continuar.");
  const { data: profile } = await client
    .from("profiles")
    .select("id,full_name,email,role,active")
    .eq("id", user.id)
    .single();
  if (!profile?.active) throw new ApiError(403, "Tu cuenta no tiene acceso.");
  return {
    client,
    user,
    profile: profile as {
      id: string;
      full_name: string;
      email: string;
      role: Role;
      active: boolean;
    },
  };
}
export function requireRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role))
    throw new ApiError(403, "No tienes permiso para realizar esta acción.");
}
