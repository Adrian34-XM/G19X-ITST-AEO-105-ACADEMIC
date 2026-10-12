import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/application-updates/route";
const state = vi.hoisted(() => ({
  role: "CANDIDATO",
  authFailed: false,
  noCandidate: false,
  noApplications: false,
  auditFailure: false,
  filters: vi.fn(),
  adminFilters: vi.fn(),
  admin: vi.fn(),
}));
const own = "00000000-0000-4000-8000-000000000001";
const application = {
  id: own,
  vacancy_id: "vacancy",
  status: "EN_REVISION",
  applied_at: "2026-10-12T12:00:00Z",
  updated_at: "2026-10-12T13:00:00Z",
  ai_result: "PRIVATE",
  candidate_id: "private-id",
};
function query(table: string, admin = false) {
  const rows = admin
    ? [
        {
          id: "event",
          resource_id: own,
          resource_type: "applications",
          action: "UPDATE",
          metadata: {
            previous_status: "POSTULADO",
            new_status: "EN_REVISION",
            actor_name: "PRIVATE",
          },
          created_at: "2026-10-12T13:00:00Z",
        },
        {
          id: "foreign",
          resource_id: "another-application",
          resource_type: "applications",
          action: "UPDATE",
          metadata: { previous_status: "POSTULADO", new_status: "ENTREVISTA" },
          created_at: "2026-10-12T13:00:00Z",
        },
      ]
    : table === "candidates"
      ? state.noCandidate
        ? []
        : [{ id: "candidate" }]
      : table === "applications"
        ? state.noApplications
          ? []
          : [application]
        : [{ id: "vacancy", title: "Vacante de prueba" }];
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn((column, value) => {
      (admin ? state.adminFilters : state.filters)(table, column, value);
      return q;
    }),
    in: vi.fn((column, value) => {
      (admin ? state.adminFilters : state.filters)(table, column, value);
      return q;
    }),
    order: vi.fn(() => q),
    limit: vi.fn(() => q),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: rows,
        error:
          admin && state.auditFailure
            ? { code: "XX000", message: "Private database details" }
            : null,
      }).then(resolve),
  };
  return q;
}
vi.mock("@/lib/auth", async (original) => {
  const real = await original<typeof import("@/lib/auth")>();
  return {
    ...real,
    authenticate: async () => {
      if (state.authFailed)
        throw new real.ApiError(401, "Inicia sesión para continuar.");
      return {
        profile: { id: "me", role: state.role },
        client: { from: (table: string) => query(table) },
      };
    },
  };
});
vi.mock("@/lib/supabase/server", () => ({
  adminDb: () => {
    state.admin();
    return { from: (table: string) => query(table, true) };
  },
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "CANDIDATO";
  state.authFailed = false;
  state.noCandidate = false;
  state.noApplications = false;
  state.auditFailure = false;
});
it("autoriza con la sesión antes de consultar auditoría y devuelve solo estados propios", async () => {
  const response = await GET();
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(state.filters).toHaveBeenCalledWith("candidates", "profile_id", "me");
  expect(state.filters).toHaveBeenCalledWith(
    "applications",
    "candidate_id",
    "candidate",
  );
  expect(state.adminFilters).toHaveBeenCalledWith(
    "audit_logs",
    "resource_type",
    "applications",
  );
  expect(state.adminFilters).toHaveBeenCalledWith("audit_logs", "resource_id", [
    own,
  ]);
  expect(body.updates).toHaveLength(1);
  expect(JSON.stringify(body)).not.toMatch(
    /PRIVATE|actor_name|ai_result|candidate_id|another-application/,
  );
});
it.each(["RH_ADMIN", "SUPERUSER", "JEFE"])(
  "deniega %s sin usar la clave privilegiada",
  async (role) => {
    state.role = role;
    expect((await GET()).status).toBe(403);
    expect(state.admin).not.toHaveBeenCalled();
  },
);
it("al cambiar a empleado conserva únicamente las notificaciones de su candidatura propia", async () => {
  state.role = "EMPLEADO";
  const response = await GET();
  const payload = await response.json();
  expect(response.status).toBe(200);
  expect(
    payload.updates.map(
      (event: { application_id: string }) => event.application_id,
    ),
  ).toEqual([own]);
  expect(state.filters).toHaveBeenCalledWith("candidates", "profile_id", "me");
});
it("deniega solicitudes sin sesión", async () => {
  state.authFailed = true;
  expect((await GET()).status).toBe(401);
  expect(state.admin).not.toHaveBeenCalled();
});
it.each(["noCandidate", "noApplications"] as const)(
  "sin %s no consulta auditoría",
  async (key) => {
    state[key] = true;
    expect(await (await GET()).json()).toEqual({
      applications: [],
      updates: [],
    });
    expect(state.admin).not.toHaveBeenCalled();
  },
);
it("un fallo de auditoría se informa sin mostrar detalles privados ni inventar un historial vacío", async () => {
  state.auditFailure = true;
  const response = await GET();
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(JSON.stringify(await response.json())).not.toContain(
    "Private database details",
  );
});
