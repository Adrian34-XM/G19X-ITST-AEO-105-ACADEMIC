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
  task: "30000000-0000-4000-8000-000000000001",
  otherTask: "30000000-0000-4000-8000-000000000002",
};
const state = vi.hoisted(() => ({
  role: "EMPLEADO",
  generate: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  final: vi.fn(),
  onboarding: [] as Record<string, unknown>[],
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
    positions: [
      {
        id: ids.position,
        name: "Desarrollo",
        department_id: "50000000-0000-4000-8000-000000000001",
      },
    ],
    departments: [
      { id: "50000000-0000-4000-8000-000000000001", name: "Tecnología" },
    ],
    employees: [
      { id: ids.own, profile_id: "me", position_id: ids.position },
      { id: ids.other, profile_id: "outside" },
    ],
    tasks: [
      {
        id: ids.task,
        employee_id: ids.own,
        status: "SUBMITTED",
        description: "Texto confidencial",
      },
      { id: ids.otherTask, employee_id: ids.other, status: "APPROVED" },
    ],
    task_evidence: [
      {
        id: "e1",
        employee_id: ids.own,
        task_id: ids.task,
        evidence_text: "archivo privado",
        file_path: "privado.pdf",
      },
    ],
    course_assignments: [],
    onboarding: state.onboarding,
    onboarding_items: state.onboarding.map((o) => ({
      id: `item-${o.id}`,
      onboarding_id: o.id,
      status: o.status === "COMPLETED" ? "COMPLETED" : "PENDING",
    })),
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "EMPLEADO";
  state.onboarding = [];
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
it("el resumen de incorporación restringe procesos incluso para la misma persona", async () => {
  state.role = "RH_ADMIN";
  const first = "40000000-0000-4000-8000-000000000001";
  const second = "40000000-0000-4000-8000-000000000002";
  state.onboarding = [
    { id: first, employee_id: ids.own, status: "COMPLETED" },
    { id: second, employee_id: ids.own, status: "ACTIVE" },
  ];
  state.generate.mockResolvedValue({
    model: "mock",
    result: { summary: "Proceso completado", recommendations: [] },
  });
  const response = await POST(
    req({
      mode: "onboarding",
      filters: { employees: [ids.own], onboarding_ids: [first] },
    }),
  );
  expect(response.status).toBe(200);
  const metrics = state.generate.mock.calls[0][0].verified_context.metrics;
  const processes = metrics.find(
    (m: { process: string }) => m.process === "Incorporación",
  );
  expect(
    processes.areas.reduce(
      (total: number, a: { totalActivities: number }) =>
        total + a.totalActivities,
      0,
    ),
  ).toBe(1);
});
it("deniega procesos de incorporación fuera de los filtros antes de generar IA", async () => {
  state.role = "RH_ADMIN";
  expect(
    (
      await POST(
        req({
          mode: "onboarding",
          filters: { onboarding_ids: ["40000000-0000-4000-8000-000000000099"] },
        }),
      )
    ).status,
  ).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
it("preguntas de tareas usan contexto propio y redacción libre sin contenidos privados", async () => {
  state.generate.mockResolvedValue({
    model: "mock",
    result: {
      summary: "Tu entrega ya está lista para que el responsable la revise.",
      recommendations: [],
    },
  });
  const response = await POST(
    req({ mode: "tasks", task_id: ids.task, prompt: "¿Cómo va esta tarea?" }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).result.summary).toBe(
    "Tu entrega ya está lista para que el responsable la revise.",
  );
  const context = state.generate.mock.calls[0][0];
  expect(context.tasks).toHaveLength(1);
  expect(context.evidence).toMatchObject({
    files: 1,
    tasksWithEvidence: 1,
    contentAnalyzed: false,
  });
  expect(
    context.verified_context.metrics.map((m: { process: string }) => m.process),
  ).toEqual(["Tareas"]);
  expect(JSON.stringify(context)).not.toMatch(
    /archivo privado|privado.pdf|Texto confidencial|secreto@test/,
  );
});
it("impide consultar una tarea ajena por identificador", async () => {
  const response = await POST(
    req({ mode: "tasks", task_id: ids.otherTask, prompt: "Resume esta tarea" }),
  );
  expect(response.status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
it("rechaza vacantes desde preguntas de tareas antes de consumir IA", async () => {
  const response = await POST(
    req({ mode: "tasks", prompt: "cuantas vacantes hay disponibles" }),
  );
  expect(response.status).toBe(422);
  expect(state.generate).not.toHaveBeenCalled();
});
it("rechaza vacantes en incorporación antes de reservar o llamar al proveedor", async () => {
  state.role = "RH_ADMIN";
  const response = await POST(
    req({ mode: "onboarding", prompt: "cuantas vacantes hay disponibles" }),
  );
  expect(response.status).toBe(422);
  expect((await response.json()).error).toContain(
    "no corresponde al módulo de Incorporación",
  );
  expect(state.generate).not.toHaveBeenCalled();
  expect(state.rpc).not.toHaveBeenCalled();
});
it("incorporación conserva la redacción de IA y aporta conteos verificados sin datos privados", async () => {
  state.role = "RH_ADMIN";
  state.generate.mockResolvedValue({
    model: "mock",
    result: {
      summary:
        "No puedo comparar áreas porque no hay actividades disponibles en esta consulta.",
      recommendations: [],
    },
  });
  const response = await POST(
    req({ mode: "onboarding", prompt: "Qué área tiene más personas" }),
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.result.summary).toBe(
    "No puedo comparar áreas porque no hay actividades disponibles en esta consulta.",
  );
  expect(body.result.recommendations).toEqual([]);
  expect(state.generate.mock.calls[0][0].request).toBe(
    "Qué área tiene más personas",
  );
  const context = state.generate.mock.calls[0][0].verified_context;
  expect(context.metrics).toHaveLength(1);
  expect(context.metrics[0].process).toBe("Incorporación");
  expect(JSON.stringify(context)).not.toMatch(
    /Persona privada|secreto@test|Texto confidencial/,
  );
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

it("el prompt de tareas por fechas produce una sola gráfica cronológica", () => {
  const proposed = [
    {
      title: "Duplicado",
      dataset: "onboarding" as const,
      group: "status" as const,
      kind: "pie" as const,
    },
    {
      title: "Duplicado",
      dataset: "tasks" as const,
      group: "department" as const,
      kind: "bars" as const,
    },
  ];
  const result = requestedCharts(
    "hasta la actualidad como va el desempeño general de tareas del area de tecnologia en foma de barras que se organizen por fehcas hasta la actualidad",
    proposed,
  );
  expect(result).toEqual([
    {
      title: "Tareas por fecha de creación",
      dataset: "tasks",
      group: "day",
      kind: "bars",
    },
  ]);
});
it("elimina gráficas repetidas por configuración y distingue títulos", () => {
  const base = {
    title: "Igual",
    dataset: "tasks" as const,
    group: "status" as const,
    kind: "bars" as const,
  };
  const result = requestedCharts("Resumen general", [
    base,
    base,
    { ...base, kind: "pie" },
  ]);
  expect(result).toHaveLength(2);
  expect(result[0].title).not.toBe(result[1].title);
});
it("ordena las fechas cronológicamente y excluye fechas ausentes o futuras", () => {
  const data = {
    tasks: [
      { id: "1", created_at: "2026-09-20T12:00:00Z" },
      { id: "2", created_at: "2026-09-01T12:00:00Z" },
      { id: "3", created_at: "2026-10-01T12:00:00Z" },
      { id: "4" },
    ],
  };
  expect(
    chartValues(
      data,
      { title: "", dataset: "tasks", group: "day", kind: "line" },
      "2026-09-28",
    ),
  ).toEqual([
    { label: "2026-09-01", count: 1 },
    { label: "2026-09-20", count: 1 },
  ]);
  expect(
    chartValues(
      data,
      { title: "", dataset: "tasks", group: "month", kind: "columns" },
      "2026-09-28",
    ),
  ).toEqual([{ label: "2026-09", count: 2 }]);
});
it("analíticas permite gráficas de reclutamiento a RH y mantiene desempeño separado", async () => {
  state.role = "RH_ADMIN";
  const response = await POST(
    req({
      mode: "chart",
      section: "analytics",
      prompt: "Postulaciones por estado en barras",
    }),
  );
  expect(response.status).toBe(200);
  expect((await response.json()).result.charts[0].dataset).toBe("applications");
  const performance = await POST(
    req({
      mode: "chart",
      section: "performance",
      prompt: "Postulaciones por estado",
    }),
  );
  expect(performance.status).toBe(422);
});
it("analíticas rechaza colaboradores y jefes antes de consultar IA", async () => {
  for (const role of ["EMPLEADO", "JEFE"]) {
    state.role = role;
    expect(
      (await POST(req({ mode: "chart", section: "analytics" }))).status,
    ).toBe(403);
  }
  expect(state.generate).not.toHaveBeenCalled();
});
it("agrupa entrevistas por el área de la vacante sin mezclar áreas", () => {
  const values = chartValues(
    {
      departments: [
        { id: "d1", name: "Tecnología" },
        { id: "d2", name: "Ventas" },
      ],
      vacancies: [
        { id: "v1", department_id: "d1" },
        { id: "v2", department_id: "d2" },
      ],
      applications: [
        { id: "a1", vacancy_id: "v1" },
        { id: "a2", vacancy_id: "v2" },
      ],
      interviews: [
        { id: "i1", application_id: "a1" },
        { id: "i2", application_id: "a1" },
        { id: "i3", application_id: "a2" },
      ],
    },
    { title: "", dataset: "interviews", group: "department", kind: "bars" },
  );
  expect(values).toEqual([
    { label: "Tecnología", count: 2 },
    { label: "Ventas", count: 1 },
  ]);
});

it("el resumen automático del perfil solo envía los estados propios sin identidad ni archivos", async () => {
  state.generate.mockResolvedValue({
    model: "mock",
    result: { summary: "Hay una entrega por revisar.", recommendations: [] },
  });
  const response = await POST(req({ mode: "profile", employee_id: ids.own }));
  expect(response.status).toBe(200);
  const context = state.generate.mock.calls[0][0];
  expect(context.verified_context.tareas).toContain("1 registros");
  expect(context.verified_context.tareas).not.toContain("Aprobado");
  expect(JSON.stringify(context)).not.toMatch(
    /Persona privada|secreto@test|Texto confidencial|privado.pdf|archivo privado/,
  );
});
it("aplica el periodo de tareas y el estado completado de cursos por separado", () => {
  const charts = requestedCharts(
    "dame una grafica del desempeño de las tareas en la ultima semana y otra de los cursos completados por area",
    [
      { title: "", dataset: "tasks", group: "department", kind: "bars" },
      {
        title: "",
        dataset: "course_assignments",
        group: "department",
        kind: "pie",
      },
    ],
  );
  expect(charts[0].days).toBe(7);
  expect(charts[1].days).toBeUndefined();
  expect(charts[1].status).toBe("COMPLETED");
  const data = {
    tasks: [
      { id: "new", status: "PENDING", created_at: "2026-10-07" },
      { id: "old", status: "APPROVED", created_at: "2026-09-01" },
      { id: "future", created_at: "2026-10-09" },
    ],
    course_assignments: [
      { id: "pending", status: "ASSIGNED" },
      { id: "done", status: "COMPLETED" },
    ],
  };
  expect(
    chartValues(data, charts[0], "2026-10-07").reduce((n, r) => n + r.count, 0),
  ).toBe(1);
  expect(
    chartValues(data, charts[1], "2026-10-07").reduce((n, r) => n + r.count, 0),
  ).toBe(1);
});
