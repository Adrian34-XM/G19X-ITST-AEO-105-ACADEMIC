/** Instrucciones y contexto del orquestador; recibe datos previamente autorizados.
 * @see docs/CODIGO.md y docs/MAPA_CODIGO.md.
 */
import { z } from "zod";
export const areaSchema = z.enum([
  "overview",
  "courses",
  "tasks",
  "performance",
  "analytics",
]);
export const outputSchema = z
  .object({
    summary: z.string().min(1).max(12000),
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
              "audit_logs",
              "climate_surveys",
            ]),
            resource_id: z.string().nullable(),
            employee_id: z.string().nullable(),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();
