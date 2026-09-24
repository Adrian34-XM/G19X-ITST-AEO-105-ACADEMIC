import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/ai/workforce/route";
import {
  chartValues,
  requestedCharts,
} from "../src/modules/workspace/workforce-ai";
const ids = {
  own: "10000000-0000-4000-8000-000000000001",
  other: "10000000-0000-4000-8000-000000000002",
  position: "20000000-0000-4000-8000-000000000001",
};
const state = vi.hoisted(() => ({
  role: "EMPLEADO",
  generate: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  final: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("../src/lib/auth")>()),
  authenticate: async () => ({
    profile: { id: "me", role: state.role },
    client: { rpc: state.rpc },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  adminDb: () => ({ from: () => ({ update: state.update }) }),
}));
vi.mock("@/lib/ai/provider", () => ({ generate: state.generate }));
vi.mock("@/modules/workspace/queries", () => ({
  snapshot: async () => ({
    profiles: [
      { id: "me", full_name: "Persona privada", email: "secreto@test.local" },
      { id: "outside", full_name: "Fuera" },
    ],
    positions: [{ id: ids.position, name: "Desarrollo" }],
    employees: [
      { id: ids.own, profile_id: "me", position_id: ids.position },
      { id: ids.other, profile_id: "outside" },
    ],
    tasks: [
      {
        id: "t1",
        employee_id: ids.own,
        status: "SUBMITTED",
        description: "Texto confidencial",
      },
      { id: "t2", employee_id: ids.other, status: "APPROVED" },
    ],
    course_assignments: [],
    onboarding: [],
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "EMPLEADO";
  state.rpc.mockResolvedValue({ data: "run", error: null });
  state.final.mockResolvedValue({ error: null });
  state.update.mockReturnValue({ eq: () => ({ eq: state.final }) });
  state.generate.mockResolvedValue({
    model: "mock",
    result: {
      summary: "Una entrega para revisión",
      charts: [
        {
          title: "Tareas por estado",
          dataset: "tasks",
          group: "status",
          kind: "bars",
        },
      ],
    },
  });
});
const req = (body: unknown) =>
  new Request("http://localhost/api/ai/workforce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
it("gráficas calculadas en servidor solo cuentan filas del alcance y no exponen textos privados a IA", async () => {
  const r = await POST(
    req({ mode: "chart", section: "performance", prompt: "Tareas por estado" }),
  );
  expect(r.status).toBe(200);
  expect((await r.json()).result.charts[0].values).toEqual([
    { label: "En revisión", count: 1 },
  ]);
  const prompt = JSON.stringify(state.generate.mock.calls[0][0]);
  for (const secret of [
    "secreto@test.local",
    "Persona privada",
    "Texto confidencial",
    "Fuera",
    ids.other,
  ])
    expect(prompt).not.toContain(secret);
});
it("IDOR de perfil y acceso a analíticas/capacitación no autorizados no invocan IA", async () => {
  for (const body of [
    { mode: "profile", employee_id: ids.other },
    { mode: "chart", section: "analytics" },
    { mode: "training", position_id: ids.position },
  ])
    expect((await POST(req(body))).status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
it("rechaza datos y código no previstos enviados por cliente o modelo", async () => {
  expect(
    (await POST(req({ mode: "chart", data: [{ status: "fake" }] }))).status,
  ).toBe(422);
  state.generate.mockResolvedValue({
    result: {
      summary: "x",
      charts: [
        { title: "x", dataset: "profiles", group: "email", kind: "script" },
      ],
    },
    model: "mock",
  });
  expect((await POST(req({ mode: "chart" }))).status).toBe(502);
  expect(state.update).toHaveBeenCalledWith({ status: "FAILED" });
});
it("RH genera capacitación revisable sin guardar ni asignar el borrador", async () => {
  state.role = "RH_ADMIN";
  state.generate.mockResolvedValue({
    model: "mock",
    result: {
      title: "Capacitación",
      description: "Práctica introductoria",
      content: "Lección completa con ejercicios y criterios verificables.",
      duration_minutes: 30,
    },
  });
  const r = await POST(
    req({
      mode: "training",
      position_id: ids.position,
      prompt: "Introducción",
    }),
  );
  expect(r.status).toBe(200);
  expect((await r.json()).result.title).toBe("Capacitación");
  expect(state.rpc).toHaveBeenCalledTimes(1);
});
it("agrupación sin datos devuelve colección vacía", () => {
  expect(
    chartValues(
      {},
      { title: "Tareas", dataset: "tasks", group: "department", kind: "pie" },
    ),
  ).toEqual([]);
});

it("la instrucción explícita prevalece sobre una gráfica incorrecta sugerida por el modelo", () => {
  expect(
    requestedCharts("Incorporaciones por estado en barras", [
      { title: "Otro", dataset: "tasks", group: "department", kind: "pie" },
    ]),
  ).toEqual([
    {
      title: "Incorporaciones por estado",
      dataset: "onboarding",
      group: "status",
      kind: "bars",
    },
  ]);
});
