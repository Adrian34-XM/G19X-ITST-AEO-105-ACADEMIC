import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/training/route";
const state = vi.hoisted(() => ({
  role: "JEFE",
  own: false,
  allowed: true,
  visible: true,
  text: "Ejercicio completado con pruebas",
  path: "owner/file.txt",
  generate: vi.fn(),
  attachment: vi.fn(),
  vision: vi.fn(),
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
                      file_path: state.path,
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
  OllamaProvider: class {
    generate = state.vision;
  },
  GeminiProvider: class {
    generate = state.vision;
  },
  sanitize: (s: string) => s,
}));
vi.mock("@/lib/ai/attachments", () => ({
  authorizedAttachment: state.attachment,
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
  state.path = "owner/file.txt";
  state.vision.mockResolvedValue({
    model: "vision-test",
    result: {
      visible_content: "Captura de organigrama, sin entregables educativos",
      limitations: [],
    },
  });
  state.attachment.mockResolvedValue({
    mimeType: "image/png",
    data: "cHJ1ZWJh",
  });
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

it("el análisis de evidencia permite una corrección revisada sin cambiar avance", async () => {
  expect((await POST(req())).status).toBe(200);
  expect(state.generate.mock.calls[0][4]).toBe(true);
  expect(state.generate.mock.calls[0][0]).toHaveProperty(
    "requirements_to_verify_not_completed_facts",
  );
});

it("una imagen sin texto se envía al modelo visual con autorización", async () => {
  state.text = "";
  state.path = "owner/file.png";
  expect((await POST(req())).status).toBe(200);
  expect(state.attachment).toHaveBeenCalledWith(
    expect.anything(),
    "course-evidence",
    "owner/file.png",
  );
  expect(state.vision.mock.calls[0][2]).toEqual({
    mimeType: "image/png",
    data: "cHJ1ZWJh",
  });
  expect(state.generate.mock.calls[0][2]).toBeUndefined();
  expect(state.generate.mock.calls[0][0].evidence).toHaveProperty(
    "visual_observations_from_ai",
  );
});
it("no descarga imágenes de personas fuera del equipo", async () => {
  state.text = "";
  state.allowed = false;
  expect((await POST(req())).status).toBe(403);
  expect(state.attachment).not.toHaveBeenCalled();
});

it("fallo de lectura visual no produce una evaluación ni cambia avance", async () => {
  state.text = "";
  state.vision.mockRejectedValue(new Error("PROVIDER_FAILED"));
  expect((await POST(req())).status).toBe(502);
  expect(state.generate).not.toHaveBeenCalled();
  expect(state.update).toHaveBeenCalledWith({ status: "FAILED" });
});

it("una imagen se lee visualmente aunque tenga texto declarado en metadatos", async () => {
  state.path = "owner/file.png";
  state.text = "Texto declarado que no sustituye al archivo";
  expect((await POST(req())).status).toBe(200);
  expect(state.vision).toHaveBeenCalled();
  expect(state.generate.mock.calls[0][0].evidence).toHaveProperty(
    "visual_observations_from_ai",
  );
});

it("el respaldo visual local solo se usa si está habilitado", async () => {
  vi.stubEnv("AI_PROVIDER", "gemini");
  vi.stubEnv("AI_FALLBACK", "true");
  state.path = "owner/file.png";
  state.vision.mockRejectedValueOnce(new Error("PROVIDER_FAILED"));
  try {
    expect((await POST(req())).status).toBe(200);
    expect(state.vision).toHaveBeenCalledTimes(2);
    expect(state.generate.mock.calls[0][5]).toBe("vision-test");
  } finally {
    vi.unstubAllEnvs();
  }
});
