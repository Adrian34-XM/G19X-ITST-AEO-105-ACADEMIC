import { expect, it, vi } from "vitest";
import {
  shareSummaryRequest,
  summaryRequestKey,
} from "../src/components/summary-requests";

it("comparte llamadas simultáneas y permite actualizar después", async () => {
  let finish!: (value: string) => void;
  const send = vi.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const key = summaryRequestKey("u", "RH_ADMIN", {
    area: "tasks",
    filters: { priority: "HIGH" },
  });
  const first = shareSummaryRequest(key, send);
  expect(shareSummaryRequest(key, send)).toBe(first);
  expect(send).toHaveBeenCalledTimes(1);
  finish("resumen");
  expect(await first).toBe("resumen");
  await shareSummaryRequest(key, async () => "actualizado").then((r) =>
    expect(r).toBe("actualizado"),
  );
});
it("separa módulos, usuarios, roles y filtros y permite reintentar errores", async () => {
  const keys = [
    summaryRequestKey("u", "JEFE", { area: "tasks", filters: {} }),
    summaryRequestKey("u", "JEFE", {
      area: "tasks",
      filters: { priority: "HIGH" },
    }),
    summaryRequestKey("u", "JEFE", { area: "performance", filters: {} }),
    summaryRequestKey("v", "JEFE", { area: "tasks", filters: {} }),
    summaryRequestKey("u", "EMPLEADO", { area: "tasks", filters: {} }),
  ];
  expect(new Set(keys).size).toBe(keys.length);
  await expect(
    shareSummaryRequest(keys[0], async () => {
      throw new Error("offline");
    }),
  ).rejects.toThrow("offline");
  await expect(
    shareSummaryRequest(keys[0], async () => "reintento"),
  ).resolves.toBe("reintento");
});
