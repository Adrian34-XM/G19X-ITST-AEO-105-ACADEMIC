import { beforeEach, it, expect, vi } from "vitest";
import { POST } from "@/app/api/onboarding-learning/route";
const state = vi.hoisted(() => ({
  role: "EMPLEADO",
  rpc: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  authenticate: async () => ({
    user: { id: "10000000-0000-4000-8000-000000000001" },
    profile: { role: state.role },
    client: { rpc: state.rpc },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ adminDb: state.admin }));
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "EMPLEADO";
  state.rpc.mockResolvedValue({
    data: { score: 100, passed: true },
    error: null,
  });
});
it("empleado no sube material de evaluación usando privilegios administrativos", async () => {
  const r = await POST(
    new Request("http://localhost/api/onboarding-learning", {
      method: "POST",
      body: new FormData(),
    }),
  );
  expect(r.status).toBe(403);
  expect(state.admin).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});
it("empleado sí puede enviar sus respuestas con autorización SQL", async () => {
  const r = await POST(
    new Request("http://localhost/api/onboarding-learning", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "10000000-0000-4000-8000-000000000001",
        answers: [0],
      }),
    }),
  );
  expect(r.status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "onboarding_learning_command",
    expect.objectContaining({ op: "attempt" }),
  );
  expect(state.admin).not.toHaveBeenCalled();
});
it("JSON roto responde 400 sin ejecutar funciones", async () => {
  const r = await POST(
    new Request("http://localhost/api/onboarding-learning", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    }),
  );
  expect(r.status).toBe(400);
  expect(state.rpc).not.toHaveBeenCalled();
});
