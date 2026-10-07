import { request, RequestError } from "./forms";

type Options = {
  onWaiting?: (waiting: boolean) => void;
  isCurrent?: () => boolean;
};
// Una cola por cuenta en esta sesión. La reserva SQL sigue siendo la autoridad entre pestañas.
const tails = new Map<string, Promise<void>>();
export class SupersededAnalysis extends Error {
  constructor() {
    super("La solicitud fue reemplazada por otra vista.");
  }
}

export function queueAnalysis<T>(
  viewer: string,
  send: () => Promise<T>,
  options: Options = {},
): Promise<T> {
  const user = viewer.split(":")[0];
  const previous = tails.get(user);
  options.onWaiting?.(!!previous);
  const start = async () => {
    if (options.isCurrent && !options.isCurrent())
      throw new SupersededAnalysis();
    options.onWaiting?.(false);
    return send();
  };
  const job = previous ? previous.then(start) : start();
  const tail = job.then(
    () => {},
    () => {},
  );
  tails.set(user, tail);
  void tail.then(() => {
    if (tails.get(user) === tail) tails.delete(user);
  });
  return job;
}

/** Solo reintenta conflictos de reserva, nunca errores del proveedor, permisos o escritura. */
export function requestAnalysis(
  viewer: string,
  url: string,
  payload: unknown,
  options: Options = {},
) {
  return queueAnalysis(
    viewer,
    async () => {
      const deadline = Date.now() + 150000;
      for (;;) {
        if (options.isCurrent && !options.isCurrent())
          throw new SupersededAnalysis();
        options.onWaiting?.(false);
        try {
          return await request(url, payload);
        } catch (error) {
          if (
            !(error instanceof RequestError) ||
            error.status !== 409 ||
            error.code !== "AI_IN_PROGRESS"
          )
            throw error;
          if (Date.now() >= deadline)
            throw new Error(
              "El análisis anterior sigue ocupado. Espera a que termine y vuelve a intentar.",
            );
          options.onWaiting?.(true);
          await new Promise<void>((resolve) => setTimeout(resolve, 5000));
        }
      }
    },
    options,
  );
}
