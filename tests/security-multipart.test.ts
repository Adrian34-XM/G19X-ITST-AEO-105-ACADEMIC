import { beforeEach, it, expect, vi } from "vitest";
import { POST as resourcePost } from "@/app/api/[...segments]/route";
import { POST as vacancyPost } from "@/app/api/ai/vacancy/route";

const state = vi.hoisted(() => ({
  role: "CANDIDATO", upload: vi.fn(), from: vi.fn(), generate: vi.fn(), rpc: vi.fn(), finish: vi.fn(),
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  authenticate: async () => ({
    user: { id: "user" }, profile: { id: "user", role: state.role },
    client: { from: state.from, rpc: state.rpc },
  }),
}));
vi.mock("@/app/api/files/route", () => ({ POST: state.upload, GET: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ adminDb: () => ({ from: () => ({ update: () => ({ eq: () => ({ eq: state.finish }) }) }) }) }));
vi.mock("@/lib/ai/provider", () => ({ generate: state.generate }));
const id = "10000000-0000-4000-8000-000000000001";
const endpoints = [
  { segments: ["candidates", "cv"], bucket: "cvs" },
  { segments: ["tasks", id, "evidence"], bucket: "task-evidence" },
  { segments: ["onboarding", id, "documents"], bucket: "onboarding-documents" },
  { segments: ["ai", "vacancy"], bucket: null },
];
beforeEach(() => {
  vi.clearAllMocks();
  state.role = "CANDIDATO";
  state.upload.mockImplementation(async (req: Request) => {
    const form = await req.formData();
    return Response.json({ bucket: form.get("bucket"), id: form.get("id"), name: (form.get("file") as File).name });
  });
  state.from.mockReturnValue({ select: () => ({ eq: () => ({ single: async () => ({ data: { id, name: "Puesto ficticio" } }) }) }) });
  state.rpc.mockResolvedValue({ data: "run", error: null });
  state.finish.mockResolvedValue({ error: null });
  state.generate.mockResolvedValue({ model: "test", result: {
    title: "Propuesta", description: "Trabajo ficticio", requirements: "Pruebas", skills: ["TypeScript"], experience_required: 1,
  } });
});
function post(req: Request, segments: string[]) {
  if (segments[0] === "ai") { state.role = "RH_ADMIN"; return vacancyPost(req); }
  return resourcePost(req, { params: Promise.resolve({ segments }) });
}
it.each(endpoints.flatMap((endpoint) => [undefined, "1"].map((length) => ({ ...endpoint, length }))))(
  "$segments rechaza bytes excesivos con Content-Length=$length antes de parsear/delegar",
  async ({ segments, length }) => {
    const body = new FormData();
    body.set("position_id", id);
    body.set("context", "Propuesta de vacante ficticia");
    // Un campo excesivo también exige límite: no solo file.size.
    body.set("padding", "x".repeat(6 * 1024 * 1024));
    const encoded = new Response(body);
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    let offset = 0;
    const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (offset >= bytes.length) return controller.close();
        const end = Math.min(offset + 65536, bytes.length);
        controller.enqueue(bytes.subarray(offset, end));
        offset = end;
      }, cancel,
    });
    const headers: Record<string, string> = { "content-type": encoded.headers.get("content-type")! };
    if (length) headers["content-length"] = length;
    const req = new Request("http://localhost/api/" + segments.join("/"), {
      method: "POST", headers, body: stream, duplex: "half",
    } as RequestInit & { duplex: string });
    const parser = vi.spyOn(req, "formData");
    const response = await post(req, segments);
    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledOnce();
    expect(offset).toBeLessThan(bytes.length);
    expect(parser).not.toHaveBeenCalled();
    expect(state.upload).not.toHaveBeenCalled();
    expect(state.from).not.toHaveBeenCalled();
    expect(state.generate).not.toHaveBeenCalled();
  },
);
it.each(endpoints)("$segments mantiene la solicitud multipart válida", async ({ segments, bucket }) => {
  const body = new FormData();
  body.set("position_id", id);
  body.set("context", "Propuesta de vacante ficticia");
  body.set("file", new File(["Documento ficticio"], "prueba.txt", { type: "text/plain" }));
  const response = await post(new Request("http://localhost/api/" + segments.join("/"), { method: "POST", body }), segments);
  expect(response.status).toBe(200);
  if (bucket) expect(await response.json()).toEqual({ bucket, id: segments.length === 3 ? id : null, name: "prueba.txt" });
  else { expect((await response.json()).draft.status).toBe("DRAFT"); expect(state.generate).toHaveBeenCalledOnce(); }
});
