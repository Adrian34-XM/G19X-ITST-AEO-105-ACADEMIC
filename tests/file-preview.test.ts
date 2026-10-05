import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "@/app/api/files/route";
const state = vi.hoisted(() => ({
  visible: true,
  ext: "png",
  download: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  authenticate: async () => ({
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: state.visible
                ? { file_path: "owner/file." + state.ext }
                : null,
              error: null,
            }),
          }),
        }),
      }),
      rpc: state.rpc,
      storage: { from: () => ({ download: state.download }) },
    },
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.visible = true;
  state.ext = "png";
  state.rpc.mockResolvedValue({ error: null });
  state.download.mockResolvedValue({
    data: new Blob(["fixture"]),
    error: null,
  });
});
const req = (mode = "content") =>
  new Request(
    "http://localhost/api/files?bucket=course-evidence&id=10000000-0000-4000-8000-000000000001&preview=" +
      mode,
  );
it.each([
  ["png", "image/png"],
  ["pdf", "application/pdf"],
])(
  "vista privada de %s conserva permisos y no permite caché",
  async (ext, mime) => {
    state.ext = ext;
    const r = await GET(req());
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe(mime);
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await r.text()).toBe("fixture");
    expect(state.rpc).toHaveBeenCalled();
  },
);
it("la vista previa deniega un registro no visible", async () => {
  state.visible = false;
  expect((await GET(req())).status).toBe(404);
  expect(state.download).not.toHaveBeenCalled();
});
it("metadatos usan el origen de la aplicación sin un enlace público", async () => {
  const r = await GET(req("1"));
  expect((await r.json()).url).toMatch(/^\/api\/files\?/);
  expect(state.download).not.toHaveBeenCalled();
});
it("error de storage no entrega el archivo", async () => {
  state.download.mockResolvedValue({
    data: null,
    error: { message: "denied" },
  });
  expect((await GET(req())).status).toBe(403);
});
