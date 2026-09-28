import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/climate/route";
const state = vi.hoisted(() => ({
  role: "RH_ADMIN",
  group: {
    status: "CLOSED",
    responses: 5,
    invited: 8,
    averages: [{ question_index: 1, average: 4 }],
    questions: ["Apoyo"],
    comments: ["privado"],
    feedback: ["secreto"],
  },
  generate: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  authenticate: async () => ({
    profile: { id: "u", role: state.role },
    client: {
      rpc: async (name: string) => ({
        data: name === "climate_results" ? state.group : "run",
        error: null,
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  adminDb: () => ({
    from: () => ({
      update: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
      insert: async () => ({ error: null }),
    }),
  }),
}));
vi.mock("@/lib/ai/provider", () => ({ generate: state.generate }));
const req = () =>
  new Request("http://localhost/api/climate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      op: "ai.graphs",
      payload: { id: "10000000-0000-4000-8000-000000000001" },
    }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "RH_ADMIN";
  state.group.status = "CLOSED";
  state.group.responses = 5;
  state.generate.mockResolvedValue({
    model: "test",
    result: {
      summary: "Participación parcial",
      sentiment: "MIXED",
      strengths: [],
      risks: [],
      recommendations: ["Consultar los resultados del grupo"],
    },
  });
});
it("analiza solo agregados sin comentarios ni identidades", async () => {
  expect((await POST(req())).status).toBe(200);
  const sent = state.generate.mock.calls[0][0];
  expect(sent.aggregate.response_count).toBe(5);
  expect(sent.aggregate.invited).toBe(8);
  expect(JSON.stringify(sent)).not.toMatch(/privado|secreto/);
});
it("impide análisis con menos de cinco respuestas", async () => {
  state.group.responses = 4;
  expect((await POST(req())).status).toBe(422);
  expect(state.generate).not.toHaveBeenCalled();
});
it("impide analizar encuestas abiertas", async () => {
  state.group.status = "OPEN";
  expect((await POST(req())).status).toBe(422);
  expect(state.generate).not.toHaveBeenCalled();
});
it("impide que colaboradores invoquen el análisis", async () => {
  state.role = "EMPLEADO";
  expect((await POST(req())).status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
