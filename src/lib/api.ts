import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth";
export function checkOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  // Next.js may reconstruct req.url using its bind hostname (localhost).
  // Host is the authority actually addressed by the browser. Do not trust
  // forwarded-host headers supplied by clients.
  const destination = new URL(req.url);
  const host = req.headers.get("host");
  if (host) {
    if (!/^(?:\[[0-9a-f:]+\]|[a-z0-9.-]+)(?::[0-9]+)?$/i.test(host))
      throw new ApiError(403, "Origen no autorizado.");
    destination.host = host;
  }
  if (origin && origin !== destination.origin)
    throw new ApiError(403, "Origen no autorizado.");
  if (req.headers.get("sec-fetch-site") === "cross-site")
    throw new ApiError(403, "Origen no autorizado.");
}
export function databaseError(error: { code?: string; message: string }) {
  const messages: Record<string, string> = {
    SCHEDULE_CONFLICT:
      "El entrevistador ya tiene una entrevista en ese horario.",
    INVALID_TRANSITION: "El estado actual no permite esta acción.",
    VACANCY_CLOSED: "Esta vacante ya no recibe postulaciones.",
    CLOSE_FIRST: "Cierra la vacante antes de eliminarla.",
    RATE_LIMIT: "Límite de IA alcanzado. Espera un minuto.",
    AI_IN_PROGRESS: "Ya hay un análisis en curso.",
    INTERVIEW_REQUIRED: "Agenda una entrevista antes de contratar.",
    ALREADY_EMPLOYEE: "La persona ya fue contratada.",
  };
  const status =
    error.code === "42501"
      ? 403
      : error.code === "23505" || error.code === "23503"
        ? 409
        : error.code === "P0002"
          ? 404
          : error.code === "P0001"
            ? 429
            : 422;
  throw new ApiError(
    status,
    messages[error.message] ??
      (status === 403
        ? "No tienes acceso a este recurso."
        : status === 409
          ? "El registro ya existe o tiene registros relacionados."
          : "No se pudo guardar. Verifica los datos."),
  );
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        error: "Datos inválidos.",
        fields: error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 },
    );
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  console.error("request_failed", {
    type: error instanceof Error ? error.name : "Unknown",
  });
  return NextResponse.json(
    { error: "El servicio no está disponible. Intenta de nuevo." },
    { status: 503 },
  );
}
export async function readJson(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > 100000)
    throw new ApiError(413, "Solicitud demasiado grande.");
  const text = await req.text();
  if (text.length > 100000)
    throw new ApiError(413, "Solicitud demasiado grande.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "JSON inválido.");
  }
}
