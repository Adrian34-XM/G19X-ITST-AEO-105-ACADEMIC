/**
 * Pruebas de controles HTTP y autenticación con dependencias simuladas. Comprueban origen, mensajes seguros y rechazo de solicitudes no autorizadas.
 */
import { it, expect, vi, beforeEach } from "vitest";
import { checkOrigin, readJson, failure } from "@/lib/api";
import { ApiError } from "@/lib/auth";
import { POST } from "@/app/api/commands/route";
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  db: vi.fn(async () => ({ auth: { getUser } })),
}));
beforeEach(() =>
  getUser.mockResolvedValue({ data: { user: null }, error: null }),
);
it("API sin autenticación devuelve 401 antes de ejecutar la operación", async () => {
  const r = await POST(
    new Request("http://localhost/api/commands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        op: "application.hire",
        payload: { id: crypto.randomUUID() },
      }),
    }),
  );
  expect(r.status).toBe(401);
  expect(await r.json()).toEqual({ error: "Inicia sesión para continuar." });
});
it("CSRF se rechaza antes de consultar identidad", async () => {
  getUser.mockClear();
  const r = await POST(
    new Request("http://localhost/api/commands", {
      method: "POST",
      headers: { origin: "https://evil.example" },
      body: "{}",
    }),
  );
  expect(r.status).toBe(403);
  expect(getUser).not.toHaveBeenCalled();
});
it("rechaza JSON roto y payload excesivo", async () => {
  await expect(
    readJson(
      new Request("http://localhost/api", { method: "POST", body: "{broken" }),
    ),
  ).rejects.toThrow("JSON inválido");
  await expect(
    readJson(
      new Request("http://localhost/api", {
        method: "POST",
        body: "a".repeat(100001),
      }),
    ),
  ).rejects.toThrow("demasiado grande");
});
it("no expone detalles técnicos en errores", async () => {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  const r = failure(new Error("secret database password"));
  expect(JSON.stringify(await r.json())).not.toContain("password");
  spy.mockRestore();
  expect(failure(new ApiError(404, "No encontrado")).status).toBe(404);
});
it("permite lectura y same origin, rechaza cross-site", () => {
  expect(() =>
    checkOrigin(
      new Request("http://localhost/a", {
        method: "POST",
        headers: { origin: "http://localhost" },
      }),
    ),
  ).not.toThrow();
  expect(() =>
    checkOrigin(
      new Request("http://localhost/a", {
        method: "POST",
        headers: { "sec-fetch-site": "cross-site" },
      }),
    ),
  ).toThrow();
});
it("acepta el host del navegador cuando Next reconstruye localhost", () => {
  expect(() =>
    checkOrigin(
      new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": "same-origin",
        },
      }),
    ),
  ).not.toThrow();
});
it.each([
  { origin: "https://evil.example", host: "127.0.0.1:3000" },
  { origin: "http://127.0.0.1:4000", host: "127.0.0.1:3000" },
  { origin: "https://127.0.0.1:3000", host: "127.0.0.1:3000" },
  { origin: "http://localhost:3000", host: "127.0.0.1:3000" },
  { origin: "null", host: "127.0.0.1:3000" },
  {
    origin: "https://evil.example",
    host: "127.0.0.1:3000",
    "x-forwarded-host": "evil.example",
  },
])(
  "rechaza origen distinto incluso con cabeceras manipuladas: %j",
  (headers) => {
    expect(() =>
      checkOrigin(
        new Request("http://localhost:3000/api/auth/register", {
          method: "POST",
          headers: new Headers(
            Object.entries(headers).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          ),
        }),
      ),
    ).toThrow("Origen no autorizado");
  },
);
