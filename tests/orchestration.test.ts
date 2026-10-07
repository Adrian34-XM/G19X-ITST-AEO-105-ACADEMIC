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
            gte: () => query,
            lt: () => query,
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
  state.rpc.mockImplementation(async (name: string) => ({
    data: name === "unread_task_messages" ? [] : "run",
    error: null,
  }));
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
it("desempeño conserva IA revisada y muestra cifras calculadas sin asumir deficiencias", async () => {
  state.role = "RH_ADMIN";
  state.generate.mockImplementation(async (context, schema) => ({
    result: schema.parse({
      summary: "Hay actividades pendientes de revisión.",
      recommendations: ["REVISAR_ENTREGAS"],
    }),
    model: "test",
  }));
  const response = await POST(
    new Request("http://localhost/api/ai/orchestrate", {
      method: "POST",
      body: JSON.stringify({
        area: "performance",
        mode: "analyze",
        prompt: "Hay deficiencias de desempeño?",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.result.summary).toContain("no permiten determinar deficiencias");
  expect(body.metrics).toBeDefined();
  expect(body.result.recommendations[0].resource_id).toBeNull();
  const [context, schema, , purpose] = state.generate.mock.calls[0];
  expect(purpose).toBe("analytics");
  expect(context.user_request).not.toContain("deficiencias");
  expect(
    schema.safeParse({
      summary: "Hay deficiencias de desempeño.",
      recommendations: [],
    }).success,
  ).toBe(false);
  expect(JSON.stringify(context)).not.toContain("test@nexo.test");
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
  state.generate.mockResolvedValueOnce({
    result: { topics: ["tasks"] },
    model: "test",
  });
  expect((await POST(req("analytics"))).status).toBe(200);
  const context = state.generate.mock.calls[0][0];
  expect(context.data).toBeUndefined();
  expect(JSON.stringify(context)).not.toContain("test@nexo.test");
  expect(JSON.stringify(context)).not.toContain("Revisar");
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

it("el resumen funciona para roles internos y se deniega al candidato", async () => {
  for (const role of ["SUPERUSER", "RH_ADMIN", "JEFE", "EMPLEADO"]) {
    state.role = role;
    const r = await POST(req("overview"));
    expect(r.status).toBe(200);
  }
  state.role = "CANDIDATO";
  state.generate.mockClear();
  expect((await POST(req("overview"))).status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
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
  expect(state.rpc).toHaveBeenCalledExactlyOnceWith("unread_task_messages");
  state.role = "EMPLEADO";
  expect((await POST(req("overview"))).status).toBe(200);
  expect(state.generate).toHaveBeenCalledTimes(1);
});
it("los mensajes nuevos invalidan el resumen guardado", async () => {
  await POST(req("overview"));
  state.cached = [
    {
      result: state.update.mock.calls.at(-1)![0].result,
      model: "test",
      created_at: "2026-09-25T10:00:00Z",
    },
  ];
  const unread = [
    {
      task_id: "t",
      title: "Revisar",
      unread_count: 2,
      last_message_at: "2026-09-25T10:00:00Z",
    },
  ];
  state.rpc.mockImplementation(async (name: string) => ({
    data: name === "unread_task_messages" ? unread : "run",
    error: null,
  }));
  state.generate.mockClear();
  expect((await POST(req("overview"))).status).toBe(200);
  expect(state.generate).toHaveBeenCalledTimes(1);
  expect(state.generate.mock.calls[0][0].unread_task_messages).toEqual(unread);
});
it("actualizar omite la caché mientras la apertura puede reutilizar el contexto vigente", async () => {
  await POST(req("overview"));
  state.cached = [
    {
      result: state.update.mock.calls.at(-1)![0].result,
      model: "test",
      created_at: "2026-10-07T10:00:00Z",
    },
  ];
  state.generate.mockClear();
  const response = await POST(
    new Request("http://localhost/api/ai/orchestrate", {
      method: "POST",
      body: JSON.stringify({ area: "overview", force: true }),
    }),
  );
  expect(response.status).toBe(200);
  expect(state.generate).toHaveBeenCalledTimes(1);
});
it("el resumen automático aplica la búsqueda del módulo antes de enviar datos a IA", async () => {
  const response = await POST(
    new Request("http://localhost/api/ai/orchestrate", {
      method: "POST",
      body: JSON.stringify({
        area: "tasks",
        filters: { module: "tasks", query: "sin coincidencias" },
      }),
    }),
  );
  expect(response.status).toBe(200);
  expect(state.generate.mock.calls[0][0].data.tasks).toEqual([]);
});
it("rechaza filtros de otro módulo antes de invocar IA", async () => {
  const response = await POST(
    new Request("http://localhost/api/ai/orchestrate", {
      method: "POST",
      body: JSON.stringify({ area: "tasks", filters: { module: "courses" } }),
    }),
  );
  expect(response.status).toBe(422);
  expect(state.generate).not.toHaveBeenCalled();
});
it("el resumen automático de tareas usa indicadores filtrados y cifras calculadas", async () => {
  const response = await POST(
    new Request("http://localhost/api/ai/orchestrate", {
      method: "POST",
      body: JSON.stringify({
        area: "tasks",
        automatic: true,
        filters: { module: "tasks", query: "sin coincidencias" },
      }),
    }),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.metrics[0].total).toBe(0);
  const [context, , , purpose] = state.generate.mock.calls[0];
  expect(context.data).toBeUndefined();
  expect(context.verified_metrics[0].available).toBe(false);
  expect(purpose).toBe("analytics");
});
it("el resumen del jefe delimita las cifras a altas semanales y conserva mensajes sin leer", async () => {
  expect((await POST(req("overview"))).status).toBe(200);
  const context = state.generate.mock.calls[0][0];
  expect(context.instructions).toContain("no representan todos los pendientes");
  expect(context.limitation).toContain(
    "pendientes anteriores no están incluidos",
  );
  expect(context.data).toBeUndefined();
  expect(context.nuevas_postulaciones).toBeUndefined();
});

it("vista general del empleado usa alcance personal sin instrucciones ni agrupaciones por áreas", async () => {
  state.role = "EMPLEADO";
  expect((await POST(req("overview"))).status).toBe(200);
  const context = state.generate.mock.calls[0][0];
  expect(context.areas).toBeUndefined();
  expect(context.personal_records.departments).toBeUndefined();
  expect(context.personal_records.positions).toBeUndefined();
  expect(context.verified_activity_context).toBeUndefined();
  expect(context.instructions).toContain("registros personales proporcionados");
  expect(context.instructions).not.toContain("visión GENERAL por áreas");
  expect(context.personal_records.tasks).toHaveLength(1);
});
it("no guarda novedades de reclutamiento inventadas para el jefe", async () => {
  state.generate.mockResolvedValue({
    model: "test",
    result: { summary: "Hay cinco postulaciones nuevas.", recommendations: [] },
  });
  expect((await POST(req("overview"))).status).toBe(422);
  expect(state.update).toHaveBeenCalledWith({ status: "FAILED" });
});
