/**
 * @file Materiales, evaluación e intentos de incorporación. Solo responsables autorizados
 * configuran contenido; las respuestas se califican en SQL y el colaborador no recibe la clave de
 * respuestas correctas.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireRole, ApiError } from "@/lib/auth";
import {
  readFormData,
  checkOrigin,
  failure,
  databaseError,
  readJson,
} from "@/lib/api";
import { adminDb } from "@/lib/supabase/server";
import { inspectFile } from "@/lib/storage/files";
const question = z
  .object({
    question: z.string().trim().min(3).max(400),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
    correct: z.number().int().min(0),
  })
  .refine((q) => q.correct < q.options.length);
export async function GET(req: Request) {
  try {
    const { client } = await authenticate();
    const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
    const { data, error } = await client.rpc("onboarding_learning_command", {
      op: "read",
      payload: { id },
    });
    if (error) databaseError(error);
    if (!data.material_path) return NextResponse.json(data);
    const { data: link, error: sign } = await adminDb()
      .storage.from("onboarding-learning")
      .createSignedUrl(data.material_path, 60);
    if (sign) throw new ApiError(502, "No se pudo abrir el documento.");
    const { material_path: _path, ...safe } = data;
    void _path;
    return NextResponse.json(
      { ...safe, url: link.signedUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, user, profile } = await authenticate();
    if (req.headers.get("content-type")?.includes("application/json")) {
      const payload = z
        .object({
          id: z.uuid(),
          answers: z.array(z.number().int().min(0).max(5)).min(1).max(20),
        })
        .strict()
        .parse(await readJson(req));
      const { data, error } = await client.rpc("onboarding_learning_command", {
        op: "attempt",
        payload,
      });
      if (error) databaseError(error);
      return NextResponse.json(data);
    }
    requireRole(profile.role, ["RH_ADMIN", "JEFE"]);
    const form = await readFormData(req);
    const id = z.uuid().parse(form.get("id"));
    const { error: access } = await client.rpc("onboarding_learning_command", {
      op: "read",
      payload: { id },
    });
    if (access) databaseError(access);
    const config = z
      .object({
        instructions: z.string().trim().min(1).max(2000),
        minimum: z.coerce.number().int().min(1).max(100),
        questions: z.array(question).max(20),
      })
      .parse({
        instructions: form.get("instructions"),
        minimum: form.get("minimum"),
        questions: JSON.parse(String(form.get("questions"))),
      });
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ApiError(422, "Adjunta el documento de lectura.");
    const { bytes, ext } = await inspectFile(file, "onboarding-documents");
    const admin = adminDb();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upload } = await admin.storage
      .from("onboarding-learning")
      .upload(path, bytes, { contentType: file.type });
    if (upload)
      throw new ApiError(
        503,
        "Aplica la migración de evaluaciones de incorporación y vuelve a intentar.",
      );
    const { data, error } = await client.rpc("onboarding_learning_command", {
      op: "save",
      payload: { id, ...config, material_path: path },
    });
    if (error) {
      await admin.storage.from("onboarding-learning").remove([path]);
      databaseError(error);
    }
    return NextResponse.json(data);
  } catch (e) {
    return failure(e);
  }
}
