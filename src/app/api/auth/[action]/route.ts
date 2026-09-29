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
export async function POST(
  req: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(req);
    const client = await db();
    const { action } = await ctx.params;
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
            options: { data: { full_name: input.full_name } },
          })
        : await client.auth.signInWithPassword({
            email: input.email,
            password: input.password,
          });
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
