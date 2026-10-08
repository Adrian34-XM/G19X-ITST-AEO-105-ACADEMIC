import { z } from "zod";
import { climateCharts, type ClimateChart } from "./climate-charts";

export type ClimateGroupAnalysis = {
  summary: string;
  sentiment: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  response_count?: number;
  averages?: { question_index: number; average: number }[];
  charts?: ClimateChart[];
};

export const climateSummarySchema = z
  .object({
    summary: z.string().min(1).max(3000),
    sentiment: z.enum(["POSITIVE", "MIXED", "CONCERNING"]),
    strengths: z.array(z.string().max(700)).max(10),
    risks: z.array(z.string().max(700)).max(10),
    recommendations: z.array(z.string().max(1000)).min(1).max(12),
  })
  .strict();

export type ClimateSurveyRecord = {
  id: string;
  title: string;
  status: string;
  questions: string[];
  created_at: string;
  summary: unknown;
};
export type ClimateNews = {
  id: string;
  title: string;
  status: string;
  questions: string[];
  created_this_week: boolean;
  analyzed_this_week: boolean;
  can_analyze: boolean;
  responses: number;
  invited: number;
  summary: ClimateGroupAnalysis | null;
};
export type ClimateOverview = {
  period: { start: string; end: string; timezone: string };
  open: number;
  new_surveys: number;
  analyzed_this_week: number;
  surveys: ClimateNews[];
  limited: boolean;
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function withinClimateWeek(
  date: unknown,
  period: ClimateOverview["period"],
) {
  const time = typeof date === "string" ? Date.parse(date) : NaN;
  return time >= Date.parse(period.start) && time < Date.parse(period.end);
}
export function climateAnalysisDate(survey: ClimateSurveyRecord) {
  return object(survey.summary).generated_at;
}

/** Solo devuelve totales y un análisis de grupo; nunca comentarios, recibos ni identidades. */
export function climateNews(
  survey: ClimateSurveyRecord,
  rawGroup: unknown,
  period: ClimateOverview["period"],
): ClimateNews {
  const group = object(rawGroup);
  const count = (value: unknown) =>
    typeof value === "number" && Number.isInteger(value) && value >= 0
      ? value
      : 0;
  const responses = count(group.responses);
  const feedback = Array.isArray(group.feedback) ? group.feedback.length : 0;
  const canAnalyze =
    survey.status === "CLOSED" &&
    group.status === "CLOSED" &&
    (responses >= 5 || feedback >= 5);
  const saved = object(group.summary);
  const parsed = climateSummarySchema.safeParse(
    Object.fromEntries(
      ["summary", "sentiment", "strengths", "risks", "recommendations"].map(
        (key) => [key, saved[key]],
      ),
    ),
  );
  const current =
    saved.response_count === undefined || saved.response_count === responses;
  const averages = Array.isArray(group.averages)
    ? (group.averages.filter((item) => {
        const average = object(item);
        return (
          Number.isInteger(average.question_index) &&
          Number(average.question_index) >= 1 &&
          Number(average.question_index) <= survey.questions.length &&
          typeof average.average === "number" &&
          average.average >= 1 &&
          average.average <= 5
        );
      }) as { question_index: number; average: number }[])
    : [];
  const summary: ClimateGroupAnalysis | null =
    canAnalyze && current && parsed.success
      ? {
          ...parsed.data,
          response_count: responses,
          charts: climateCharts(
            {
              status: "CLOSED",
              responses,
              invited: count(group.invited),
              averages,
            },
            survey.questions,
          ),
        }
      : null;
  return {
    id: survey.id,
    title: survey.title,
    status: survey.status,
    questions: survey.questions,
    created_this_week: withinClimateWeek(survey.created_at, period),
    analyzed_this_week:
      !!summary && withinClimateWeek(saved.generated_at, period),
    can_analyze: canAnalyze,
    responses,
    invited: count(group.invited),
    summary,
  };
}
