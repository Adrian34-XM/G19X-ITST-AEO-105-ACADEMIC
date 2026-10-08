import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/climate/overview/route";
const state = vi.hoisted(() => ({
  role: "RH_ADMIN",
  query: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  authenticate: async () => ({
    profile: { id: "u", role: state.role },
    client: {
      from: () => ({
        select: () => ({ order: () => ({ limit: state.query }) }),
      }),
      rpc: state.rpc,
    },
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-08T18:00:00Z"));
  state.role = "RH_ADMIN";
  state.query.mockResolvedValue({
    data: [
      {
        id: "s",
        title: "Encuesta",
        status: "CLOSED",
        questions: ["Carga"],
        created_at: "2026-10-05T08:00:00Z",
        summary: null,
      },
    ],
    error: null,
  });
  state.rpc.mockResolvedValue({
    data: {
      status: "CLOSED",
      responses: 4,
      invited: 6,
      summary: { summary: "secreto" },
      comments: ["secreto"],
    },
    error: null,
  });
});
afterEach(() => vi.useRealTimers());
it.each(["RH_ADMIN", "SUPERUSER"])(
  "habilita novedades para %s con agregación de la sesión",
  async (role) => {
    state.role = role;
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.new_surveys).toBe(1);
    expect(body.surveys[0].summary).toBeNull();
    expect(JSON.stringify(body)).not.toContain("secreto");
    expect(state.rpc).toHaveBeenCalledWith("climate_results", { sid: "s" });
  },
);
it.each(["JEFE", "EMPLEADO", "CANDIDATO"])(
  "rechaza acceso de %s antes de consultar encuestas",
  async (role) => {
    state.role = role;
    expect((await GET()).status).toBe(403);
    expect(state.query).not.toHaveBeenCalled();
    expect(state.rpc).not.toHaveBeenCalled();
  },
);
it("separa pendientes abiertos antiguos de novedades semanales y limita consultas", async () => {
  state.query.mockResolvedValue({
    data: [
      {
        id: "old",
        status: "CLOSED",
        questions: [],
        created_at: "2026-09-01T08:00:00Z",
      },
      ...Array.from({ length: 15 }, (_, i) => ({
        id: `open-${i}`,
        status: "OPEN",
        questions: [],
        created_at: "2026-09-01T08:00:00Z",
      })),
    ],
    error: null,
  });
  state.rpc.mockResolvedValue({
    data: { status: "OPEN", responses: 0, invited: 6 },
    error: null,
  });
  const body = await (await GET()).json();
  expect(body.new_surveys).toBe(0);
  expect(body.open).toBe(15);
  expect(body.surveys).toHaveLength(12);
  expect(body.limited).toBe(true);
  expect(state.rpc).toHaveBeenCalledTimes(12);
});
it("incluye análisis guardados esta semana de encuestas anteriores", async () => {
  const summary = {
    summary: "Colaboración positiva",
    sentiment: "POSITIVE",
    strengths: [],
    risks: [],
    recommendations: ["Revisar el grupo"],
    generated_at: "2026-10-07T08:00:00Z",
    response_count: 5,
  };
  state.query.mockResolvedValue({
    data: [
      {
        id: "old",
        title: "Anterior",
        status: "CLOSED",
        questions: [],
        created_at: "2026-09-01T08:00:00Z",
        summary,
      },
    ],
    error: null,
  });
  state.rpc.mockResolvedValue({
    data: { status: "CLOSED", responses: 5, invited: 6, summary },
    error: null,
  });
  const body = await (await GET()).json();
  expect(body.new_surveys).toBe(0);
  expect(body.analyzed_this_week).toBe(1);
});
