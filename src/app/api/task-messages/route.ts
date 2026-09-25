import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, requireRole, ApiError } from "@/lib/auth";
import { checkOrigin, readJson, failure, databaseError } from "@/lib/api";
function chatError(error: { code?: string; message: string }) {
  if (["42P01", "PGRST205", "PGRST202"].includes(error.code ?? ""))
    throw new ApiError(
      503,
      "Activa supabase/activar-mejoras-rh.sql para habilitar las conversaciones de tareas.",
    );
  if (error.message === "TASK_CHAT_CLOSED")
    throw new ApiError(
      409,
      "La tarea está aprobada. Su conversación se conserva en modo de consulta.",
    );
  if (error.message === "MESSAGE_CONFLICT")
    throw new ApiError(
      409,
      "No se pudo confirmar este mensaje. Cierra y vuelve a abrir la conversación.",
    );
  databaseError(error);
}
export async function GET(req: Request) {
  try {
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["RH_ADMIN", "JEFE", "EMPLEADO"]);
    const params = new URL(req.url).searchParams;
    const task = z.uuid().parse(params.get("task"));
    const before = params.has("before")
      ? z.coerce
          .number()
          .int()
          .positive()
          .max(Number.MAX_SAFE_INTEGER)
          .parse(params.get("before"))
      : null;
    const { data: record, error: taskError } = await client
      .from("tasks")
      .select("id,status")
      .eq("id", task)
      .maybeSingle();
    if (taskError) databaseError(taskError);
    if (!record) throw new ApiError(404, "Tarea no disponible.");
    let query = client
      .from("task_messages")
      .select("id,sequence,author_id,author_name,author_role,body,created_at")
      .eq("task_id", task)
      .order("sequence", { ascending: false })
      .limit(51);
    if (before) query = query.lt("sequence", before);
    const { data, error } = await query;
    if (error) chatError(error);
    const page = (data ?? []).slice(0, 50);
    return NextResponse.json(
      {
        messages: page.reverse(),
        hasMore: (data ?? []).length > 50,
        closed: record.status === "APPROVED",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["RH_ADMIN", "JEFE", "EMPLEADO"]);
    const input = z
      .object({
        task: z.uuid(),
        message: z.string().trim().min(1).max(3000),
        message_id: z.uuid(),
      })
      .strict()
      .parse(await readJson(req));
    const { data, error } = await client.rpc("send_task_message", input);
    if (error) chatError(error);
    return NextResponse.json({ id: data });
  } catch (e) {
    return failure(e);
  }
}
