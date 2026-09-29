/**
 * @file Autenticación de servidor y exigencia de roles sobre perfiles activos. El superusuario
 * hereda las operaciones autorizadas a RH; las comprobaciones de pertenencia a un equipo se
 * realizan además en cada recurso.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Verifica la identidad con Supabase Auth y exige un perfil activo. Devuelve el cliente de la sesión para conservar RLS; requireRole restringe cada operación según su caso de uso.
 */
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
/** Verifica la sesión con Auth y rechaza usuarios sin perfil activo. */
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
/** Exige pertenencia a la lista de roles permitidos para esta operación. */
export function requireRole(role: Role, allowed: Role[]) {
  if (
    !allowed.includes(role) &&
    !(role === "SUPERUSER" && allowed.includes("RH_ADMIN"))
  )
    throw new ApiError(403, "No tienes permiso para realizar esta acción.");
}
