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
import { recruitmentContext } from "@/lib/ai/recruitment-context";
import {
  recommendation,
  evidenceOpinion,
  recruitmentOpinion,
} from "@/lib/ai/schemas";
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
    let attachment: Attachment | undefined;
    let declaredStrengths: string[] = [];
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
      declaredStrengths = (v.skills ?? [])
        .filter((skill: string) =>
          (c.skills ?? []).some(
            (declared: string) =>
              declared.trim().toLocaleLowerCase("es") ===
              skill.trim().toLocaleLowerCase("es"),
          ),
        )
        .map(
          (skill: string) =>
            `El perfil declara ${skill}, una habilidad solicitada por la vacante; requiere comprobación humana.`,
        );
      if (
        !c.cv_text?.trim() &&
        !c.cv_path &&
        !c.skills?.length &&
        !Number(c.experience_years)
      )
        throw new ApiError(
          422,
          "No hay información profesional suficiente para evaluar esta postulación. Añade el CV o datos profesionales antes de analizarla.",
        );
      context = recruitmentContext(c, v);
      if (!c.cv_text.trim() && c.cv_path) await attach("cvs", c.cv_path);
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
      if (!e.evidence_text.trim()) await attach("task-evidence", e.file_path);
      context = {
        task: { description: sanitize(t.description) },
        evidence: sanitize(e.evidence_text),
        evidence_text_truncated: e.evidence_text.length > 14000,
        writing_instructions:
          "Compara únicamente la evidencia recibida con task.description. status es una recomendación, nunca el estado real de la tarea. confidence es tu confianza estimada en esa recomendación, no una medición laboral. Si el archivo no corresponde a lo solicitado, usa NEEDS_REVIEW y explica brevemente qué documento recibiste y qué falta para comprobar la tarea. Una descripción de habilidades o experiencia no acredita por sí sola la ejecución de la actividad. No concluyas que la persona no hizo la tarea: solo que este archivo no lo acredita. Redacta reason en 2 a 4 frases naturales; observations puede ser vacío. No inventes requisitos que no aparecen en task.description. No apruebes automáticamente; la decisión corresponde al responsable humano.",
      };
    }
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
      const answer = await generate(
        context,
        useCase === "recruitment" ? recruitmentOpinion : evidenceOpinion,
        attachment,
        "professional-evidence",
        true,
      );
      const model = answer.model;
      const scored =
        useCase === "recruitment"
          ? recommendation.parse({
              ...recruitmentOpinion.parse(answer.result),
              strengths: declaredStrengths,
              gaps: [],
            })
          : null;
      const result = scored
        ? {
            ...scored,
            match_level:
              scored.score >= 70
                ? "HIGH"
                : scored.score >= 40
                  ? "MEDIUM"
                  : "LOW",
          }
        : answer.result;
      const { error: saveError } = await admin.rpc("finish_ai", {
        request: request.id,
        output: result,
        model_name: model,
        succeeded: true,
      });
      if (saveError) {
        console.error("ai_save_failed", { code: saveError.code });
        throw new Error("AI_SAVE_FAILED");
      }
      return NextResponse.json({ result, cached: false });
    } catch (e) {
      console.error("ai_analysis_failed", {
        type: e instanceof Error ? e.name : "Unknown",
        reason:
          e instanceof Error &&
          /^(AI_[A-Z_]+|PROVIDER_FAILED|VISION_NOT_CONFIGURED)$/.test(e.message)
            ? e.message
            : "GENERATION_OR_VALIDATION",
      });
      if (e instanceof z.ZodError)
        console.error("ai_contract_failed", {
          fields: e.issues.map((issue) => ({
            path: issue.path.join("."),
            code: issue.code,
          })),
        });
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
