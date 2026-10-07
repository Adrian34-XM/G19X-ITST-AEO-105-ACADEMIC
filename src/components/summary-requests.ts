/** Comparte únicamente solicitudes en curso del mismo usuario, rol, módulo y filtros. */
const pending = new Map<string, Promise<unknown>>();

export function summaryRequestKey(
  userId: string,
  role: string,
  payload: unknown,
) {
  return JSON.stringify([userId, role, payload]);
}

export function shareSummaryRequest<T>(
  key: string,
  send: () => Promise<T>,
): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const promise = send().finally(() => pending.delete(key));
  pending.set(key, promise);
  return promise;
}
