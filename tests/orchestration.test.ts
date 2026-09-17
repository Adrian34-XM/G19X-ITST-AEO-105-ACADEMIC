/** Pruebas del coordinador con proveedor simulado: permisos, persistencia y referencias autorizadas. */
import { it, expect, vi, beforeEach } from "vitest";
import { POST } from "../src/app/api/ai/orchestrate/route";
const state = vi.hoisted(() => ({
  role: "JEFE",
  rpc: vi.fn(),
  generate: vi.fn(),
  update: vi.fn(),
  final: vi.fn(),
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/lib/auth")>();
  return {
    ...original,
    authenticate: vi.fn(async () => ({
      profile: {
        id: "boss",
        role: state.role,
        email: "test@nexo.test",
        full_name: "Jefe",
      },
      client: { rpc: state.rpc },
    })),
  };
});
vi.mock("@/lib/supabase/server", () => ({
  adminDb: () => ({ from: () => ({ update: state.update }) }),
}));
vi.mock("@/modules/workspace/queries", () => ({
  snapshot: async () => ({
    employees: [{ id: "e", profile_id: "boss" }],
    tasks: [{ id: "t", employee_id: "e", title: "Revisar" }],
    positions: [],
    courses: [],
  }),
}));
vi.mock("@/lib/ai/provider", () => ({ generate: state.generate }));
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "JEFE";
  state.rpc.mockResolvedValue({ data: "run", error: null });
  state.final.mockResolvedValue({ error: null });
  state.update.mockReturnValue({ eq: () => ({ eq: state.final }) });
  state.generate.mockResolvedValue({
    model: "test",
    result: {
      summary: "Revisar tareas",
      recommendations: [
        {
          title: "Revisar",
          reason: "Seguimiento",
          priority: "HIGH",
          resource_type: "tasks",
          resource_id: "foreign",
          employee_id: "foreign",
        },
      ],
    },
  });
});
const req = (area: string) =>
  new Request("http://localhost/api/ai/orchestrate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ area }),
  });
it("impide analíticas a jefe antes de invocar IA", async () => {
  expect((await POST(req("analytics"))).status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
it("persiste resultado y elimina enlaces a recursos no autorizados", async () => {
  const response = await POST(req("tasks"));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.result.recommendations[0].resource_id).toBeNull();
  expect(body.result.recommendations[0].employee_id).toBeNull();
  expect(state.update).toHaveBeenCalledWith(
    expect.objectContaining({ status: "COMPLETED" }),
  );
});
it("marca fracaso del proveedor sin inventar recomendaciones", async () => {
  state.generate.mockRejectedValue(new Error("Provider unavailable"));
  expect((await POST(req("tasks"))).status).toBe(502);
  expect(state.update).toHaveBeenCalledWith({ status: "FAILED" });
});
it("rechaza solicitud desconocida sin crear registros", async () => {
  expect((await POST(req("unknown"))).status).toBe(422);
  expect(state.rpc).not.toHaveBeenCalled();
});
