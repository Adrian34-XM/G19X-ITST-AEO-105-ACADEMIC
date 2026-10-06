import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ai/[useCase]/route";
import { ApiError } from "@/lib/auth";
const state = vi.hoisted(() => ({
  role: "JEFE",
  allowed: true,
  status: "SUBMITTED",
  generate: vi.fn(),
  rpc: vi.fn(),
  finish: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  authenticate: async () => ({
    profile: { id: "reviewer", role: state.role },
    client: {
      rpc: state.rpc,
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data:
                table === "applications"
                  ? { candidate_id: "candidate", vacancy_id: "vacancy" }
                  : table === "candidates"
                    ? {
                        skills: ["TypeScript"],
                        experience_years: 2,
                        cv_text: "CV ficticio",
                        cv_path: "",
                      }
                    : table === "vacancies"
                      ? {
                          skills: ["TypeScript"],
                          experience_required: 1,
                          requirements: "Un año de experiencia general",
                        }
                      : table === "task_evidence"
                        ? {
                            task_id: "task",
                            employee_id: "employee",
                            evidence_text: "Documento ficticio",
                            file_path: "private/test.pdf",
                          }
                        : {
                            description: "Documentar instalación",
                            status: state.status,
                          },
            }),
          }),
        }),
      }),
    },
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  adminDb: () => ({ rpc: state.finish }),
}));
vi.mock("@/lib/ai/provider", () => ({
  generate: state.generate,
  sanitize: (s: string) => s,
}));
const result = {
  status: "NEEDS_REVIEW",
  confidence: 0.8,
  reason: "El documento no permite comprobar la instalación.",
  observations: [],
};
const request = () =>
  POST(
    new Request("http://localhost/api/ai/evidence", {
      method: "POST",
      body: JSON.stringify({ id: "10000000-0000-4000-8000-000000000001" }),
    }),
    { params: Promise.resolve({ useCase: "evidence" }) },
  );
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "JEFE";
  state.allowed = true;
  state.status = "SUBMITTED";
  state.rpc.mockImplementation(async (name: string) => ({
    data: name === "manages_employee" ? state.allowed : { id: "run" },
    error: null,
  }));
  state.finish.mockResolvedValue({ error: null });
  state.generate.mockResolvedValue({ result, model: "test" });
});
it("devuelve al botón el análisis validado y lo guarda sin aprobar la tarea", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ result, cached: false });
  expect(state.finish).toHaveBeenCalledWith("finish_ai", {
    request: "run",
    output: result,
    model_name: "test",
    succeeded: true,
  });
  expect(state.rpc).toHaveBeenCalledTimes(2);
  expect(state.generate.mock.calls[0].slice(3)).toEqual([
    "professional-evidence",
    true,
  ]);
});
it.each(["EMPLEADO", "CANDIDATO"])("no permite analizar a %s", async (role) => {
  state.role = role;
  expect((await request()).status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
it("no permite analizar evidencias fuera del equipo", async () => {
  state.allowed = false;
  expect((await request()).status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
it("exige una entrega enviada a revisión", async () => {
  state.status = "PENDING";
  expect((await request()).status).toBe(409);
  expect(state.generate).not.toHaveBeenCalled();
});
it("una respuesta no respaldada marca la ejecución fallida y no guarda la evaluación", async () => {
  state.generate.mockRejectedValue(
    new ApiError(422, "Respuesta no respaldada"),
  );
  expect((await request()).status).toBe(422);
  expect(state.finish).toHaveBeenCalledWith("finish_ai", {
    request: "run",
    output: {},
    model_name: "",
    succeeded: false,
  });
});
it("la puntuación y su nivel concuerdan y las fortalezas solo describen coincidencias declaradas", async () => {
  state.role = "RH_ADMIN";
  state.generate.mockResolvedValue({
    model: "test",
    result: {
      score: 60,
      match_level: "HIGH",
      summary: "El perfil declara TypeScript. RH puede comprobar su dominio.",
    },
  });
  const response = await POST(
    new Request("http://localhost/api/ai/recruitment", {
      method: "POST",
      body: JSON.stringify({ id: "10000000-0000-4000-8000-000000000001" }),
    }),
    { params: Promise.resolve({ useCase: "recruitment" }) },
  );
  expect(response.status).toBe(200);
  const result = (await response.json()).result;
  expect(result).toMatchObject({ score: 60, match_level: "MEDIUM", gaps: [] });
  expect(result.strengths).toEqual([
    "El perfil declara TypeScript, una habilidad solicitada por la vacante; requiere comprobación humana.",
  ]);
});
