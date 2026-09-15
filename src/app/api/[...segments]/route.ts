import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, ApiError, requireRole } from "@/lib/auth";
import { checkOrigin, readJson, failure, databaseError } from "@/lib/api";
import { schemas, type Operation } from "@/modules/commands/schemas";
import { performance } from "@/modules/performance/service";
import { GET as getFile, POST as uploadFile } from "@/app/api/files/route";
import { POST as ai } from "@/app/api/ai/[useCase]/route";
type Ctx = { params: Promise<{ segments: string[] }> };
const resources: Record<string, string> = {
  vacancies: "vacancies",
  candidates: "candidates",
  applications: "applications",
  interviews: "interviews",
  employees: "employees",
  courses: "courses",
  tasks: "tasks",
  onboarding: "onboarding",
  "course-assignments": "course_assignments",
  departments: "departments",
  positions: "positions",
  profiles: "profiles",
  audit: "audit_logs",
};
export async function GET(req: Request, ctx: Ctx) {
  try {
    const { client, user, profile } = await authenticate();
    const { segments: s } = await ctx.params;
    if (s[0] === "candidates" && s[2] === "cv-url") {
      const url = new URL("/api/files", req.url);
      url.searchParams.set("bucket", "cvs");
      url.searchParams.set("id", z.uuid().parse(s[1]));
      return getFile(new Request(url, { headers: req.headers }));
    }
    if (s[0] === "analytics" && s[1] === "kpis") {
      requireRole(profile.role, ["RH_ADMIN"]);
      const tables = [
        "employees",
        "vacancies",
        "candidates",
        "applications",
        "tasks",
        "course_assignments",
      ];
      const entries = await Promise.all(
        tables.map(async (table) => {
          const { data, error } = await client
            .from(table)
            .select("*")
            .limit(1000);
          if (error) databaseError(error);
          return [table, data ?? []] as const;
        }),
      );
      const all = Object.fromEntries(entries);
      const scores = all.employees.map(
        (e) =>
          performance(
            all.tasks.filter((t) => t.employee_id === e.id),
            all.course_assignments.filter((c) => c.employee_id === e.id),
          ).overall_score,
      );
      return NextResponse.json({
        active_employees: all.employees.filter((e) => e.status === "ACTIVE")
          .length,
        active_vacancies: all.vacancies.filter((v) => v.status === "PUBLISHED")
          .length,
        candidates: all.candidates.length,
        hires: all.applications.filter((a) => a.status === "CONTRATADO").length,
        completed_courses: all.course_assignments.filter(
          (c) => c.status === "COMPLETED",
        ).length,
        completed_tasks: all.tasks.filter((t) => t.status === "APPROVED")
          .length,
        overdue_tasks: all.tasks.filter(
          (t) =>
            t.status !== "APPROVED" &&
            t.due_date < new Date().toISOString().slice(0, 10),
        ).length,
        average_performance: scores.length
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0,
      });
    }
    if (s[0] === "performance") {
      let eid: string;
      if (s[1] === "me") {
        const { data: e } = await client
          .from("employees")
          .select("id")
          .eq("profile_id", user.id)
          .single();
        if (!e) throw new ApiError(404, "Empleado no encontrado.");
        eid = e.id;
      } else eid = z.uuid().parse(s[2]);
      const { data: e } = await client
        .from("employees")
        .select("id")
        .eq("id", eid)
        .single();
      if (!e) throw new ApiError(404, "Empleado no encontrado.");
      const [{ data: tasks, error: tError }, { data: courses, error: cError }] =
        await Promise.all([
          client.from("tasks").select("status").eq("employee_id", eid),
          client
            .from("course_assignments")
            .select("status")
            .eq("employee_id", eid),
        ]);
      if (tError) databaseError(tError);
      if (cError) databaseError(cError);
      return NextResponse.json(performance(tasks ?? [], courses ?? []));
    }
    if (s[0] === "onboarding" && s[1] === "me") {
      const { data: e } = await client
        .from("employees")
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (!e) throw new ApiError(404, "Empleado no encontrado.");
      const { data, error } = await client
        .from("onboarding")
        .select("*,onboarding_items(*)")
        .eq("employee_id", e.id)
        .single();
      if (error) throw new ApiError(404, "Onboarding no encontrado.");
      return NextResponse.json(data);
    }
    const table = resources[s[0]];
    if (!table || s.length > 2) throw new ApiError(404, "Ruta no encontrada.");
    const url = new URL(req.url);
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .parse(url.searchParams.get("page") ?? 0);
    let query = client.from(table).select("*");
    if (s[1]) query = query.eq("id", z.uuid().parse(s[1]));
    const { data, error } = await query
      .order("id")
      .range(page * 50, page * 50 + 49);
    if (error) databaseError(error);
    if (s[1] && !data?.length)
      throw new ApiError(404, "Recurso no encontrado.");
    return NextResponse.json(s[1] ? data![0] : { data, page, page_size: 50 }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
async function mutate(req: Request, ctx: Ctx) {
  try {
    checkOrigin(req);
    const { client } = await authenticate();
    const { segments: s } = await ctx.params;
    if (
      s[0] === "ai" &&
      s[1] === "recruitment" &&
      ["recommend", "summary"].includes(s[2])
    )
      return ai(req, { params: Promise.resolve({ useCase: "recruitment" }) });
    if (s[0] === "ai" && s[1] === "task-verification")
      return ai(req, { params: Promise.resolve({ useCase: "evidence" }) });
    if (
      (s[0] === "candidates" && s[1] === "cv") ||
      (s[0] === "tasks" && s[2] === "evidence") ||
      (s[0] === "onboarding" && s[2] === "documents")
    ) {
      const form = await req.formData();
      form.set(
        "bucket",
        s[0] === "candidates"
          ? "cvs"
          : s[0] === "tasks"
            ? "task-evidence"
            : "onboarding-documents",
      );
      if (s[2]) form.set("id", z.uuid().parse(s[1]));
      const headers = new Headers(req.headers);
      headers.delete("content-type");
      headers.delete("content-length");
      return uploadFile(
        new Request(req.url, { method: "POST", headers, body: form }),
      );
    }
    const key = `${req.method} ${s[0]}${s[1] ? "/id" : ""}${s[2] ? "/" + s[2] : ""}`;
    const routes: Record<string, Operation> = {
      "POST vacancies": "vacancy.save",
      "PATCH vacancies/id": "vacancy.save",
      "DELETE vacancies/id": "vacancy.delete",
      "POST applications": "application.create",
      "PATCH applications/id/status": "application.status",
      "POST applications/id/hire": "application.hire",
      "POST interviews": "interview.save",
      "PATCH interviews/id": "interview.save",
      "DELETE interviews/id": "interview.cancel",
      "PATCH employees/id": "employee.save",
      "POST courses": "course.save",
      "PATCH courses/id": "course.save",
      "DELETE courses/id": "course.delete",
      "POST courses/id/assign": "course.assign",
      "PATCH course-assignments/id/progress": "course.progress",
      "POST tasks": "task.save",
      "PATCH tasks/id": "task.save",
      "PATCH candidates/id": "candidate.save",
      "POST departments": "department.save",
      "POST positions": "position.save",
    };
    let op = routes[key];
    let input: Record<string, unknown> = {};
    if (req.method !== "DELETE" && !key.endsWith("/hire"))
      input = z.record(z.string(), z.unknown()).parse(await readJson(req));
    if (s[0] === "onboarding" && s[1] === "items" && s[2]) {
      op = "onboarding.complete";
      input = { id: z.uuid().parse(s[2]) };
    } else if (s[1] && op !== "candidate.save") input.id = z.uuid().parse(s[1]);
    if (!op) throw new ApiError(404, "Ruta no encontrada.");
    if (op === "task.save" && input.status) op = "task.status";
    const payload = schemas[op].parse(input);
    const { data, error } = await client.rpc("command", { op, payload });
    if (error) databaseError(error);
    return NextResponse.json(data, {
      status: req.method === "POST" ? 201 : 200,
    });
  } catch (e) {
    return failure(e);
  }
}
export const POST = mutate,
  PATCH = mutate,
  DELETE = mutate;
