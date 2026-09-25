import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { pdfImages } from "@/lib/ai/pdf-vision";
import { inspectFile } from "@/lib/storage/files";
it("extrae texto de PDF y distingue un escaneado", async () => {
  for (const [name, hasText] of [
    ["texto.pdf", true],
    ["escaneado.pdf", false],
  ] as const) {
    const b = await readFile("tests/fixtures/vision/" + name);
    const result = await inspectFile(
      new File([b], name, { type: "application/pdf" }),
      "task-evidence",
    );
    expect(Boolean(result.text.trim())).toBe(hasText);
  }
});
it("convierte PDF escaneado completo en imagen PNG", async () => {
  const images = await pdfImages(
    await readFile("tests/fixtures/vision/escaneado.pdf"),
  );
  expect(images).toHaveLength(1);
  expect(Buffer.from(images[0], "base64").subarray(0, 8)).toEqual(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
});
it("rechaza PDF visual de más de seis páginas y PDF corrupto", async () => {
  await expect(
    pdfImages(await readFile("tests/fixtures/vision/siete-paginas.pdf")),
  ).rejects.toThrow("hasta 6 páginas");
  await expect(pdfImages(new Uint8Array([1, 2, 3]))).rejects.toThrow(
    "PDF válido sin contraseña",
  );
});
