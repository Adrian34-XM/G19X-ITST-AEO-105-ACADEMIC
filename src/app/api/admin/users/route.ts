/**
 * @file Alta administrativa de cuentas con privilegios de superusuario. La creación en Auth y la
 * asignación de perfil no son una sola transacción; contempla compensación si falla el paso
 * posterior.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Reserva una cuenta sin contraseña, asigna su rol y envía la invitación. Si falla un paso
 * posterior, compensa únicamente la cuenta creada por esta solicitud.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireRole, ApiError } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/server";
import { checkOrigin, failure, readJson, databaseError } from "@/lib/api";
import { roles } from "@/lib/permissions";
import { authEmailRedirect } from "@/lib/auth/email-links";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["SUPERUSER"]);
    const input = z
      .object({
        email: z
          .email()
          .max(254)
          .transform((v) => v.toLowerCase()),
        full_name: z.string().min(1).max(150),
        role: z.enum(roles),
      })
      .strict()
      .parse(await readJson(req));
    const admin = adminDb();
    const redirectTo = authEmailRedirect();
    // Reservar primero la cuenta permite rechazar duplicados sin modificar usuarios existentes.
    // No tiene contraseña ni correo confirmado hasta que su titular acepte la invitación.
    const { data, error } = await admin.auth.admin.createUser({
      email: input.email,
      email_confirm: false,
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
    const invitation = await admin.auth.admin.inviteUserByEmail(input.email, {
      redirectTo,
    });
    if (invitation.error) {
      const cleanup = await admin.auth.admin.deleteUser(data.user.id);
      throw new ApiError(
        503,
        cleanup.error
          ? "No se pudo enviar la invitación. La cuenta quedó creada; revisa su estado antes de volver a intentarlo."
          : "No se pudo enviar la invitación. Revisa el servicio de correo e inténtalo de nuevo.",
      );
    }
    return NextResponse.json(
      {
        id: data.user.id,
        message:
          "Invitación enviada. La persona definirá su contraseña desde el correo.",
      },
      { status: 201 },
    );
  } catch (e) {
    return failure(e);
  }
}
