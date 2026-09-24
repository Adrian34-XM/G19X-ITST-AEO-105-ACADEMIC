/** Una sola transacción comprueba todos los destinatarios antes de asignar. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireRole, ApiError } from "@/lib/auth";
import { checkOrigin, readJson, failure, databaseError } from "@/lib/api";
import { schemas } from "@/modules/commands/schemas";
const employees = z
  .array(z.uuid())
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, "No repitas personas.");
const input = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("course"),
      employees,
      payload: schemas["course.assign"].omit({ employee_id: true }),
    })
    .strict(),
  z
    .object({
      kind: z.literal("task"),
      employees,
      payload: schemas["task.save"].omit({ id: true, employee_id: true }),
    })
    .strict(),
]);
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["RH_ADMIN", "JEFE"]);
    const body = input.parse(await readJson(req));
    const { data, error } = await client.rpc("assign_many", {
      kind: body.kind,
      people: body.employees,
      payload: body.payload,
    });
    if (error) {
      if (error.code === "PGRST202")
        throw new ApiError(
          503,
          "Aplica la migración de asignaciones múltiples en Supabase.",
        );
      databaseError(error);
    }
    return NextResponse.json(data);
  } catch (e) {
    return failure(e);
  }
}
