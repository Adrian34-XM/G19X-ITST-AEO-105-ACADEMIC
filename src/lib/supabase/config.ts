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
