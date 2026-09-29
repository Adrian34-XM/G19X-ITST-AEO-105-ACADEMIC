/**
 * @file Análisis de postulaciones o evidencias desde identificadores autorizados. Reserva una
 * ejecución, valida la salida y persiste resultados; los errores no se sustituyen por evaluaciones
 * inventadas.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/**
 * Coordina análisis de reclutamiento y evidencias: valida rol y recurso, carga contexto autorizado, reutiliza resultados existentes y registra la solicitud. El proveedor genera el JSON; finish_ai persiste el resultado con permisos administrativos.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, ApiError, requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/server";
import { checkOrigin, databaseError, failure, readJson } from "@/lib/api";
import { generate, sanitize, type Attachment } from "@/lib/ai/provider";
import { authorizedAttachment } from "@/lib/ai/attachments";
import { recommendation, verification } from "@/lib/ai/schemas";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ useCase: string }> },
) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    const useCase = z
      .enum(["recruitment", "evidence"])
      .parse((await ctx.params).useCase);
    requireRole(
      profile.role,
      useCase === "recruitment" ? ["RH_ADMIN"] : ["RH_ADMIN", "JEFE"],
    );
    const { id } = z
      .object({ id: z.uuid() })
      .strict()
      .parse(await readJson(req));
    let context: unknown;
    let cached: unknown;
    let attachment: Attachment | undefined;
    async function attach(bucket: string, path: string) {
      attachment = await authorizedAttachment(client, bucket, path);
    }
    if (useCase === "recruitment") {
      const { data: a } = await client
        .from("applications")
        .select("candidate_id,vacancy_id,ai_result")
        .eq("id", id)
        .single();
      if (!a) throw new ApiError(404, "Postulación no encontrada.");
      const [{ data: c }, { data: v }] = await Promise.all([
        client
          .from("candidates")
          .select("skills,experience_years,cv_text,cv_path")
          .eq("id", a.candidate_id)
          .single(),
        client
          .from("vacancies")
          .select("title,requirements,skills,experience_required")
          .eq("id", a.vacancy_id)
          .single(),
      ]);
      if (!c || !v) throw new ApiError(404, "Contexto no disponible.");
      context = {
        vacancy: v,
        candidate: {
          skills: c.skills,
          experience_years: c.experience_years,
          cv_text: sanitize(c.cv_text),
        },
      };
      cached = a.ai_result;
      if (!cached && !c.cv_text.trim() && c.cv_path)
        await attach("cvs", c.cv_path);
    } else {
      const { data: e } = await client
        .from("task_evidence")
        .select("task_id,employee_id,evidence_text,ai_result,file_path")
        .eq("id", id)
        .single();
      if (!e) throw new ApiError(404, "Evidencia no encontrada.");
      const { data: allowed } = await client.rpc("manages_employee", {
        eid: e.employee_id,
      });
      if (!allowed)
        throw new ApiError(
          403,
          "No tienes permiso para revisar esta evidencia.",
        );
      const { data: t } = await client
        .from("tasks")
        .select("description,status")
        .eq("id", e.task_id)
        .single();
      if (!t || t.status !== "SUBMITTED")
        throw new ApiError(409, "La tarea debe estar enviada para revisión.");
      if (!e.ai_result && !e.evidence_text.trim())
        await attach("task-evidence", e.file_path);
      context = {
        task: { description: sanitize(t.description) },
        evidence: sanitize(e.evidence_text),
        writing_instructions:
          "Redacta reason en español natural como un comentario útil para quien revisa la tarea: explica qué muestra la evidencia, cómo se relaciona con lo solicitado y qué falta comprobar. Usa uno o dos párrafos breves, sin encabezados prefabricados, códigos técnicos ni repetir la conclusión. En observations incluye únicamente hallazgos concretos diferentes de reason. Distingue lo observado de lo que no puede comprobarse; no inventes contenido ni apruebes automáticamente la tarea. Si la evidencia es insuficiente dilo claramente. La decisión final corresponde al responsable humano.",
      };
      cached = e.ai_result;
    }
    if (cached) return NextResponse.json({ result: cached, cached: true });
    const admin = adminDb();
    const { data: request, error } = await client.rpc("command", {
      op: "ai.begin",
      payload: {
        id,
        use_case: useCase,
        provider: process.env.AI_PROVIDER || "ollama",
      },
    });
    if (error) databaseError(error);
    try {
      const { result, model } = await generate(
        context,
        useCase === "recruitment" ? recommendation : verification,
        attachment,
      );
      const { error: saveError } = await admin.rpc("finish_ai", {
        request: request.id,
        output: result,
        model_name: model,
        succeeded: true,
      });
      if (saveError) throw new Error("AI_SAVE_FAILED");
      return NextResponse.json({ result, cached: false });
    } catch (e) {
      await admin.rpc("finish_ai", {
        request: request.id,
        output: {},
        model_name: "",
        succeeded: false,
      });
      if (e instanceof ApiError) throw e;
      throw new ApiError(
        502,
        "No se pudo completar el análisis. Verifica el proveedor de IA e intenta de nuevo.",
      );
    }
  } catch (e) {
    return failure(e);
  }
}
