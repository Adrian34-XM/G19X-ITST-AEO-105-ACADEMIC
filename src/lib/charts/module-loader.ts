type ModuleState<T> =
  | { status: "idle" | "loading" }
  | { status: "ready"; component: T }
  | { status: "error" };

/** Una descarga compartida, espera limitada y reintento sin navegar ni perder datos. */
export function createChartModuleLoader<T>(
  download: () => Promise<{ default: T }>,
  timeout = 30000,
) {
  const initial: ModuleState<T> = { status: "idle" };
  let state: ModuleState<T> = initial;
  let attempt = 0;
  const listeners = new Set<() => void>();
  const publish = (next: ModuleState<T>) => {
    state = next;
    listeners.forEach((notify) => notify());
  };
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(notify: () => void) {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    load() {
      if (state.status === "ready" || state.status === "loading") return;
      const id = ++attempt;
      publish({ status: "loading" });
      const timer = setTimeout(() => {
        if (attempt === id) publish({ status: "error" });
      }, timeout);
      // Captura también un fallo síncrono del importador. Las promesas anteriores
      // no pueden reemplazar el resultado de un intento más reciente.
      void Promise.resolve()
        .then(download)
        .then(
          (module) => {
            clearTimeout(timer);
            if (attempt === id)
              publish({ status: "ready", component: module.default });
          },
          () => {
            clearTimeout(timer);
            if (attempt === id) publish({ status: "error" });
          },
        );
    },
  };
}
