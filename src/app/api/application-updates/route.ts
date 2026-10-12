import { NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/server";
import { databaseError, failure } from "@/lib/api";
import { ownApplicationUpdates } from "@/modules/workspace/application-progress";

/** La sesión obtiene las postulaciones propias con RLS antes de consultar estados auditados. */
export async function GET() {
  try {
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["CANDIDATO", "EMPLEADO"]);
    const { data: candidates, error: candidateError } = await client
      .from("candidates")
      .select("id")
      .eq("profile_id", profile.id)
      .limit(1);
    if (candidateError) databaseError(candidateError);
    const headers = { "Cache-Control": "no-store" };
    if (!candidates?.length)
      return NextResponse.json({ applications: [], updates: [] }, { headers });
    const { data: applications, error: applicationError } = await client
      .from("applications")
      .select("id,vacancy_id,status,applied_at,updated_at")
      .eq("candidate_id", candidates[0].id)
      .order("applied_at", { ascending: false })
      .limit(200);
    if (applicationError) databaseError(applicationError);
    if (!applications?.length)
      return NextResponse.json({ applications: [], updates: [] }, { headers });
    const ids = new Set(applications.map((a) => a.id));
    const vacancyIds = [...new Set(applications.map((a) => a.vacancy_id))];
    const { data: vacancies, error: vacancyError } = await client
      .from("vacancies")
      .select("id,title")
      .in("id", vacancyIds);
    if (vacancyError) databaseError(vacancyError);
    // La auditoría es privada. El servidor proyecta únicamente estados de IDs ya autorizados,
    // nunca nombres de quien decide, metadatos completos, comentarios ni puntuaciones de IA.
    const admin = adminDb();
    const logs = [];
    for (let start = 0; start < applications.length; start += 50) {
      const { data, error } = await admin
        .from("audit_logs")
        .select("id,resource_id,resource_type,action,metadata,created_at")
        .eq("resource_type", "applications")
        .in(
          "resource_id",
          applications.slice(start, start + 50).map((a) => a.id),
        )
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) databaseError(error);
      logs.push(...(data ?? []));
    }
    const titles = new Map((vacancies ?? []).map((v) => [v.id, v.title]));
    return NextResponse.json(
      {
        applications: applications.map((a) => ({
          id: a.id,
          vacancy_id: a.vacancy_id,
          status: a.status,
          applied_at: a.applied_at,
          updated_at: a.updated_at,
          title: titles.get(a.vacancy_id) || "Mi postulación",
        })),
        updates: ownApplicationUpdates(logs, ids).slice(0, 200),
      },
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
