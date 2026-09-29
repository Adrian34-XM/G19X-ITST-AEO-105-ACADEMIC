/**
 * @file Contratos de planes, actividades y operaciones de incorporación. Distingue responsables del
 * empleado, jefe y RH, requisitos de documentos y revisión; una propuesta de IA debe cumplir el
 * mismo contrato.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { z } from "zod";
export const stepSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().max(2000),
    owner_role: z.enum(["EMPLOYEE", "MANAGER", "HR"]),
    days: z.number().int().min(0).max(365),
    requires_document: z.boolean(),
  })
  .strict();
export const planSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    steps: z.array(stepSchema).min(1).max(30),
  })
  .strict();
export type Plan = z.infer<typeof planSchema>;
const id = z.uuid();
export const onboardingInput = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("plan.start"),
    payload: z.object({ employee_id: id }).strict(),
  }),
  z.object({
    op: z.literal("item.review"),
    payload: z
      .object({
        id,
        status: z.enum(["COMPLETED", "IN_PROGRESS"]),
        comments: z.string().trim().min(1).max(2000),
      })
      .strict(),
  }),
  z.object({
    op: z.literal("template.save"),
    payload: planSchema.extend({
      position_id: id.nullable(),
      department_id: id.nullable(),
    }),
  }),
  z.object({
    op: z.literal("template.disable"),
    payload: z.object({ id }).strict(),
  }),
  z.object({
    op: z.literal("plan.apply"),
    payload: z
      .object({
        id,
        template_id: id.optional(),
        steps: z.array(stepSchema).min(1).max(30).optional(),
        start_date: z.iso.date(),
      })
      .strict()
      .refine(
        (p) => Boolean(p.template_id) !== Boolean(p.steps),
        "Selecciona una plantilla o un plan revisado.",
      ),
  }),
  z.object({
    op: z.literal("item.complete"),
    payload: z.object({ id }).strict(),
  }),
  z.object({
    op: z.literal("item.save"),
    payload: z
      .object({
        id,
        owner_role: stepSchema.shape.owner_role,
        due_date: z.iso.date(),
      })
      .strict(),
  }),
  z.object({
    op: z.literal("document.review"),
    payload: z
      .object({
        id,
        status: z.enum(["APPROVED", "REJECTED"]),
        comments: z.string().trim().min(1).max(2000),
      })
      .strict(),
  }),
  z.object({
    op: z.literal("ai.draft"),
    payload: z
      .object({ position_id: id, context: z.string().trim().max(1500) })
      .strict(),
  }),
]);
