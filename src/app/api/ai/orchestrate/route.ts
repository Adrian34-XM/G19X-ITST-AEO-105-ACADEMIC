/** Orquestación por rol: contexto mínimo con RLS, reserva persistente y recomendaciones sin acciones automáticas. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, ApiError } from "@/lib/auth";
import { checkOrigin, readJson, failure, databaseError } from "@/lib/api";
import { adminDb } from "@/lib/supabase/server";
import { snapshot } from "@/modules/workspace/queries";
import { insightContext } from "@/modules/workspace/insights";
import { generate } from "@/lib/ai/provider";
const areaSchema = z.enum([
  "overview",
  "courses",
  "tasks",
  "performance",
  "analytics",
]);
const outputSchema = z
  .object({
    summary: z.string().min(1).max(3000),
    recommendations: z
      .array(
        z
          .object({
            title: z.string().max(160),
            reason: z.string().max(1500),
            priority: z.enum(["HIGH", "MEDIUM", "LOW"]),
            resource_type: z.enum([
              "tasks",
              "courses",
              "employees",
              "vacancies",
              "applications",
              "interviews",
              "onboarding",
              "profiles",
              "departments",
              "positions",
            ]),
            resource_id: z.string().nullable(),
            employee_id: z.string().nullable(),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    const { area } = z
      .object({ area: areaSchema })
      .strict()
      .parse(await readJson(req));
    if (
      area !== "overview" &&
      (!["RH_ADMIN", "JEFE", "EMPLEADO"].includes(profile.role) ||
        (area === "analytics" && profile.role !== "RH_ADMIN"))
    )
      throw new ApiError(403, "No tienes acceso a este análisis.");
    const context = insightContext(
      await snapshot(client),
      profile,
      area,
      new Date().toISOString().slice(0, 10),
    );
    const admin = adminDb();
    const { data: id, error } = await client.rpc("begin_orchestration", {
      section: area,
    });
    if (error) {
      if (error.code === "PGRST202")
        throw new ApiError(
          503,
          "Aplica la migración de orquestación y auditoría en Supabase.",
        );
      databaseError(error);
    }
    try {
      const { result, model } = await generate(
        {
          ...context,
          instructions:
            "Sugiere próximos pasos útiles para este rol. Para capacitación compara el puesto y área de cada empleado con el catálogo de cursos disponible y su progreso. Usa solo identificadores presentes; usa null si no corresponde. No asignes cursos ni cambies estados. No evalúes atributos protegidos ni tomes decisiones laborales. Distingue falta de datos de bajo desempeño.",
        },
        outputSchema,
      );
      const parsed = outputSchema.parse(result);
      // Evita vínculos inventados o referencias a personas fuera del alcance autorizado.
      parsed.recommendations = parsed.recommendations.map((r) => ({
        ...r,
        resource_id:
          r.resource_id &&
          (context.data[r.resource_type] ?? []).some(
            (row) => row.id === r.resource_id,
          )
            ? r.resource_id
            : null,
        employee_id:
          r.employee_id &&
          (context.data.employees ?? []).some((row) => row.id === r.employee_id)
            ? r.employee_id
            : null,
      }));
      const { error: save } = await admin
        .from("orchestration_runs")
        .update({ status: "COMPLETED", result: parsed, model })
        .eq("id", id)
        .eq("user_id", profile.id);
      if (save) throw new Error("SAVE_FAILED");
      return NextResponse.json(
        { result: parsed, model, generated_at: new Date().toISOString() },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      await admin
        .from("orchestration_runs")
        .update({ status: "FAILED" })
        .eq("id", id)
        .eq("user_id", profile.id);
      throw new ApiError(
        502,
        "No se pudo completar el análisis. Revisa la disponibilidad del proveedor; las alertas de la plataforma siguen disponibles.",
      );
    }
  } catch (e) {
    return failure(e);
  }
}
