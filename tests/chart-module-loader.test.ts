import { afterEach, describe, expect, it, vi } from "vitest";
import { createChartModuleLoader } from "../src/lib/charts/module-loader";

afterEach(() => vi.useRealTimers());
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe("carga recuperable de amCharts", () => {
  it("comparte una descarga entre gráficas y reutiliza el módulo ya listo", async () => {
    const component = () => null;
    const download = vi.fn().mockResolvedValue({ default: component });
    const resource = createChartModuleLoader(download);
    const notify = vi.fn();
    const unsubscribe = resource.subscribe(notify);
    resource.load();
    resource.load();
    resource.load();
    await flush();
    expect(download).toHaveBeenCalledTimes(1);
    expect(resource.getSnapshot()).toEqual({ status: "ready", component });
    expect(resource.getServerSnapshot()).toEqual({ status: "idle" });
    expect(notify).toHaveBeenCalledTimes(2);
    unsubscribe();
    resource.load();
    expect(download).toHaveBeenCalledTimes(1);
  });
  it("una importación rechazada muestra error y el reintento recupera sin recargar la página", async () => {
    const component = () => null;
    const download = vi
      .fn()
      .mockRejectedValueOnce(new Error("ChunkLoadError"))
      .mockResolvedValueOnce({ default: component });
    const resource = createChartModuleLoader(download);
    resource.load();
    await flush();
    expect(resource.getSnapshot().status).toBe("error");
    resource.load();
    await flush();
    expect(resource.getSnapshot()).toEqual({ status: "ready", component });
    expect(download).toHaveBeenCalledTimes(2);
  });
  it("sale de la espera a los 30 segundos y descarta intentos obsoletos", async () => {
    vi.useFakeTimers();
    const stale = () => null,
      current = () => null;
    let finishOld!: (value: { default: typeof stale }) => void;
    const download = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce({ default: current });
    const resource = createChartModuleLoader(download);
    resource.load();
    await flush();
    await vi.advanceTimersByTimeAsync(29999);
    expect(resource.getSnapshot().status).toBe("loading");
    await vi.advanceTimersByTimeAsync(1);
    expect(resource.getSnapshot().status).toBe("error");
    resource.load();
    await flush();
    finishOld({ default: stale });
    await flush();
    expect(resource.getSnapshot()).toEqual({
      status: "ready",
      component: current,
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("recupera una descarga lenta que termina después del límite, sin otro intento", async () => {
    vi.useFakeTimers();
    const component = () => null;
    let finish!: (value: { default: typeof component }) => void;
    const resource = createChartModuleLoader<typeof component>(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    resource.load();
    await flush();
    await vi.advanceTimersByTimeAsync(30000);
    expect(resource.getSnapshot().status).toBe("error");
    finish({ default: component });
    await flush();
    expect(resource.getSnapshot()).toEqual({ status: "ready", component });
  });
  it("captura fallos síncronos sin una promesa rechazada sin manejar", async () => {
    const resource = createChartModuleLoader(() => {
      throw new Error("Sin conexión");
    });
    resource.load();
    await flush();
    expect(resource.getSnapshot().status).toBe("error");
  });
});
