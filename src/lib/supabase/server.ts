/**
 * @file Construye clientes exclusivos del servidor. db conserva cookies y RLS; adminDb usa
 * privilegios administrativos y exige que el llamador haya autorizado previamente al usuario y al
 * recurso.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Clientes exclusivos del servidor: db usa cookies y permisos del usuario; adminDb usa la clave privada para operaciones administrativas. Nunca debe importarse desde componentes del navegador.
 */
import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicSupabaseKey } from "./config";
export function configured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && publicSupabaseKey());
}
/** Crea un cliente por petición; sus consultas quedan sujetas a la sesión y a RLS. */
export async function db() {
  if (!configured()) throw new Error("SUPABASE_NOT_CONFIGURED");
  const jar = await cookies();
  return createServerClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicSupabaseKey()!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Los componentes de servidor no escriben cookies; proxy renueva la sesión. */
          }
        },
      },
    },
  );
}
/** Cliente privilegiado: usar solo después de autorizar explícitamente el recurso. */
export function adminDb() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("SERVER_KEY_NOT_CONFIGURED");
  return createClient(
    process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
