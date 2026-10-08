import { beforeEach, it, expect, vi } from "vitest";
import { applicationAnalyses, climateAnalyses } from "@/lib/private-analyses";
import { GET as applications } from "@/app/api/[...segments]/route";
import { GET as climateList } from "@/app/api/climate/route";
import { snapshot } from "@/modules/workspace/queries";
import type { SupabaseClient } from "@supabase/supabase-js";

const state = vi.hoisted(() => ({ role: "CANDIDATO", from: vi.fn(), privateQuery: vi.fn(), privateData: [] as unknown[], error: null as unknown }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  authenticate: async () => ({ profile: { id: "u", role: state.role }, user: { id: "u" }, client: client() }),
}));
function client() {
  return { from: state.from, auth: { getUser: async () => ({ data: { user: { id: "u" } } }) } } as unknown as SupabaseClient;
}
const id = "10000000-0000-4000-8000-000000000001";
const result = { summary: "Evaluación privada", score: 60 };
const publicApplication = { id, status: "POSTULADO", ai_result: { summary: "viejo secreto" } };
const publicSurvey = { id, title: "Encuesta", summary: { summary: "viejo secreto" }, model: "viejo modelo" };
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "CANDIDATO";
  state.error = null;
  state.privateData = [];
  state.privateQuery.mockImplementation(async () => ({ data: state.privateData, error: state.error }));
  state.from.mockImplementation((table: string) => {
    if (["application_assessments", "climate_analyses"].includes(table))
      return { select: () => ({ in: state.privateQuery }) };
    const data = table === "applications" ? [publicApplication] : table === "climate_surveys" ? [publicSurvey] : [];
    const query = {
      select: () => query, eq: () => query, order: () => query,
      single: async () => ({ data: { role: state.role }, error: null }),
      limit: async () => ({ data, error: null }), range: async () => ({ data, error: null }),
    };
    return query;
  });
});
it.each(["CANDIDATO", "EMPLEADO", "JEFE"])("%s no recibe evaluaciones ni consulta su tabla privada", async (role) => {
  expect(await applicationAnalyses(client(), [publicApplication], role)).toEqual([{ id, status: "POSTULADO" }]);
  expect(state.privateQuery).not.toHaveBeenCalled();
});
it.each(["RH_ADMIN", "SUPERUSER"])("%s mantiene la forma de la evaluación autorizada", async (role) => {
  state.privateData = [{ application_id: id, result }];
  expect(await applicationAnalyses(client(), [publicApplication], role)).toEqual([{ id, status: "POSTULADO", ai_result: result }]);
  expect(state.privateQuery).toHaveBeenCalledWith("application_id", [id]);
});
it("el participante no recibe el resumen antiguo ni su modelo", async () => {
  expect(await climateAnalyses(client(), [publicSurvey], "EMPLEADO")).toEqual([{ id, title: "Encuesta" }]);
  expect(state.privateQuery).not.toHaveBeenCalled();
});
it("un JEFE solo compone el análisis que le permite devolver RLS", async () => {
  expect(await climateAnalyses(client(), [publicSurvey], "JEFE")).toEqual([{ id, title: "Encuesta", summary: null, model: null }]);
  state.privateData = [{ survey_id: id, summary: result, model: "nuevo" }];
  expect(await climateAnalyses(client(), [publicSurvey], "JEFE")).toEqual([{ id, title: "Encuesta", summary: result, model: "nuevo" }]);
});
it("falta de migración falla cerrado sin reutilizar columnas públicas", async () => {
  state.error = { code: "PGRST205", message: "schema cache" };
  await expect(applicationAnalyses(client(), [publicApplication], "RH_ADMIN")).rejects.toThrow("202610080001_private_ai_analyses.sql");
});
it("compone 1000 registros con consultas acotadas sin perder el orden", async () => {
  const rows = Array.from({ length: 1000 }, (_, index) => ({ id: `row-${index}` }));
  state.privateQuery.mockImplementation(async (_key: string, ids: string[]) => ({
    data: ids.slice().reverse().map((application_id) => ({ application_id, result: { summary: application_id } })),
    error: null,
  }));
  const output = await applicationAnalyses(client(), rows, "RH_ADMIN");
  expect(state.privateQuery).toHaveBeenCalledTimes(10);
  expect(state.privateQuery.mock.calls.every(([, ids]) => ids.length <= 100)).toBe(true);
  expect(output).toEqual(rows.map((row) => ({ ...row, ai_result: { summary: row.id } })));
});
it.each([{ suffix: [] }, { suffix: [id] }])("GET de postulaciones $suffix no entrega ai_result al candidato", async ({ suffix }) => {
  const response = await applications(new Request("http://localhost/api/applications"), { params: Promise.resolve({ segments: ["applications", ...suffix] }) });
  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain("ai_result");
  expect(state.privateQuery).not.toHaveBeenCalled();
});
it("snapshot de RH conserva el análisis y snapshot candidato lo excluye", async () => {
  state.role = "RH_ADMIN";
  state.privateData = [{ application_id: id, result }];
  expect((await snapshot(client())).applications[0].ai_result).toEqual(result);
  state.role = "CANDIDATO";
  expect((await snapshot(client())).applications[0]).not.toHaveProperty("ai_result");
});
it("la lista de clima excluye los campos internos del empleado", async () => {
  state.role = "EMPLEADO";
  const response = await climateList(new Request("http://localhost/api/climate"));
  expect(response.status).toBe(200);
  expect((await response.json()).surveys).toEqual([{ id, title: "Encuesta" }]);
  expect(state.privateQuery).not.toHaveBeenCalled();
});
