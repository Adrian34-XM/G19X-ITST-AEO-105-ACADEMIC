/** Fotos privadas con autorización por perfil; nunca acepta URLs ni el propietario desde el formulario. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, ApiError } from "@/lib/auth";
import { checkOrigin, readFormData, failure, databaseError } from "@/lib/api";
import {
  normalizeProfilePhoto,
  maxPhotoSize,
} from "@/lib/storage/profile-photo";
const bucket = "profile-photos";
const migrationMessage =
  "Activa supabase/migrations/202610060001_profile_photos.sql en Supabase para guardar fotos de perfil.";
async function ownSchema(
  client: Awaited<ReturnType<typeof authenticate>>["client"],
  id: string,
) {
  const { error } = await client
    .from("profiles")
    .select("photo_path")
    .eq("id", id)
    .single();
  if (error) throw new ApiError(503, migrationMessage);
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, user } = await authenticate();
    if (Number(req.headers.get("content-length") ?? 0) > maxPhotoSize + 10000)
      throw new ApiError(413, "La foto supera 2 MB.");
    await ownSchema(client, user.id);
    const form = await readFormData(req);
    if (form.get("id") || form.get("profile_id"))
      throw new ApiError(422, "Solo puedes cambiar tu propia foto.");
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ApiError(422, "Selecciona una foto.");
    const image = await normalizeProfilePhoto(file);
    const path = `${user.id}/${crypto.randomUUID()}.png`;
    const storage = client.storage.from(bucket);
    const { error: uploadError } = await storage.upload(path, image, {
      contentType: "image/png",
      upsert: false,
    });
    if (uploadError)
      throw new ApiError(
        502,
        "No se pudo guardar la foto. Revisa que la migración esté activa e intenta de nuevo.",
      );
    const { data, error } = await client.rpc("set_profile_photo", { path });
    if (error) {
      await storage.remove([path]);
      if (error.code === "PGRST202") throw new ApiError(503, migrationMessage);
      databaseError(error);
    }
    if (data.previous_path && data.previous_path !== path)
      await storage.remove([data.previous_path]);
    return NextResponse.json(
      { photo_path: path },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    const { client, user } = await authenticate();
    await ownSchema(client, user.id);
    const { data, error } = await client.rpc("set_profile_photo", {
      path: null,
    });
    if (error) databaseError(error);
    if (data.previous_path)
      await client.storage.from(bucket).remove([data.previous_path]);
    return NextResponse.json(
      { photo_path: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function GET(req: Request) {
  try {
    const { client } = await authenticate();
    const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
    // RLS de profiles decide quién puede ver esta persona (propio, RH o equipo autorizado).
    const { data: person, error } = await client
      .from("profiles")
      .select("photo_path")
      .eq("id", id)
      .single();
    if (error || !person?.photo_path)
      throw new ApiError(404, "Foto no disponible.");
    const { data, error: downloadError } = await client.storage
      .from(bucket)
      .download(person.photo_path);
    if (downloadError || !data) throw new ApiError(404, "Foto no disponible.");
    return new Response(await data.arrayBuffer(), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return failure(error);
  }
}
