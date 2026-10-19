import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it, vi } from "vitest";
import { blockCrossSiteDEV } from "next/dist/server/lib/router-utils/block-cross-site-dev";
import config from "../next.config";

describe("conexión de desarrollo desde el navegador local", () => {
  const check = (origin: string, allowed = config.allowedDevOrigins) => {
    const req = { url: "/_next/hmr", headers: { origin } } as IncomingMessage;
    const response = { statusCode: 200, end: vi.fn() };
    const blocked = blockCrossSiteDEV(
      req,
      response as unknown as ServerResponse,
      allowed,
      "localhost",
    );
    return { blocked, response };
  };
  it("reproduce el bloqueo anterior al abrir Nexo por 127.0.0.1", () => {
    const result = check("http://127.0.0.1:3000", []);
    expect(result.blocked).toBe(true);
    expect(result.response.statusCode).toBe(403);
  });
  it.each(["http://127.0.0.1:3000", "http://localhost:3000"])(
    "permite actualizaciones locales desde %s",
    (origin) => {
      const result = check(origin);
      expect(result.blocked).toBe(false);
      expect(result.response.end).not.toHaveBeenCalled();
    },
  );
  it("continúa bloqueando un origen externo", () => {
    const result = check("https://external.invalid");
    expect(result.blocked).toBe(true);
    expect(result.response.statusCode).toBe(403);
  });
});
