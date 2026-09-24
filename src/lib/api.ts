/**
 * Utilidades HTTP comunes: control de origen, lectura limitada de JSON y traducción de errores. Evita devolver mensajes internos de base de datos o excepciones que podrían contener información sensible.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
/** Exige el esquema que valida la jerarquía de RH antes de editar personal. */
export async function requireHrHierarchySchema(client: SupabaseClient) {
  const { error } = await client.rpc("hr_hierarchy_ready");
  if (error)
    throw new ApiError(
      503,
      "Activa supabase/activar-mejoras-rh.sql en Supabase para habilitar los permisos de jerarquía de RH.",
    );
}
/** Evita ejecutar el flujo antiguo de autoaprobación mientras falta activar la migración. */
export async function requireWorkforceSchema(client: SupabaseClient) {
  const { error } = await client
    .from("onboarding_items")
    .select("reviewed_by")
    .limit(0);
  if (error)
    throw new ApiError(
      503,
      "Falta activar las revisiones e historiales. Ejecuta supabase/activar-mejoras-rh.sql en el SQL Editor de Supabase y vuelve a intentar.",
    );
}
/** Bloquea avances sin evidencias si aún no se activó la nueva migración. */
export async function requireCourseEvidenceSchema(client: SupabaseClient) {
  const { error } = await client.from("course_evidence").select("id").limit(0);
  if (error)
    throw new ApiError(
      503,
      "Ejecuta supabase/migrations/202609230003_course_evidence.sql en Supabase para activar evidencias de capacitación.",
    );
}
export async function validateInterviewSchedule(
  client: SupabaseClient,
  payload: Record<string, unknown>,
) {
  const time = new Date(String(payload.scheduled_at)).getTime();
  if (time >= Date.now()) return;
  if (payload.id) {
    const { data } = await client
      .from("interviews")
      .select("scheduled_at,status")
      .eq("id", payload.id)
      .single();
    if (
      data &&
      new Date(data.scheduled_at).getTime() === time &&
      !(payload.status === "SCHEDULED" && data.status !== "SCHEDULED")
    )
      return;
  }
  throw new ApiError(
    422,
    "Selecciona una fecha y hora posterior al momento actual.",
  );
}
export async function requireHiringSchema(client: SupabaseClient) {
  const { error } = await client.rpc("hiring_options_ready");
  if (error)
    throw new ApiError(
      503,
      "Activa supabase/migrations/202609230004_interviews_hiring.sql para asignar área y jefe al contratar.",
    );
}
/** Rechaza escrituras desde otro origen; no confía en cabeceras de host reenviado. */
export function checkOrigin(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  // Next.js puede reconstruir req.url con el host de escucha (localhost).
  // Host identifica el destino usado por el navegador. No se confía en
  // cabeceras de host reenviado proporcionadas por clientes.
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
/** Convierte códigos de PostgreSQL en mensajes públicos sin revelar detalles internos. */
export function databaseError(error: { code?: string; message: string }) {
  if (error.message === "HR_HIERARCHY_FORBIDDEN")
    throw new ApiError(
      403,
      "Solo el superior de RH más alto de esta cadena o el superusuario puede modificar a este integrante de RH.",
    );
  const messages: Record<string, string> = {
    INTERVIEW_IN_PAST:
      "Selecciona una fecha y hora posterior al momento actual.",
    INVALID_HIRING_AREA: "Selecciona un puesto que pertenezca al área elegida.",
    INVALID_MANAGER: "Selecciona un jefe activo y autorizado.",
    COURSE_EVIDENCE_REQUIRED:
      "Adjunta evidencia del porcentaje de avance solicitado antes de registrar o aprobar la capacitación.",
    CANDIDATE_SCHEDULED:
      "Este candidato ya tiene una entrevista agendada. Edita o cancela la cita existente.",
    SCHEDULE_CONFLICT:
      "El entrevistador ya tiene una entrevista en ese horario.",
    DOCUMENT_REVIEW_PENDING:
      "Revisa todos los archivos entregados en esta actividad antes de aprobarla.",
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
/** Respuesta uniforme para errores conocidos; oculta detalles de fallos inesperados. */
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
