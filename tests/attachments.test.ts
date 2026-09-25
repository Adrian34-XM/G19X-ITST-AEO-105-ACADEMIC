import { afterEach, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authorizedAttachment } from "@/lib/ai/attachments";
afterEach(() => vi.unstubAllEnvs());
it("adjunto visual usa la descarga de la sesión autorizada", async () => {
  vi.stubEnv("AI_PROVIDER", "ollama");
  vi.stubEnv("OLLAMA_VISION_MODEL", "gemma3:4b");
  const download = vi
    .fn()
    .mockResolvedValue({ data: new Blob(["fixture"]), error: null });
  const from = vi.fn().mockReturnValue({ download });
  const file = await authorizedAttachment(
    { storage: { from } } as unknown as SupabaseClient,
    "task-evidence",
    "owner/file.png",
  );
  expect(from).toHaveBeenCalledWith("task-evidence");
  expect(download).toHaveBeenCalledWith("owner/file.png");
  expect(file.mimeType).toBe("image/png");
  download.mockResolvedValue({ data: null, error: { message: "denied" } });
  await expect(
    authorizedAttachment(
      { storage: { from } } as unknown as SupabaseClient,
      "task-evidence",
      "other/file.png",
    ),
  ).rejects.toThrow("archivo autorizado");
});
it("rechaza formatos sin lector visual antes de descargar", async () => {
  await expect(
    authorizedAttachment({} as SupabaseClient, "task-evidence", "file.docx"),
  ).rejects.toThrow("PDF, PNG y JPG");
});
