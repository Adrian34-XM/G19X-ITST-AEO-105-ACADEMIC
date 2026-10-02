/**
 * @file Acceso, registro y cierre de sesión mediante Supabase Auth. Traduce fallos a respuestas
 * públicas y administra cookies a través del cliente de servidor.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Registro, acceso y cierre de sesión. El registro público crea candidatos; al iniciar sesión se consulta el perfil activo y se devuelve el destino según su rol.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { checkOrigin, failure, readJson } from "@/lib/api";
import { home, type Role } from "@/lib/permissions";
import { ApiError } from "@/lib/auth";
import {
  authEmailRedirect,
  recoveryMessage,
  registrationMessage,
} from "@/lib/auth/email-links";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(req);
    const client = await db();
    const { action } = await ctx.params;
    if (action === "callback") {
      const input = z
        .union([
          z.object({ code: z.string().min(1).max(4096) }).strict(),
          z
            .object({
              access_token: z.string().min(1).max(16384),
              refresh_token: z.string().min(1).max(4096),
              type: z.enum(["signup", "invite", "recovery"]),
            })
            .strict(),
        ])
        .parse(await readJson(req));
      const result =
        "code" in input
          ? await client.auth.exchangeCodeForSession(input.code)
          : await client.auth.setSession({
              access_token: input.access_token,
              refresh_token: input.refresh_token,
            });
      if (result.error)
        throw new ApiError(
          400,
          "No se pudo validar el enlace. Ábrelo en el mismo navegador donde solicitaste el correo o solicita otro enlace.",
        );
      const identity = await client.auth.getUser();
      if (identity.error || !identity.data.user?.email_confirmed_at) {
        await client.auth.signOut({ scope: "local" });
        throw new ApiError(
          400,
          "No se pudo confirmar el correo. Solicita un enlace nuevo.",
        );
      }
      const recovery =
        "code" in input
          ? "redirectType" in result.data &&
            result.data.redirectType === "recovery"
          : input.type !== "signup";
      if (recovery) return NextResponse.json({ redirect: "/auth/password" });
      await client.auth.signOut({ scope: "local" });
      return NextResponse.json({
        message: "Correo confirmado. Ya puedes iniciar sesión.",
        redirect: "/login",
      });
    }
    if (action === "recover") {
      const input = z
        .object({ email: z.email().max(254) })
        .strict()
        .parse(await readJson(req));
      const { error } = await client.auth.resetPasswordForEmail(input.email, {
        redirectTo: authEmailRedirect(),
      });
      if (error && error.status !== 400 && error.status !== 422)
        throw new ApiError(
          error.status === 429 ? 429 : 503,
          "No se pudo solicitar el correo. Espera unos minutos e inténtalo de nuevo.",
        );
      return NextResponse.json({ message: recoveryMessage });
    }
    if (action === "confirm") {
      const input = z
        .object({
          token_hash: z.string().min(1).max(2048),
          type: z.enum(["invite", "recovery", "signup"]),
        })
        .strict()
        .parse(await readJson(req));
      const { error } = await client.auth.verifyOtp(input);
      if (error)
        throw new ApiError(
          400,
          "El enlace no es válido, ya se utilizó o ha caducado. Solicita uno nuevo desde Recuperar acceso.",
        );
      if (input.type === "signup") {
        await client.auth.signOut();
        return NextResponse.json({
          message: "Correo confirmado. Ya puedes iniciar sesión.",
          redirect: "/login",
        });
      }
      return NextResponse.json({ redirect: "/auth/password" });
    }
    if (action === "password") {
      const input = z
        .object({
          password: z.string().min(12).max(128),
          confirm_password: z.string(),
        })
        .strict()
        .refine(
          (v) => v.password === v.confirm_password,
          "Las contraseñas no coinciden.",
        )
        .parse(await readJson(req));
      const {
        data: { user },
        error: identityError,
      } = await client.auth.getUser();
      if (identityError || !user)
        throw new ApiError(
          401,
          "Abre un enlace de invitación o recuperación válido.",
        );
      const { data: profile } = await client
        .from("profiles")
        .select("active")
        .eq("id", user.id)
        .single();
      if (!profile?.active)
        throw new ApiError(
          403,
          "Cuenta sin acceso. Contacta con el administrador.",
        );
      const { error } = await client.auth.updateUser({
        password: input.password,
      });
      if (error)
        throw new ApiError(
          400,
          "No se pudo guardar la contraseña. Usa una nueva contraseña de al menos 12 caracteres o solicita otro enlace.",
        );
      await client.auth.signOut({ scope: "global" });
      return NextResponse.json({
        message: "Contraseña guardada. Inicia sesión con tu nueva contraseña.",
        redirect: "/login",
      });
    }
    if (action === "logout") {
      await client.auth.signOut();
      return NextResponse.json({ redirect: "/login" });
    }
    if (!["login", "register"].includes(action))
      throw new ApiError(404, "Ruta no encontrada.");
    const input = z
      .object({
        email: z.email().max(254),
        password: z.string().min(12).max(128),
        full_name: z.string().trim().min(1).max(150).optional(),
      })
      .strict()
      .parse(await readJson(req));
    const { data, error } =
      action === "register"
        ? await client.auth.signUp({
            email: input.email,
            password: input.password,
            options: {
              data: { full_name: input.full_name },
              emailRedirectTo: authEmailRedirect(),
            },
          })
        : await client.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });
    if (
      action === "register" &&
      (!error ||
        ["user_already_exists", "email_exists"].includes(error.code ?? ""))
    ) {
      // Auth puede ocultar duplicados devolviendo una identidad ficticia: no enumerar correos.
      if (data.session) await client.auth.signOut();
      return NextResponse.json({
        message: registrationMessage,
        redirect: "/login",
      });
    }
    if (error)
      throw new ApiError(
        400,
        action === "register"
          ? "No se pudo registrar la cuenta. Revisa los datos o intenta iniciar sesión."
          : "Correo o contraseña incorrectos.",
      );
    if (!data.session)
      return NextResponse.json({
        message: "Revisa tu correo para confirmar tu cuenta.",
        redirect: "/login",
      });
    const { data: p } = await client
      .from("profiles")
      .select("role,active")
      .eq("id", data.user!.id)
      .single();
    if (!p?.active) {
      await client.auth.signOut();
      throw new ApiError(403, "Cuenta sin acceso.");
    }
    await client.rpc("command", {
      op: "audit.access",
      payload: { id: data.user!.id, resource: "login" },
    });
    return NextResponse.json({ redirect: home[p.role as Role] });
  } catch (e) {
    return failure(e);
  }
}
