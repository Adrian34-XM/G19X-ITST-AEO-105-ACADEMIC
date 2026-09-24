/** Referencias privadas de vacantes, accesibles únicamente a RH y superadministración. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireRole, ApiError } from "@/lib/auth";
import { checkOrigin, failure, databaseError } from "@/lib/api";
import { inspectFile, maxFileSize } from "@/lib/storage/files";
export async function GET(req: Request) {
  try {
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["RH_ADMIN"]);
    const query = new URL(req.url).searchParams;
    const vacancy = z.uuid().parse(query.get("vacancy"));
    const id = query.get("id");
    if (id) {
      z.uuid().parse(id);
      const { data, error } = await client
        .from("vacancy_documents")
        .select("file_path")
        .eq("id", id)
        .eq("vacancy_id", vacancy)
        .single();
      if (error || !data) throw new ApiError(404, "Documento no encontrado.");
      const { data: signed, error: sign } = await client.storage
        .from("vacancy-documents")
        .createSignedUrl(data.file_path, 60, { download: true });
      if (sign || !signed)
        throw new ApiError(502, "No se pudo abrir el documento.");
      return NextResponse.json(
        { url: signed.signedUrl },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const { data, error } = await client
      .from("vacancy_documents")
      .select("id,filename,created_at")
      .eq("vacancy_id", vacancy)
      .order("created_at", { ascending: false });
    if (error)
      throw new ApiError(
        503,
        "Aplica la migración de operaciones RH para habilitar los adjuntos de vacantes.",
      );
    return NextResponse.json(
      { documents: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile, user } = await authenticate();
    requireRole(profile.role, ["RH_ADMIN"]);
    if (Number(req.headers.get("content-length") ?? 0) > maxFileSize + 10000)
      throw new ApiError(413, "El archivo supera 5 MB.");
    const form = await req.formData();
    const vacancy = z.uuid().parse(form.get("vacancy"));
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ApiError(422, "Selecciona un documento.");
    const { data } = await client
      .from("vacancies")
      .select("id")
      .eq("id", vacancy)
      .single();
    if (!data) throw new ApiError(404, "Vacante no encontrada.");
    const { bytes, ext } = await inspectFile(file, "cvs");
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upload } = await client.storage
      .from("vacancy-documents")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (upload)
      throw new ApiError(
        502,
        "No se pudo adjuntar el documento. Comprueba que se aplicó la migración de operaciones RH.",
      );
    const { error } = await client.rpc("attach_vacancy_document", {
      vacancy,
      path,
      filename: file.name.slice(0, 200),
    });
    if (error) {
      await client.storage.from("vacancy-documents").remove([path]);
      databaseError(error);
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
