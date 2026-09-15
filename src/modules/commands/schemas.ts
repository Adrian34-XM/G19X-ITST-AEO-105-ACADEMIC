import { z } from "zod";
import { roles } from "@/lib/permissions";
const id = z.uuid(),
  short = z.string().trim().min(1).max(150),
  text = z.string().trim().min(1).max(14000),
  date = z.iso.date();
const optionalId = id.optional();
export const schemas = {
  "department.save": z.object({ id: optionalId, name: short }).strict(),
  "position.save": z
    .object({ id: optionalId, name: short, department_id: id })
    .strict(),
  "profile.admin": z
    .object({ id, role: z.enum(roles), active: z.boolean() })
    .strict(),
  "candidate.save": z
    .object({
      phone: z.string().max(40),
      skills: z.array(short).max(40),
      experience_years: z.number().min(0).max(80),
    })
    .strict(),
  "vacancy.save": z
    .object({
      id: optionalId,
      position_id: id,
      title: short,
      description: text,
      requirements: text,
      skills: z.array(short).max(40),
      experience_required: z.number().min(0).max(80),
      status: z.enum(["DRAFT", "PUBLISHED", "CLOSED"]),
    })
    .strict(),
  "vacancy.delete": z.object({ id }).strict(),
  "application.create": z.object({ vacancy_id: id }).strict(),
  "application.status": z
    .object({
      id,
      status: z.enum(["EN_REVISION", "PRESELECCIONADO", "RECHAZADO"]),
    })
    .strict(),
  "application.hire": z.object({ id }).strict(),
  "interview.save": z
    .object({
      id: optionalId,
      application_id: id,
      scheduled_at: z.iso.datetime({ offset: true }),
      interviewer_id: id,
      notes: z.string().max(4000),
      status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
    })
    .strict(),
  "interview.cancel": z.object({ id }).strict(),
  "employee.save": z
    .object({
      id,
      position_id: id,
      manager_id: z.union([id, z.literal("")]),
      status: z.enum(["ACTIVE", "INACTIVE"]),
    })
    .strict(),
  "onboarding.complete": z.object({ id }).strict(),
  "course.save": z
    .object({
      id: optionalId,
      title: short,
      description: text,
      content: text,
      duration_minutes: z.number().int().min(1).max(10000),
      required: z.boolean(),
    })
    .strict(),
  "course.delete": z.object({ id }).strict(),
  "course.assign": z.object({ id, employee_id: id, due_date: date }).strict(),
  "course.progress": z
    .object({ id, progress: z.number().int().min(0).max(100) })
    .strict(),
  "task.save": z
    .object({
      id: optionalId,
      title: short,
      description: text,
      employee_id: id,
      priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
      due_date: date,
    })
    .strict(),
  "task.status": z
    .object({
      id,
      status: z.enum(["IN_PROGRESS", "APPROVED", "REJECTED"]),
      comments: z.string().max(4000).optional(),
    })
    .strict(),
};
export type Operation = keyof typeof schemas;
