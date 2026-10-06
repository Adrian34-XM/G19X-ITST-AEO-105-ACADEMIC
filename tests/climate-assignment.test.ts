import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/climate/route";
const state = vi.hoisted(() => ({
  role: "JEFE",
  completed: false,
  rpc: vi.fn(),
  query: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  authenticate: async () => ({
    profile: { id: "manager", role: state.role },
    client: {
      rpc: state.rpc,
      from: () => ({
        select: () => ({ eq: () => ({ in: () => ({ limit: state.query }) }) }),
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ adminDb: vi.fn() }));
vi.mock("@/lib/ai/provider", () => ({ generate: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "JEFE";
  state.completed = false;
  state.query.mockImplementation(async () => ({
    data: state.completed ? [{ employee_id: "person" }] : [],
    error: null,
  }));
  state.rpc.mockResolvedValue({ data: { ok: true }, error: null });
});
const request = () =>
  new Request("http://localhost/api/climate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "publish",
      payload: {
        id: "10000000-0000-4000-8000-000000000001",
        employees: ["10000000-0000-4000-8000-000000000002"],
      },
    }),
  });
it("no asigna si alguien ya respondió la misma encuesta", async () => {
  state.completed = true;
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect(await response.text()).toContain("ya respondió");
  expect(state.rpc).not.toHaveBeenCalled();
});
it("continúa con permisos SQL si nadie respondió esta encuesta", async () => {
  expect((await POST(request())).status).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith(
    "climate_command",
    expect.objectContaining({ op: "publish" }),
  );
});
it("la base de datos también comunica el bloqueo por participación", async () => {
  state.rpc.mockResolvedValue({
    error: { message: "CLIMATE_ALREADY_RESPONDED", code: "22023" },
  });
  expect((await POST(request())).status).toBe(422);
});
it("los empleados no pueden asignar encuestas", async () => {
  state.role = "EMPLEADO";
  expect((await POST(request())).status).toBe(403);
  expect(state.query).not.toHaveBeenCalled();
});
