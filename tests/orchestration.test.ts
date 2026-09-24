/** Pruebas del coordinador con proveedor simulado: permisos, persistencia y referencias autorizadas. */
import { it, expect, vi, beforeEach } from "vitest";
import { POST } from "../src/app/api/ai/orchestrate/route";
const state = vi.hoisted(() => ({
  role: "JEFE",
  cached: [] as Record<string, unknown>[],
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
      client: {
        rpc: state.rpc,
        from: (table: string) => {
          const query = {
            select: () => query,
            eq: () => query,
            order: () => query,
            limit: async () => ({
              data: table === "orchestration_runs" ? state.cached : [],
              error: null,
            }),
          };
          return query;
        },
      },
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
  state.cached = [];
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
it("superadministrador puede analizar y no envía texto privado de tareas", async () => {
  state.role = "SUPERUSER";
  expect((await POST(req("analytics"))).status).toBe(200);
  const context = state.generate.mock.calls[0][0];
  expect(context.data.tasks).toEqual([{ id: "t", employee_id: "e" }]);
  expect(JSON.stringify(context.data)).not.toContain("test@nexo.test");
  expect(JSON.stringify(context.data)).not.toContain("Revisar");
});
it("rechaza persona ajena antes de reservar o invocar el proveedor", async () => {
  const response = await POST(
    new Request("http://localhost/api/ai/orchestrate", {
      method: "POST",
      body: JSON.stringify({
        area: "performance",
        filters: { employee: "10000000-0000-4000-8000-000000000099" },
      }),
    }),
  );
  expect(response.status).toBe(403);
  expect(state.rpc).not.toHaveBeenCalled();
  expect(state.generate).not.toHaveBeenCalled();
});
it("genera un prompt revisable y no guarda el texto de instrucciones en el historial", async () => {
  state.generate.mockResolvedValue({
    result: {
      prompt:
        "Revisa los indicadores laborales disponibles y explica sus límites.",
    },
    model: "test",
  });
  const response = await POST(
    new Request("http://localhost/api/ai/orchestrate", {
      method: "POST",
      body: JSON.stringify({ area: "performance", mode: "prompt" }),
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).prompt).toContain("indicadores");
  expect(state.update).toHaveBeenCalledWith({
    status: "COMPLETED",
    result: { kind: "prompt" },
    model: "test",
  });
});

it("el resumen de vista general funciona para los cinco roles", async () => {
  for (const role of [
    "SUPERUSER",
    "RH_ADMIN",
    "JEFE",
    "EMPLEADO",
    "CANDIDATO",
  ]) {
    state.role = role;
    const r = await POST(req("overview"));
    expect(r.status).toBe(200);
  }
  const context = state.generate.mock.calls.at(-1)![0];
  expect(context.role).toBe("CANDIDATO");
  expect(context.data.tasks).toBeUndefined();
  expect(context.limitations).toContain("No es un historial completo");
});
it("reutiliza el mismo contexto y vuelve a generar tras cambiar el rol", async () => {
  const first = await POST(req("overview"));
  expect(first.status).toBe(200);
  const saved = state.update.mock.calls.at(-1)![0];
  state.cached = [
    { result: saved.result, model: "test", created_at: "2026-09-22T10:00:00Z" },
  ];
  state.generate.mockClear();
  state.rpc.mockClear();
  const again = await POST(req("overview"));
  expect((await again.json()).cached).toBe(true);
  expect(state.generate).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
  state.role = "EMPLEADO";
  expect((await POST(req("overview"))).status).toBe(200);
  expect(state.generate).toHaveBeenCalledTimes(1);
});
