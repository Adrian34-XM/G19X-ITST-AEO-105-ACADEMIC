import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/onboarding-plans/route";
const state = vi.hoisted(() => ({
  role: "RH_ADMIN",
  generate: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  final: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("../src/lib/auth")>()),
  authenticate: async () => ({
    profile: { id: "hr", role: state.role },
    client: {
      rpc: state.rpc,
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { name: "Desarrollo" } }),
          }),
        }),
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  adminDb: () => ({ from: () => ({ update: state.update }) }),
}));
vi.mock("@/lib/ai/provider", () => ({ generate: state.generate }));
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "RH_ADMIN";
  state.rpc.mockResolvedValue({ data: "run", error: null });
  state.final.mockResolvedValue({ error: null });
  state.update.mockReturnValue({ eq: () => ({ eq: state.final }) });
  state.generate.mockResolvedValue({
    model: "mock",
    result: {
      title: "Plan revisable",
      steps: [
        {
          title: "Conocer equipo",
          description: "Presentación",
          owner_role: "MANAGER",
          days: 1,
          requires_document: false,
        },
      ],
    },
  });
});
const req = () =>
  new Request("http://localhost/api/onboarding-plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "ai.draft",
      payload: {
        position_id: "10000000-0000-4000-8000-000000000001",
        context: "Inducción técnica",
      },
    }),
  });
it("IA devuelve propuesta validada sin asignar, enviar expedientes ni guardar un plan", async () => {
  const r = await POST(req());
  expect(r.status).toBe(200);
  expect((await r.json()).draft.steps).toHaveLength(1);
  expect(state.rpc).toHaveBeenCalledTimes(1);
  expect(state.rpc).toHaveBeenCalledWith("begin_orchestration", {
    section: "overview",
  });
  expect(Object.keys(state.generate.mock.calls[0][0]).sort()).toEqual([
    "context",
    "position",
    "task",
  ]);
});
it("empleado y candidato no generan planes IA", async () => {
  for (const role of ["EMPLEADO", "CANDIDATO"]) {
    state.role = role;
    expect((await POST(req())).status).toBe(403);
  }
  expect(state.generate).not.toHaveBeenCalled();
});
it("salida inválida o fallo del proveedor no revela secretos ni asigna pasos", async () => {
  state.generate.mockRejectedValue(new Error("clave privada"));
  const r = await POST(req());
  expect(r.status).toBe(502);
  expect(await r.text()).not.toContain("clave privada");
  expect(state.update).toHaveBeenCalledWith({ status: "FAILED" });
});
it("rechaza pasos de IA sin responsable y sin fechas", async () => {
  state.generate.mockResolvedValue({
    model: "mock",
    result: { title: "Plan", steps: [{ title: "Paso" }] },
  });
  expect((await POST(req())).status).toBe(502);
});
