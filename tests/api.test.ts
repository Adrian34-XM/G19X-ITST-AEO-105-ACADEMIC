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
it("limita bytes UTF-8 aunque no haya Content-Length", async () => {
  await expect(
    readJson(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify("á".repeat(60000)),
      }),
    ),
  ).rejects.toThrow("demasiado grande");
});
it("cancela el flujo antes de consumir un cuerpo excesivo", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    pull(c) {
      c.enqueue(new Uint8Array(60000));
    },
    cancel() {
      cancelled = true;
    },
  });
  const req = new Request("http://localhost/api", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await expect(readJson(req)).rejects.toThrow("demasiado grande");
  expect(cancelled).toBe(true);
});
it("limita multipart y mantiene archivos válidos", async () => {
  const { readFormData } = await import("@/lib/api");
  const data = new FormData();
  data.set(
    "file",
    new File(["evidencia"], "prueba.txt", { type: "text/plain" }),
  );
  const parsed = await readFormData(
    new Request("http://localhost/api", { method: "POST", body: data }),
  );
  expect(await (parsed.get("file") as File).text()).toBe("evidencia");
  await expect(
    readFormData(
      new Request("http://localhost/api", {
        method: "POST",
        body: new Uint8Array(5 * 1024 * 1024 + 100001),
      }),
    ),
  ).rejects.toThrow("demasiado grande");
});
it("permite cerrar entrevistas antiguas en festivo pero impide reprogramarlas a otro festivo", async () => {
  const { validateInterviewSchedule } = await import("@/lib/api");
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { scheduled_at: "2030-10-01T18:00:00Z", status: "SCHEDULED" },
          }),
        }),
      }),
    }),
  };
  await expect(
    validateInterviewSchedule(client as never, {
      id: "existente",
      scheduled_at: "2030-10-01T18:00:00Z",
      status: "COMPLETED",
    }),
  ).resolves.toBeUndefined();
  await expect(
    validateInterviewSchedule(client as never, {
      id: "existente",
      scheduled_at: "2030-12-25T18:00:00Z",
      status: "SCHEDULED",
    }),
  ).rejects.toThrow("día hábil");
});
