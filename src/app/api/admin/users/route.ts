import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireRole, ApiError } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/server";
import { checkOrigin, failure, readJson, databaseError } from "@/lib/api";
import { roles } from "@/lib/permissions";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["SUPERUSER"]);
    const input = z
      .object({
        email: z.email(),
        password: z.string().min(12).max(128),
        full_name: z.string().min(1).max(150),
        role: z.enum(roles),
      })
      .strict()
      .parse(await readJson(req));
    const admin = adminDb();
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (error || !data.user)
      throw new ApiError(
        409,
        "No se pudo crear el usuario. Verifica si el correo ya existe.",
      );
    const { error: roleError } = await client.rpc("command", {
      op: "profile.admin",
      payload: { id: data.user.id, role: input.role, active: true },
    });
    if (roleError) {
      await admin.auth.admin.deleteUser(data.user.id);
      databaseError(roleError);
    }
    return NextResponse.json({ id: data.user.id }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
