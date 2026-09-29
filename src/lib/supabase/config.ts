/**
 * @file Selecciona la clave pública de Supabase y conserva compatibilidad con la variable anon
 * anterior. No debe usarse para exponer ni sustituir la clave service role.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Resuelve la clave pública de Supabase. Admite la clave publicable actual y la variable anon heredada; ninguna sustituye a la clave privada administrativa.
 */
/** Clave pública: admite claves publicables actuales y claves anon heredadas. */
export function publicSupabaseKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
