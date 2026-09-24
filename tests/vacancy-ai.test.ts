import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/ai/vacancy/route";
const state = vi.hoisted(() => ({
  role: "SUPERUSER",
  generate: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
  final: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("../src/lib/auth")>()),
  authenticate: async () => ({
    profile: { id: "admin", role: state.role },
    client: {
      rpc: state.rpc,
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                id: "10000000-0000-4000-8000-000000000001",
                name: "Desarrollo",
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
vi.mock("@/lib/ai/provider", () => ({ generate: state.generate }));
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "SUPERUSER";
  state.rpc.mockResolvedValue({ data: "run", error: null });
  state.final.mockResolvedValue({ error: null });
  state.update.mockReturnValue({ eq: () => ({ eq: state.final }) });
  state.generate.mockResolvedValue({
    model: "mock",
    result: {
      title: "Desarrollador",
      description: "Construir aplicaciones",
      requirements: "Conocer pruebas",
      skills: ["TypeScript"],
      experience_required: 2,
    },
  });
});
function req(file?: File) {
  const body = new FormData();
  body.set("position_id", "10000000-0000-4000-8000-000000000001");
  body.set("context", "Desarrollo de aplicaciones web y pruebas");
  if (file) body.set("file", file);
  return new Request("http://localhost/api/ai/vacancy", {
    method: "POST",
    body,
  });
}
it("superadmin obtiene un borrador editable sin publicar ni guardar una vacante", async () => {
  const result = await POST(
    req(
      new File(["Referencia ficticia de puesto"], "puesto.txt", {
        type: "text/plain",
      }),
    ),
  );
  expect(result.status).toBe(200);
  expect((await result.json()).draft).toMatchObject({
    status: "DRAFT",
    position_id: "10000000-0000-4000-8000-000000000001",
    title: "Desarrollador",
  });
  expect(state.generate.mock.calls[0][0].reference).toBe(
    "Referencia ficticia de puesto",
  );
  expect(state.rpc).toHaveBeenCalledTimes(1);
  expect(state.rpc).toHaveBeenCalledWith("begin_orchestration", {
    section: "overview",
  });
});
it("candidato no puede generar vacantes", async () => {
  state.role = "CANDIDATO";
  expect((await POST(req())).status).toBe(403);
  expect(state.generate).not.toHaveBeenCalled();
});
it("rechaza un falso PDF antes de llamar a IA", async () => {
  expect(
    (
      await POST(
        req(
          new File(["no es pdf"], "referencia.pdf", {
            type: "application/pdf",
          }),
        ),
      )
    ).status,
  ).toBe(422);
  expect(state.generate).not.toHaveBeenCalled();
});
it("fallo del proveedor se informa sin devolver datos ni secretos", async () => {
  state.generate.mockRejectedValue(new Error("secret-provider-detail"));
  const r = await POST(req());
  expect(r.status).toBe(502);
  expect(await r.text()).not.toContain("secret-provider-detail");
  expect(state.update).toHaveBeenCalledWith({ status: "FAILED" });
});
