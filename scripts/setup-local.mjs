import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
const cli = 'node_modules/supabase/dist/supabase.js';
try {
  const status = JSON.parse(
    execFileSync(process.execPath, [cli,"status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  if (existsSync(".env.local")) {
    console.log(".env.local ya existe; no se sobrescribió.");
    process.exit(0);
  }
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
    AI_PROVIDER: "ollama",
    OLLAMA_URL: "http://127.0.0.1:11434",
    OLLAMA_MODEL: "qwen2.5:3b",
    AI_FALLBACK: "false",
    DEMO_PASSWORD: randomBytes(24).toString("base64url"),
  };
  if (
    !env.NEXT_PUBLIC_SUPABASE_URL ||
    !env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new Error("STATUS_INCOMPLETE");
  writeFileSync(
    ".env.local",
    Object.entries(env)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  console.log(
    ".env.local creado con claves locales y una contraseña demo aleatoria. No se imprimieron secretos.",
  );
} catch {
  console.error(
    "Supabase no está listo. Inicia Docker Desktop y ejecuta npx supabase start.",
  );
  process.exitCode = 1;
}
