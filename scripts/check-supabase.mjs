/**
 * @file Comprueba conexión, autenticación y acceso a recursos configurados. Permite distinguir
 * fallos de servicio o migraciones de errores de interfaz; requiere las variables del entorno de
 * prueba.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Comprobación de disponibilidad sin escrituras: verifica Auth, lectura pública y rechazo de acceso anónimo a tablas privadas. No demuestra que todos los flujos autenticados funcionen.
 */
// Comprobaciones sin escrituras; no imprime claves ni registros de usuarios.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Faltan URL y clave publicable de Supabase.");
const checks = [
  ["Auth", "/auth/v1/settings", false],
  ...["vacancies", "positions", "departments"].map((table) => [
    table,
    `/rest/v1/${table}?select=id&limit=0`,
    false,
  ]),
  ...["profiles", "applications", "employees", "tasks", "courses"].map(
    (table) => [table, `/rest/v1/${table}?select=id&limit=0`, true],
  ),
];
let failures = 0;
for (const [label, path, privateTable] of checks) {
  try {
    const response = await fetch(new URL(path, url), {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15000),
    });
    if (response.ok && !privateTable)
      console.log(`PASS ${label}: HTTP ${response.status}`);
    else {
      const body = await response.json().catch(() => ({}));
      if (
        privateTable &&
        [401, 403].includes(response.status) &&
        body.code === "42501"
      ) {
        console.log(
          `PASS ${label}: acceso anónimo rechazado (HTTP ${response.status})`,
        );
        continue;
      }
      console.log(
        `FAIL ${label}: HTTP ${response.status}; código ${body.code || "no disponible"}`,
      );
      failures++;
    }
  } catch (error) {
    console.log(
      `FAIL ${label}: ${error.name === "TimeoutError" ? "timeout" : "no se pudo conectar"}`,
    );
    failures++;
  }
}
process.exitCode = failures ? 1 : 0;
