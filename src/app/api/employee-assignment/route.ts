import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireRole, ApiError } from "@/lib/auth";
import { checkOrigin, readJson, failure, databaseError } from "@/lib/api";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["RH_ADMIN"]);
    const input = z
      .object({
        employee: z.uuid(),
        department: z.uuid(),
        position: z.uuid(),
        manager: z.uuid().nullable(),
      })
      .strict()
      .parse(await readJson(req));
    const { error } = await client.rpc("complete_hiring_assignment", {
      employee: input.employee,
      department: input.department,
      target_position: input.position,
      manager: input.manager,
    });
    if (error?.code === "PGRST202")
      throw new ApiError(
        503,
        "Activa supabase/activar-mejoras-rh.sql para habilitar la asignación posterior a la contratación.",
      );
    if (error?.message === "ASSIGNMENT_NOT_PENDING")
      throw new ApiError(
        409,
        "La asignación ya fue completada o la persona no está activa. Actualiza la vista.",
      );
    if (error) databaseError(error);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
