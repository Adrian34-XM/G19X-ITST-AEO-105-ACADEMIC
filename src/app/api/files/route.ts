/**
 * Gestiona documentos privados. POST valida propietario y archivo, sube a Storage y registra la asociación. GET comprueba acceso y entrega un enlace de descarga de 60 segundos. Storage y SQL son operaciones separadas: un fallo al asociar puede dejar un archivo sin referencia.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, ApiError } from "@/lib/auth";
import { inspectFile, maxFileSize } from "@/lib/storage/files";
import { checkOrigin, databaseError, failure } from "@/lib/api";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, user, profile } = await authenticate();
    if (Number(req.headers.get("content-length") ?? 0) > maxFileSize + 10000)
      throw new ApiError(413, "El archivo supera 5 MB.");
    const form = await req.formData();
    const bucket = z
      .enum(["cvs", "task-evidence", "onboarding-documents"])
      .parse(form.get("bucket"));
    const id = form.get("id") ? z.uuid().parse(form.get("id")) : undefined;
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ApiError(422, "Selecciona un archivo.");
    if (bucket === "cvs" && profile.role !== "CANDIDATO")
      throw new ApiError(403, "Solo candidatos pueden subir CV.");
    if (bucket !== "cvs") {
      if (!id) throw new ApiError(422, "Falta el recurso.");
      const { data: record } = await client
        .from(bucket === "task-evidence" ? "tasks" : "onboarding")
        .select("employee_id")
        .eq("id", id)
        .single();
      if (!record) throw new ApiError(404, "Recurso no encontrado.");
      const { data: own } = await client.rpc("owns_employee", {
        eid: record.employee_id,
      });
      if (!own)
        throw new ApiError(403, "No puedes adjuntar archivos a este recurso.");
    }
    const { bytes, ext, text } = await inspectFile(file, bucket);
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await client.storage
      .from(bucket)
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploadError)
      throw new ApiError(502, "No se pudo subir el archivo. Intenta de nuevo.");
    const { data, error } = await client.rpc("command", {
      op: "file.attach",
      payload: { id, bucket, path, text },
    });
    if (error) databaseError(error);
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: Request) {
  try {
    const { client } = await authenticate();
    const url = new URL(req.url);
    const kind = z
      .enum(["cvs", "task-evidence", "onboarding-documents"])
      .parse(url.searchParams.get("bucket"));
    const id = z.uuid().parse(url.searchParams.get("id"));
    const table =
      kind === "cvs"
        ? "candidates"
        : kind === "task-evidence"
          ? "task_evidence"
          : "onboarding_documents";
    const field = kind === "cvs" ? "cv_path" : "file_path";
    const { data, error } = await client
      .from(table)
      .select()
      .eq("id", id)
      .single();
    if (error || !data?.[field])
      throw new ApiError(404, "Archivo no encontrado.");
    const { data: signed, error: signError } = await client.storage
      .from(kind)
      .createSignedUrl(data[field], 60, { download: true });
    if (signError) throw new ApiError(403, "No tienes acceso al archivo.");
    const { error: auditError } = await client.rpc("command", {
      op: "audit.access",
      payload: { id, resource: table },
    });
    if (auditError) databaseError(auditError);
    const publicUrl = new URL(signed.signedUrl);
    const publicOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    publicUrl.protocol = publicOrigin.protocol;
    publicUrl.host = publicOrigin.host;
    return NextResponse.json(
      { url: publicUrl.toString(), expires_in: 60 },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
