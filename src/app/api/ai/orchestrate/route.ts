/**
 * @file Coordina resúmenes y recomendaciones por módulo con contexto autorizado y minimizado.
 * Reutiliza resultados cuando procede y registra ejecuciones; las recomendaciones no ejecutan
 * cambios de negocio.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
/** Orquestación por rol: contexto mínimo con RLS, reserva persistente y recomendaciones sin acciones automáticas. */
import { buildOrchestrationRequest } from "@/lib/ai/orchestration/request";
import { areaSchema, outputSchema } from "@/lib/ai/orchestration/contracts";
import {
  performanceAdvice,
  performanceSteps,
} from "@/lib/ai/orchestration/performance";
import { promptSchema } from "@/lib/ai/orchestration/draft";
import { taskWritingStyle } from "@/lib/ai/orchestration/tasks";
import { onboardingWritingStyle } from "@/lib/ai/orchestration/onboarding";
import { rolePermissionsInstruction } from "@/lib/ai/orchestration/shared";
import { analyticsNarrativeInput } from "@/lib/ai/orchestration/analytics";
import { NextResponse } from "next/server";
import { activityContext } from "@/modules/workspace/activity-context";
import {
  requireModuleTopic,
  moduleTopicInstruction,
} from "@/lib/ai/module-scope";
import { createHash } from "node:crypto";
import {
  overviewContext,
  readableOverview,
} from "@/modules/workspace/overview";
import { z } from "zod";
import { authenticate, ApiError } from "@/lib/auth";
import { checkOrigin, readJson, failure, databaseError } from "@/lib/api";
import { adminDb } from "@/lib/supabase/server";
import { snapshot } from "@/modules/workspace/queries";
import { currentWeek } from "@/modules/workspace/current-week";
import { insightContext } from "@/modules/workspace/insights";
import { generate } from "@/lib/ai/provider";
import {
  overviewScopeViolation,
  compactOverview,
} from "@/lib/ai/overview-summary";
import { isHR } from "@/lib/permissions";
import { scopeData } from "@/modules/workspace/insights";
import { filterWorkspace } from "@/modules/workspace/filters";
import {
  analyticsSelection,
  analyticsSummary,
  analyticsFacts,
  requestedAnalytics,
  analyticsNarrativeSchema,
} from "@/modules/workspace/analytics-summary";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client, profile } = await authenticate();
    if (profile.role === "CANDIDATO")
      throw new ApiError(403, "Los análisis de IA son de uso interno.");
    const { area, filters, mode, prompt, force, automatic } = z
      .object({
        area: areaSchema,
        filters: z
          .object({
            module: z
              .enum([
                "overview",
                "courses",
                "tasks",
                "onboarding",
                "performance",
                "analytics",
              ])
              .optional(),
            state: z.string().max(40).optional(),
            priority: z.enum(["", "HIGH", "MEDIUM", "LOW"]).optional(),
            from: z.union([z.iso.date(), z.literal("")]).optional(),
            to: z.union([z.iso.date(), z.literal("")]).optional(),
            position: z.union([z.uuid(), z.literal("")]).optional(),
            role: z.string().max(30).optional(),
            required: z.enum(["", "true", "false"]).optional(),
            overdue: z.enum(["", "yes", "no"]).optional(),
            query: z.string().max(200).optional(),
            department: z.union([z.uuid(), z.literal("")]).optional(),
            employee: z.union([z.uuid(), z.literal("")]).optional(),
            employees: z.array(z.uuid()).max(1000).optional(),
            days: z.enum(["all", "7", "30", "90"]).optional(),
            process: z
              .enum(["all", "tasks", "courses", "applications"])
              .optional(),
          })
          .strict()
          .default({}),
        mode: z.enum(["analyze", "prompt"]).default("analyze"),
        prompt: z.string().trim().max(8000).default(""),
        force: z.boolean().default(false),
        automatic: z.boolean().default(false),
      })
      .strict()
      .parse(await readJson(req));
    if (
      area !== "overview" &&
      (!["SUPERUSER", "RH_ADMIN", "JEFE", "EMPLEADO"].includes(profile.role) ||
        (area === "analytics" && !isHR(profile.role)))
    )
      throw new ApiError(403, "No tienes acceso a este análisis.");
    if (filters.module && filters.module !== area)
      throw new ApiError(422, "El filtro no corresponde a este módulo.");
    requireModuleTopic(area, prompt);
    const week = area === "overview" ? currentWeek() : undefined;
    const authorized = scopeData(await snapshot(client, week), profile);
    let climateAvailable = false;
    if (area === "overview") {
      const { data: surveys, error: surveyError } = await client
        .from("climate_surveys")
        .select("id,status,created_at")
        .gte("created_at", week!.start)
        .lt("created_at", week!.end)
        .limit(200);
      climateAvailable = !surveyError;
      if (!surveyError) authorized.climate_surveys = surveys ?? [];
    }
    if (
      filters.employees?.some(
        (id) => !(authorized.employees ?? []).some((e) => e.id === id),
      )
    )
      throw new ApiError(
        403,
        "No tienes acceso a alguna de las personas seleccionadas.",
      );
    if (
      filters.employee &&
      !(authorized.employees ?? []).some((e) => e.id === filters.employee)
    )
      throw new ApiError(403, "No tienes acceso a esta persona.");
    if (
      filters.department &&
      !(authorized.departments ?? []).some((d) => d.id === filters.department)
    )
      throw new ApiError(403, "No tienes acceso a esta área.");
    if (area === "performance" && isHR(profile.role)) {
      const normalize = (text: string) =>
        text
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
      const request = " " + normalize(prompt).replace(/[^a-z0-9 ]/g, " ") + " ";
      const mentioned = (authorized.departments ?? []).filter((department) =>
        request.includes(" " + normalize(String(department.name)) + " "),
      );
      if (mentioned.length === 1) {
        if (filters.department && filters.department !== mentioned[0].id)
          throw new ApiError(
            422,
            "El área del prompt no coincide con el filtro seleccionado.",
          );
        filters.department = mentioned[0].id;
      }
    }
    const selected = filterWorkspace(authorized, filters);
    if (filters.employee && !(selected.employees ?? []).length)
      throw new ApiError(422, "La persona no pertenece al área seleccionada.");
    const context =
      area === "overview"
        ? overviewContext(
            authorized,
            profile,
            new Date().toISOString().slice(0, 10),
          )
        : insightContext(
            authorized,
            profile,
            area,
            new Date().toISOString().slice(0, 10),
            filters,
          );
    if (week) Object.assign(context, { period: week });
    // Desempeño y analíticas usan indicadores estructurados, no nombres ni texto privado.
    if (["performance", "analytics"].includes(area)) {
      const safeFields = new Set([
        "id",
        "employee_id",
        "position_id",
        "department_id",
        "course_id",
        "vacancy_id",
        "status",
        "due_date",
        "hire_date",
        "progress",
        "created_at",
        "scheduled_at",
        "applied_at",
      ]);
      for (const table of Object.keys(context.data))
        context.data[table] = context.data[table].map((row) =>
          Object.fromEntries(
            Object.entries(row).filter(([key]) => safeFields.has(key)),
          ),
        );
    }
    if (!(area === "overview" && profile.role === "EMPLEADO")) {
      // Usar el alcance filtrado, nunca el snapshot original ni datos suministrados por el navegador.
      const activityData = area === "overview" ? authorized : selected;
      const activityTables =
        area === "tasks"
          ? ["tasks"]
          : area === "onboarding"
            ? ["onboarding_items"]
            : area === "courses"
              ? ["course_assignments"]
              : undefined;
      Object.assign(context, {
        verified_activity_context: activityContext(
          activityData,
          false,
          undefined,
          activityTables,
        ),
      });
    }
    Object.assign(context, { module_scope: moduleTopicInstruction(area) });
    if (area === "tasks")
      Object.assign(context, {
        writing_style: taskWritingStyle,
      });
    if (area === "onboarding")
      Object.assign(context, {
        writing_style: onboardingWritingStyle,
      });
    if (area === "tasks" || area === "onboarding")
      Object.assign(context, {
        role_permissions: rolePermissionsInstruction(area, profile.role),
      });
    const admin = adminDb();
    if (area === "overview") {
      const { data: unread, error: unreadError } = await client.rpc(
        "unread_task_messages",
      );
      Object.assign(context, {
        task_messages_available: !unreadError,
        unread_task_messages: unreadError ? null : unread,
      });
    }
    if (area === "overview")
      Object.assign(context, { climate_available: climateAvailable });
    // Reutiliza solo un resumen de este usuario, rol y contexto autorizado exacto.
    const fingerprint =
      area === "overview" && mode === "analyze"
        ? createHash("sha256")
            .update(JSON.stringify({ context, prompt, filters, version: 18 }))
            .digest("hex")
        : null;
    if (fingerprint && !force) {
      const { data: cached, error: cacheError } = await client
        .from("orchestration_runs")
        .select("result,model,created_at")
        .eq("user_id", profile.id)
        .eq("area", "overview")
        .eq("status", "COMPLETED")
        .order("created_at", { ascending: false })
        .limit(10);
      if (cacheError)
        throw new ApiError(
          503,
          "No se pudo consultar el orquestador. Comprueba la migración de orquestación en Supabase.",
        );
      for (const record of cached ?? []) {
        if (record.result?.fingerprint !== fingerprint) continue;
        const parsedCache = outputSchema.safeParse(record.result.advice);
        if (parsedCache.success)
          return NextResponse.json(
            {
              result: {
                ...parsedCache.data,
                summary: readableOverview(
                  parsedCache.data.summary,
                  context.data,
                ),
                recommendations: parsedCache.data.recommendations.map((r) => ({
                  ...r,
                  title: readableOverview(r.title, context.data),
                  reason: readableOverview(r.reason, context.data),
                })),
              },
              model: record.model,
              generated_at: record.created_at,
              cached: true,
            },
            { headers: { "Cache-Control": "no-store" } },
          );
      }
    }
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
      const performanceAnalysis = area === "performance" && mode === "analyze";
      const operationalSummary =
        automatic &&
        mode === "analyze" &&
        ["tasks", "onboarding", "courses"].includes(area);
      const operationalMetrics = operationalSummary
        ? analyticsFacts(
            selected,
            [
              area === "tasks"
                ? "tasks"
                : area === "onboarding"
                  ? "onboarding"
                  : "course_assignments",
            ],
            "status",
          )
        : null;
      const generation = buildOrchestrationRequest({
        area,
        mode,
        prompt,
        profile,
        authorized,
        selected,
        context,
        filters,
        week,
        operationalMetrics,
      });
      const { result, model } = await generate(
        generation.input,
        generation.schema,
        undefined,
        generation.purpose,
        generation.repairOnce,
      );
      if (mode === "prompt") {
        const suggestion = promptSchema.parse(result);
        const { error: save } = await admin
          .from("orchestration_runs")
          .update({ status: "COMPLETED", result: { kind: "prompt" }, model })
          .eq("id", id)
          .eq("user_id", profile.id);
        if (save) throw new Error("SAVE_FAILED");
        return NextResponse.json(suggestion, {
          headers: { "Cache-Control": "no-store" },
        });
      }
      const analyticsRequest =
        area === "analytics"
          ? requestedAnalytics(prompt, analyticsSelection.parse(result))
          : null;
      const parsed =
        area === "analytics"
          ? outputSchema.parse(
              analyticsSummary(
                selected,
                analyticsRequest!.topics,
                analyticsRequest!.breakdown,
              ),
            )
          : outputSchema.parse(
              area === "overview" || operationalSummary
                ? {
                    summary: (result as { summary: string }).summary,
                    recommendations: [],
                  }
                : performanceAnalysis
                  ? {
                      summary:
                        "Los estados de actividades no permiten determinar deficiencias de desempeño ni sus causas. " +
                        (result as z.infer<typeof performanceAdvice>).summary,
                      recommendations: (
                        result as z.infer<typeof performanceAdvice>
                      ).recommendations.map((step) => ({
                        title: "Próximo paso sugerido",
                        reason: performanceSteps[step],
                        priority: "MEDIUM",
                        resource_type: "tasks",
                        resource_id: null,
                        employee_id: null,
                      })),
                    }
                  : result,
            );
      const verifiedMetrics =
        operationalMetrics ??
        (analyticsRequest
          ? analyticsFacts(
              selected,
              analyticsRequest.topics,
              analyticsRequest.breakdown,
            )
          : performanceAnalysis
            ? analyticsFacts(
                selected,
                ["tasks", "course_assignments", "onboarding"],
                "status",
              )
            : undefined);
      if (area === "analytics") {
        const narrative = await generate(
          analyticsNarrativeInput(prompt, verifiedMetrics!),
          analyticsNarrativeSchema,
          undefined,
          "analytics",
          true,
        );
        parsed.summary = (narrative.result as { summary: string }).summary;
      }
      if (area === "overview") {
        if (
          overviewScopeViolation(
            context as ReturnType<typeof overviewContext>,
            parsed.summary,
          )
        )
          throw new ApiError(
            422,
            "La IA incluyó información fuera de tu alcance. No se guardó ese resumen. Intenta actualizarlo de nuevo.",
          );
        parsed.summary = compactOverview(
          readableOverview(parsed.summary, context.data),
        );
        parsed.recommendations = parsed.recommendations.map((r) => ({
          ...r,
          title: readableOverview(r.title, context.data),
          reason: readableOverview(r.reason, context.data),
        }));
      }
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
        .update({
          status: "COMPLETED",
          result: fingerprint ? { fingerprint, advice: parsed } : parsed,
          model,
        })
        .eq("id", id)
        .eq("user_id", profile.id);
      if (save) throw new Error("SAVE_FAILED");
      return NextResponse.json(
        {
          result: parsed,
          metrics: verifiedMetrics,
          model,
          generated_at: new Date().toISOString(),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (e) {
      await admin
        .from("orchestration_runs")
        .update({ status: "FAILED" })
        .eq("id", id)
        .eq("user_id", profile.id);
      if (e instanceof ApiError) throw e;
      if (e instanceof Error && ["TimeoutError", "AbortError"].includes(e.name))
        throw new ApiError(
          504,
          "La IA tardó demasiado en preparar el resumen. Espera a que el modelo termine de cargar y vuelve a intentarlo.",
        );
      throw new ApiError(
        502,
        "No se pudo completar el análisis. Revisa la disponibilidad del proveedor; las alertas de la plataforma siguen disponibles.",
      );
    }
  } catch (e) {
    return failure(e);
  }
}
