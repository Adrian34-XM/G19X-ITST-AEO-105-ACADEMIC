import { requireHrHierarchySchema } from "@/lib/api";
/** Asigna el jefe directo con autorización y prevención de ciclos en PostgreSQL. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireRole, ApiError } from "@/lib/auth";
import { checkOrigin, readJson, failure, databaseError } from "@/lib/api";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["RH_ADMIN", "JEFE"]);
    const input = z
      .object({ employee: z.uuid(), manager: z.uuid().nullable() })
      .strict()
      .parse(await readJson(req));
    await requireHrHierarchySchema(client);
    const { error } = await client.rpc("assign_team_manager", input);
    if (error) {
      if (error.code === "PGRST202")
        throw new ApiError(
          503,
          "Aplica la migración de ambiente laboral y jerarquía.",
        );
      if (error.message === "HIERARCHY_CYCLE")
        throw new ApiError(
          422,
          "Esta asignación crea un ciclo en la jerarquía.",
        );
      if (error.message === "INVALID_MANAGER")
        throw new ApiError(
          422,
          "El jefe debe tener una cuenta de jefe activa.",
        );
      databaseError(error);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
