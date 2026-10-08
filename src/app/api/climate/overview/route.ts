import { NextResponse } from "next/server";
import { authenticate, requireRole } from "@/lib/auth";
import { databaseError, failure } from "@/lib/api";
import { currentWeek } from "@/modules/workspace/current-week";
import {
  climateAnalysisDate,
  climateNews,
  withinClimateWeek,
  type ClimateSurveyRecord,
} from "@/modules/workspace/climate-overview";

/** Novedades para RH y superadministración usando RLS y la agregación protegida de SQL. */
export async function GET() {
  try {
    const { client, profile } = await authenticate();
    requireRole(profile.role, ["RH_ADMIN"]);
    const period = currentWeek();
    const { data, error } = await client
      .from("climate_surveys")
      .select("id,title,status,questions,summary,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) databaseError(error);
    const surveys = (data ?? []) as ClimateSurveyRecord[];
    const recent = surveys.filter(
      (survey) =>
        survey.status === "OPEN" ||
        withinClimateWeek(survey.created_at, period) ||
        withinClimateWeek(climateAnalysisDate(survey), period),
    );
    const news = await Promise.all(
      recent.slice(0, 12).map(async (survey) => {
        const { data: group, error } = await client.rpc("climate_results", {
          sid: survey.id,
        });
        if (error) databaseError(error);
        return climateNews(survey, group, period);
      }),
    );
    const priority = (item: (typeof news)[number]) =>
      item.summary?.sentiment === "CONCERNING"
        ? 0
        : item.summary
          ? 1
          : item.can_analyze
            ? 2
            : item.status === "OPEN"
              ? 3
              : 4;
    news.sort((a, b) => priority(a) - priority(b));
    return NextResponse.json(
      {
        period,
        open: surveys.filter((s) => s.status === "OPEN").length,
        new_surveys: surveys.filter((s) =>
          withinClimateWeek(s.created_at, period),
        ).length,
        analyzed_this_week: news.filter((s) => s.analyzed_this_week).length,
        surveys: news,
        limited: surveys.length === 200 || recent.length > 12,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
