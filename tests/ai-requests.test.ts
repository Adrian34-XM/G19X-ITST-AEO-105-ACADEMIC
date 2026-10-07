import { afterEach, expect, it, vi } from "vitest";
import { queueAnalysis, requestAnalysis } from "../src/components/ai-requests";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("espera al resumen automático antes de iniciar gráficas para la misma cuenta", async () => {
  let finish!: () => void;
  const first = queueAnalysis(
    "queue-user:RH_ADMIN",
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const send = vi.fn(async () => "gráficas");
  const waiting = vi.fn();
  const second = queueAnalysis("queue-user", send, { onWaiting: waiting });
  expect(send).not.toHaveBeenCalled();
  expect(waiting).toHaveBeenLastCalledWith(true);
  finish();
  await first;
  expect(await second).toBe("gráficas");
  expect(waiting).toHaveBeenLastCalledWith(false);
});

it("no bloquea otra cuenta y libera el turno después de un fallo", async () => {
  let reject!: (error: Error) => void;
  const first = queueAnalysis(
    "failed-user",
    () =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  const failed = expect(first).rejects.toThrow("proveedor");
  const next = queueAnalysis("failed-user", async () => "siguiente");
  expect(await queueAnalysis("other-user", async () => "independiente")).toBe(
    "independiente",
  );
  reject(new Error("proveedor"));
  await failed;
  expect(await next).toBe("siguiente");
});

it("omite una solicitud en espera si la persona ya cambió de vista", async () => {
  let finish!: () => void;
  const first = queueAnalysis(
    "changed-view",
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  let current = true;
  const send = vi.fn(async () => "obsoleto");
  const next = queueAnalysis("changed-view", send, {
    isCurrent: () => current,
  });
  const cancelled = expect(next).rejects.toThrow("reemplazada");
  current = false;
  finish();
  await first;
  await cancelled;
  expect(send).not.toHaveBeenCalled();
});

it("espera y reintenta un conflicto de otra pestaña conservando instrucciones y filtros", async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json(
        { error: "Ya hay un análisis en curso.", code: "AI_IN_PROGRESS" },
        { status: 409 },
      ),
    )
    .mockResolvedValueOnce(Response.json({ result: { charts: [] } }));
  vi.stubGlobal("fetch", fetcher);
  const waiting = vi.fn();
  const payload = {
    mode: "chart",
    prompt: "Tareas por área",
    filters: { days: "7" },
  };
  const result = requestAnalysis("other-tab", "/api/ai/workforce", payload, {
    onWaiting: waiting,
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(waiting).toHaveBeenLastCalledWith(true);
  await vi.advanceTimersByTimeAsync(5000);
  expect(await result).toEqual({ result: { charts: [] } });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls.map((call) => JSON.parse(call[1].body))).toEqual([
    payload,
    payload,
  ]);
});

it("no reintenta permisos, límites de uso ni fallos de generación", async () => {
  for (const status of [403, 429, 502]) {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "No disponible" }, { status }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      requestAnalysis(`error-${status}`, "/api/ai/workforce", {}),
    ).rejects.toThrow("No disponible");
    expect(fetcher).toHaveBeenCalledTimes(1);
  }
});

it("acota la espera si la reserva nunca se libera", async () => {
  vi.useFakeTimers();
  const fetcher = vi
    .fn()
    .mockImplementation(async () =>
      Response.json(
        { error: "Ocupado", code: "AI_IN_PROGRESS" },
        { status: 409 },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const result = requestAnalysis("timeout-user", "/api/ai/workforce", {});
  const failed = expect(result).rejects.toThrow("anterior sigue ocupado");
  await vi.advanceTimersByTimeAsync(150000);
  await failed;
  expect(fetcher).toHaveBeenCalledTimes(31);
});
