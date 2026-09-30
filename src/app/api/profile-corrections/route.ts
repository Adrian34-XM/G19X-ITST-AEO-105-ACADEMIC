/** Solicitudes de corrección: la sesión y las funciones SQL autorizan lectura y revisión. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, ApiError, requireRole } from "@/lib/auth";
import { checkOrigin, readJson, failure, databaseError } from "@/lib/api";
function dbError(error: { code?: string; message?: string }) {
  if (["42P01", "PGRST205", "PGRST202"].includes(error.code ?? ""))
    throw new ApiError(
      503,
      "Activa la migración 202609300001_profile_corrections.sql para habilitar las solicitudes de corrección.",
    );
  if (error.message === "CORRECTION_NOT_PENDING")
    throw new ApiError(
      409,
      "La solicitud ya fue revisada o no está disponible.",
    );
  if (error.code === "23505")
    throw new ApiError(
      409,
      "Ya tienes una solicitud pendiente para este dato.",
    );
  databaseError(error as Parameters<typeof databaseError>[0]);
}
export async function GET(req: Request) {
  try {
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["RH_ADMIN", "JEFE", "EMPLEADO"]);
    const employee = z
      .uuid()
      .parse(new URL(req.url).searchParams.get("employee"));
    const { data, error } = await client
      .from("profile_corrections")
      .select("*")
      .eq("employee_id", employee)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) dbError(error);
    return NextResponse.json(
      { rows: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    const input = z
      .discriminatedUnion("action", [
        z
          .object({
            action: z.literal("request"),
            employee: z.uuid(),
            field: z.enum(["full_name", "hire_date"]),
            value: z.string().trim().min(1).max(150),
            reason: z.string().trim().min(1).max(1000),
          })
          .strict(),
        z
          .object({
            action: z.literal("review"),
            id: z.uuid(),
            approve: z.boolean(),
            comment: z.string().trim().min(1).max(1000),
          })
          .strict(),
      ])
      .parse(await readJson(req));
    if (input.action === "review") requireRole(profile.role, ["RH_ADMIN"]);
    else requireRole(profile.role, ["RH_ADMIN", "JEFE", "EMPLEADO"]);
    const { error } =
      input.action === "request"
        ? await client.rpc("request_profile_correction", {
            eid: input.employee,
            field_name: input.field,
            proposed: input.value,
            explanation: input.reason,
          })
        : await client.rpc("review_profile_correction", {
            rid: input.id,
            approve: input.approve,
            feedback: input.comment,
          });
    if (error) dbError(error);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
