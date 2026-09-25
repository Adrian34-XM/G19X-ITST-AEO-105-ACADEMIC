import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/training/route";
const state = vi.hoisted(() => ({
  role: "JEFE",
  own: false,
  allowed: true,
  visible: true,
  text: "Ejercicio completado con pruebas",
  generate: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("../src/lib/auth")>()),
  authenticate: async () => ({
    profile: { id: "reviewer", role: state.role },
    client: {
      rpc: state.rpc,
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: !state.visible
                ? null
                : table === "course_evidence"
                  ? {
                      assignment_id: "assignment",
                      progress: 50,
                      evidence_text: state.text,
                      file_path: "owner/file.png",
                    }
                  : table === "course_assignments"
                    ? {
                        employee_id: "employee",
                        course_id: "course",
                        progress: 25,
                        status: "IN_PROGRESS",
                      }
                    : {
                        title: "Pruebas",
                        description: "Curso",
                        content: "Escribe pruebas verificables.",
                      },
            }),
          }),
        }),
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  adminDb: () => ({ from: () => ({ update: state.update }) }),
}));
vi.mock("@/lib/ai/provider", () => ({
  generate: state.generate,
  sanitize: (s: string) => s,
}));
const req = (mode = "evidence") =>
  new Request("http://localhost/api/training", {
    method: "POST",
    body: JSON.stringify({ mode, id: "10000000-0000-4000-8000-000000000001" }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "JEFE";
  state.own = false;
  state.allowed = true;
  state.visible = true;
  state.text = "Ejercicio completado con pruebas";
  state.rpc.mockImplementation(async (name: string) => ({
    data:
      name === "owns_employee"
        ? state.own
        : name === "manages_employee"
          ? state.allowed
          : "run",
    error: null,
  }));
  state.update.mockReturnValue({
    eq: () => ({ eq: async () => ({ error: null }) }),
  });
  state.generate.mockResolvedValue({
    model: "test",
    result: {
      summary: "Evidencia parcial",
      demonstrated: ["Ejercicio"],
      missing: ["Casos límite"],
      recommendation: "MORE_EVIDENCE",
    },
  });
});
it("colaborador no analiza evidencias para validarlas", async () => {
  state.role = "EMPLEADO";
  expect((await POST(req())).status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
it("jefe no analiza evidencias fuera de su equipo", async () => {
  state.allowed = false;
  expect((await POST(req())).status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
it("jefe no revisa su propia evidencia", async () => {
  state.own = true;
  expect((await POST(req())).status).toBe(403);
});
it("RH obtiene una opinión sin cambiar estados", async () => {
  state.role = "RH_ADMIN";
  const r = await POST(req());
  expect(r.status).toBe(200);
  expect((await r.json()).result.recommendation).toBe("MORE_EVIDENCE");
  expect(state.rpc.mock.calls.some(([op]) => op === "command")).toBe(false);
  expect(state.update).toHaveBeenCalledWith(
    expect.objectContaining({ result: { kind: "training.evidence" } }),
  );
});
it("recurso no visible nunca se envía a IA", async () => {
  state.visible = false;
  expect((await POST(req("resources"))).status).toBe(404);
  expect(state.generate).not.toHaveBeenCalled();
});
it("recursos se expresan como búsquedas, sin URL arbitraria", async () => {
  state.generate.mockResolvedValue({
    model: "test",
    result: {
      resources: [
        {
          title: "Pruebas unitarias",
          kind: "VIDEO",
          query: "pruebas unitarias tutorial español",
          reason: "Practicar",
        },
      ],
    },
  });
  const r = await POST(req("resources"));
  expect(r.status).toBe(200);
  expect((await r.json()).result.resources[0]).not.toHaveProperty("url");
});
it("salida inválida de IA no se acepta", async () => {
  state.generate.mockResolvedValue({
    model: "test",
    result: { approved: true },
  });
  expect((await POST(req())).status).toBe(502);
});

it("no presenta evidencia suficiente cuando la IA enumera faltantes", async () => {
  state.generate.mockResolvedValue({
    model: "test",
    result: {
      summary: "Faltan resultados",
      demonstrated: ["Captura de pantalla"],
      missing: ["Resultado obtenido"],
      recommendation: "SUFFICIENT",
    },
  });
  const r = await POST(req());
  expect(r.status).toBe(200);
  expect((await r.json()).result.recommendation).toBe("MORE_EVIDENCE");
});
