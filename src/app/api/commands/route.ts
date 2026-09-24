import { requireHrHierarchySchema } from "@/lib/api";
/**
 * Puerta de escritura general: valida origen, sesión, operación y datos. Delega la modificación a command para aplicar permisos y transacciones en PostgreSQL.
 */
import { requireWorkforceSchema, requireCourseEvidenceSchema } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, ApiError } from "@/lib/auth";
import { schemas, type Operation } from "@/modules/commands/schemas";
import {
  checkOrigin,
  databaseError,
  failure,
  readJson,
  validateInterviewSchedule,
  requireHiringSchema,
} from "@/lib/api";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const { client } = await authenticate();
    const input = z
      .object({ op: z.string(), payload: z.unknown() })
      .strict()
      .parse(await readJson(req));
    if (!Object.hasOwn(schemas, input.op))
      throw new ApiError(404, "Operación no encontrada.");
    const payload = schemas[input.op as Operation].parse(input.payload);
    if (["employee.save", "employee.enroll"].includes(input.op))
      await requireHrHierarchySchema(client);
    if (input.op === "interview.save")
      await validateInterviewSchedule(client, payload);
    if (input.op === "application.hire" && "position_id" in payload)
      await requireHiringSchema(client);
    if (["course.progress", "course.review"].includes(input.op))
      await requireCourseEvidenceSchema(client);
    if (
      [
        "employee.enroll",
        "employee.save",
        "course.save",
        "course.progress",
        "course.review",
        "onboarding.complete",
      ].includes(input.op)
    )
      await requireWorkforceSchema(client);
    const { data, error } = await client.rpc("command", {
      op: input.op,
      payload,
    });
    if (error) databaseError(error);
    return NextResponse.json(data);
  } catch (e) {
    return failure(e);
  }
}
