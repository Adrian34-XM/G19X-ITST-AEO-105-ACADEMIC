import { expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { normalizeProfilePhoto } from "@/lib/storage/profile-photo";
it("normaliza y recorta una foto válida a 512x512 sin conservar el archivo original", async () => {
  const canvas = createCanvas(100, 80),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "#176b58";
  ctx.fillRect(0, 0, 100, 80);
  const result = await normalizeProfilePhoto(
    new File([new Uint8Array(await canvas.encode("png"))], "foto.png", {
      type: "image/png",
    }),
  );
  const view = new DataView(
    result.buffer,
    result.byteOffset,
    result.byteLength,
  );
  expect(view.getUint32(16)).toBe(512);
  expect(view.getUint32(20)).toBe(512);
});
it("rechaza documentos, fotos falsas y archivos grandes", async () => {
  await expect(
    normalizeProfilePhoto(
      new File(["texto"], "foto.svg", { type: "image/svg+xml" }),
    ),
  ).rejects.toThrow("PNG o JPG");
  await expect(
    normalizeProfilePhoto(
      new File(["falso"], "foto.png", { type: "image/png" }),
    ),
  ).rejects.toThrow("inválido");
  await expect(
    normalizeProfilePhoto(
      new File([new Uint8Array(2097153)], "foto.png", { type: "image/png" }),
    ),
  ).rejects.toThrow("2 MB");
});
it("bloquea dimensiones excesivas antes de descomprimir", async () => {
  const bytes = new Uint8Array(32);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, 100000);
  view.setUint32(20, 100000);
  await expect(
    normalizeProfilePhoto(
      new File([bytes], "grande.png", { type: "image/png" }),
    ),
  ).rejects.toThrow("dimensiones");
});
