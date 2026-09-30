import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { POST as access } from "@/app/api/auth/[action]/route";
import { POST as invite } from "@/app/api/admin/users/route";
import { authEmailRedirect } from "@/lib/auth/email-links";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signUp: vi.fn(),
  createUser: vi.fn(),
  inviteUserByEmail: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  db: async () => ({
    auth: mocks,
    rpc: mocks.rpc,
    from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }),
  }),
  adminDb: () => ({ auth: { admin: mocks } }),
}));
const send = (action: string, body: unknown, origin = "http://localhost") =>
  access(
    new Request(`http://localhost/api/auth/${action}`, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ action }) },
  );
const inviteRequest = () =>
  invite(
    new Request("http://localhost/api/admin/users", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "new@example.test",
        full_name: "Prueba",
        role: "RH_ADMIN",
      }),
    }),
  );
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", "https://nexo.example.test");
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "actor" } },
    error: null,
  });
  mocks.single.mockResolvedValue({
    data: { id: "actor", role: "SUPERUSER", active: true },
  });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.createUser.mockResolvedValue({
    data: { user: { id: "created" } },
    error: null,
  });
  mocks.inviteUserByEmail.mockResolvedValue({
    data: { user: { id: "created" } },
    error: null,
  });
  mocks.deleteUser.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

it("invita sin contraseña y asigna el rol antes de enviar el correo", async () => {
  expect((await inviteRequest()).status).toBe(201);
  expect(mocks.createUser).toHaveBeenCalledWith({
    email: "new@example.test",
    email_confirm: false,
    user_metadata: { full_name: "Prueba" },
  });
  expect(mocks.inviteUserByEmail).toHaveBeenCalledWith("new@example.test", {
    redirectTo: "https://nexo.example.test/auth/confirm",
  });
  expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.inviteUserByEmail.mock.invocationCallOrder[0],
  );
});
it("rechaza duplicados sin modificar ni eliminar la cuenta existente", async () => {
  mocks.createUser.mockResolvedValue({
    data: { user: null },
    error: { code: "email_exists" },
  });
  expect((await inviteRequest()).status).toBe(409);
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  expect(mocks.deleteUser).not.toHaveBeenCalled();
});
it("un empleado no puede invitar", async () => {
  mocks.single.mockResolvedValue({
    data: { id: "actor", role: "EMPLEADO", active: true },
  });
  expect((await inviteRequest()).status).toBe(403);
  expect(mocks.createUser).not.toHaveBeenCalled();
});
it("compensa un fallo de correo solo sobre la cuenta recién creada", async () => {
  mocks.inviteUserByEmail.mockResolvedValue({ error: { status: 500 } });
  expect((await inviteRequest()).status).toBe(503);
  expect(mocks.deleteUser).toHaveBeenCalledWith("created");
});
it("no envía la invitación si falla la asignación de permisos", async () => {
  mocks.rpc.mockResolvedValue({ error: { code: "42501" } });
  expect((await inviteRequest()).status).toBeGreaterThanOrEqual(400);
  expect(mocks.inviteUserByEmail).not.toHaveBeenCalled();
  expect(mocks.deleteUser).toHaveBeenCalledWith("created");
});
it("recuperación no revela si existe el correo", async () => {
  const first = await (
    await send("recover", { email: "known@example.test" })
  ).json();
  mocks.resetPasswordForEmail.mockResolvedValue({ error: { status: 422 } });
  expect(
    await (await send("recover", { email: "unknown@example.test" })).json(),
  ).toEqual(first);
});
it.each(["invite", "recovery"])(
  "confirma %s y dirige a elegir contraseña",
  async (type) => {
    expect(
      await (await send("confirm", { type, token_hash: "test-token" })).json(),
    ).toEqual({ redirect: "/auth/password" });
  },
);
it("confirma registro y cierra la sesión antes del acceso", async () => {
  expect(
    (
      await (
        await send("confirm", { type: "signup", token_hash: "test-token" })
      ).json()
    ).redirect,
  ).toBe("/login");
  expect(mocks.signOut).toHaveBeenCalled();
});
it("un enlace caducado o reutilizado no continúa", async () => {
  mocks.verifyOtp.mockResolvedValue({ error: { code: "otp_expired" } });
  expect(
    (await send("confirm", { type: "invite", token_hash: "old-token" })).status,
  ).toBe(400);
});
it("no admite tipos de OTP ajenos ni redirecciones elegidas por el cliente", async () => {
  expect(
    (await send("confirm", { type: "email_change", token_hash: "token" }))
      .status,
  ).toBe(422);
  expect(
    (
      await send("confirm", {
        type: "invite",
        token_hash: "token",
        next: "https://evil.test",
      })
    ).status,
  ).toBe(422);
  expect(mocks.verifyOtp).not.toHaveBeenCalled();
});
it("requiere sesión para establecer contraseña", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect(
    (
      await send("password", {
        password: "new-password-123",
        confirm_password: "new-password-123",
      })
    ).status,
  ).toBe(401);
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it("rechaza contraseñas distintas y guarda una válida cerrando sesiones", async () => {
  expect(
    (
      await send("password", {
        password: "new-password-123",
        confirm_password: "other",
      })
    ).status,
  ).toBe(422);
  expect(mocks.updateUser).not.toHaveBeenCalled();
  expect(
    (
      await send("password", {
        password: "new-password-123",
        confirm_password: "new-password-123",
      })
    ).status,
  ).toBe(200);
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
});
it("registros duplicados reciben respuesta neutra", async () => {
  mocks.signUp.mockResolvedValue({
    data: { user: null, session: null },
    error: { code: "user_already_exists" },
  });
  const response = await send("register", {
    email: "existing@example.test",
    password: "long-password-123",
    full_name: "Candidato",
  });
  expect(response.status).toBe(200);
  expect(mocks.signUp.mock.calls[0][0].options.emailRedirectTo).toBe(
    "https://nexo.example.test/auth/confirm",
  );
});
it("rechaza CSRF antes de enviar correos", async () => {
  expect(
    (await send("recover", { email: "test@example.test" }, "https://evil.test"))
      .status,
  ).toBe(403);
  expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
});
it("exige origen fijo HTTPS en producción y admite localhost", () => {
  vi.stubEnv("APP_URL", "http://empresa.test");
  expect(() => authEmailRedirect()).toThrow("HTTPS");
  vi.stubEnv("APP_URL", "http://127.0.0.1:3000");
  expect(authEmailRedirect()).toBe("http://127.0.0.1:3000/auth/confirm");
});
