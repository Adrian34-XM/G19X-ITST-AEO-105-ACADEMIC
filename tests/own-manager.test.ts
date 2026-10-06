import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ownManagerName } from "@/modules/workspace/own-manager";
const state = vi.hoisted(() => ({
  admin: vi.fn(),
  query: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ adminDb: state.admin }));
beforeEach(() => {
  vi.clearAllMocks();
  state.query.mockResolvedValue({
    data: { profiles: { full_name: "Diego Herrera" } },
    error: null,
  });
  state.select.mockReturnValue({ eq: state.eq });
  state.eq.mockReturnValue({ maybeSingle: state.query });
  state.admin.mockReturnValue({ from: () => ({ select: state.select }) });
});
function client(
  authenticated = true,
  visible = true,
  manager: string | null = "boss",
) {
  return {
    auth: {
      getUser: async () => ({
        data: { user: authenticated ? { id: "session-user" } : null },
      }),
    },
    from: () => ({
      select: () => ({
        eq: (key: string, id: string) => {
          expect([key, id]).toEqual(["profile_id", "session-user"]);
          return {
            maybeSingle: async () => ({
              data: visible
                ? { id: "own-employee", manager_id: manager }
                : null,
              error: null,
            }),
          };
        },
      }),
    }),
  } as unknown as SupabaseClient;
}
it("expone solo el nombre del jefe asignado a la sesión, sin expediente ni datos de contacto", async () => {
  expect(await ownManagerName(client())).toEqual([
    { id: "own-employee", full_name: "Diego Herrera" },
  ]);
  expect(state.select).toHaveBeenCalledWith("profiles(full_name)");
  expect(state.eq).toHaveBeenCalledWith("id", "boss");
});
it("no usa privilegios para visitantes ni empleados ocultos por RLS ni personas sin jefe", async () => {
  expect(await ownManagerName(client(false))).toEqual([]);
  expect(await ownManagerName(client(true, false))).toEqual([]);
  expect(await ownManagerName(client(true, true, null))).toEqual([]);
  expect(state.admin).not.toHaveBeenCalled();
});
it("no inventa el nombre si falla la consulta", async () => {
  state.query.mockResolvedValue({
    data: null,
    error: { message: "unavailable" },
  });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await ownManagerName(client())).toEqual([]);
  log.mockRestore();
});
