import { beforeEach, expect, it, vi } from "vitest";
import { GET, POST, DELETE } from "@/app/api/profile-photo/route";
const id = "10000000-0000-4000-8000-000000000001";
const state = vi.hoisted(() => ({
  visible: true,
  schema: true,
  upload: vi.fn(),
  remove: vi.fn(),
  rpc: vi.fn(),
  normalize: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  authenticate: async () => ({
    user: { id: "10000000-0000-4000-8000-000000000001" },
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: state.visible ? { photo_path: "own/image.png" } : null,
              error: state.schema ? null : { code: "42703" },
            }),
          }),
        }),
      }),
      rpc: state.rpc,
      storage: {
        from: () => ({
          upload: state.upload,
          remove: state.remove,
          download: async () => ({
            data: new Blob(["photo"], { type: "image/png" }),
            error: null,
          }),
        }),
      },
    },
  }),
}));
vi.mock("@/lib/storage/profile-photo", () => ({
  maxPhotoSize: 2097152,
  normalizeProfilePhoto: state.normalize,
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.visible = true;
  state.schema = true;
  state.normalize.mockResolvedValue(new Uint8Array([137, 80]));
  state.upload.mockResolvedValue({ error: null });
  state.remove.mockResolvedValue({ error: null });
  state.rpc.mockResolvedValue({
    data: { previous_path: "own/old.png" },
    error: null,
  });
});
function request(other = false) {
  const body = new FormData();
  body.set("file", new File(["photo"], "foto.png", { type: "image/png" }));
  if (other) body.set("id", "10000000-0000-4000-8000-000000000002");
  return new Request("http://localhost/api/profile-photo", {
    method: "POST",
    body,
  });
}
it("asocia una foto solo al usuario autenticado y limpia la anterior", async () => {
  expect((await POST(request())).status).toBe(201);
  expect(state.rpc).toHaveBeenCalledWith("set_profile_photo", {
    path: expect.stringMatching(new RegExp(`^${id}/.*\\.png$`)),
  });
  expect(state.remove).toHaveBeenCalledWith(["own/old.png"]);
});
it("rechaza intentar cambiar la foto de otra persona", async () => {
  expect((await POST(request(true))).status).toBe(422);
  expect(state.upload).not.toHaveBeenCalled();
});
it("limpia un objeto nuevo si falla su asociación", async () => {
  state.rpc.mockResolvedValue({ error: { code: "PGRST202" } });
  expect((await POST(request())).status).toBe(503);
  expect(state.remove).toHaveBeenCalledTimes(1);
});
it("informa la migración pendiente antes de subir archivos", async () => {
  state.schema = false;
  expect((await POST(request())).status).toBe(503);
  expect(state.upload).not.toHaveBeenCalled();
});
it("la descarga respeta visibilidad y no se cachea públicamente", async () => {
  const response = await GET(
    new Request(`http://localhost/api/profile-photo?id=${id}`),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Content-Type")).toBe("image/png");
  state.visible = false;
  expect(
    (await GET(new Request(`http://localhost/api/profile-photo?id=${id}`)))
      .status,
  ).toBe(404);
});
it("quitar foto limpia su referencia antes de eliminar el archivo", async () => {
  expect(
    (
      await DELETE(
        new Request("http://localhost/api/profile-photo", { method: "DELETE" }),
      )
    ).status,
  ).toBe(200);
  expect(state.rpc).toHaveBeenCalledWith("set_profile_photo", { path: null });
  expect(state.remove).toHaveBeenCalledWith(["own/old.png"]);
});
