import { expect, it } from "vitest";
import {
  climateNews,
  withinClimateWeek,
} from "@/modules/workspace/climate-overview";
import { currentWeek } from "@/modules/workspace/current-week";

const period = currentWeek(new Date("2026-10-08T18:00:00Z"));
const analysis = {
  summary: "La carga de trabajo requiere seguimiento.",
  sentiment: "CONCERNING",
  strengths: ["Colaboración"],
  risks: ["Carga de trabajo"],
  recommendations: ["Revisar prioridades con el grupo"],
  generated_at: "2026-10-07T18:00:00Z",
  response_count: 5,
  private_identity: "secreto",
  charts: [{ values: [{ count: 999 }] }],
};
const survey = {
  id: "s",
  title: "Encuesta del equipo",
  status: "CLOSED",
  created_at: "2026-10-05T08:00:00Z",
  questions: ["Comunicación", "Carga", "Apoyo"],
  summary: analysis,
};
const group = {
  status: "CLOSED",
  responses: 5,
  invited: 7,
  summary: analysis,
  averages: [{ question_index: 2, average: 2.4 }],
  comments: ["secreto"],
  feedback: [],
  employee_id: "secreto",
};

it("devuelve análisis y gráficas verificadas sin comentarios ni identidades", () => {
  const news = climateNews(survey, group, period);
  expect(news.summary?.summary).toBe(analysis.summary);
  expect(news.summary?.charts?.[1].values).toEqual([
    { label: "Carga", count: 2.4 },
  ]);
  expect(JSON.stringify(news)).not.toMatch(
    /secreto|999|employee_id|comments|private_identity/,
  );
  expect(news.analyzed_this_week).toBe(true);
});
it.each([0, 4])(
  "oculta análisis guardados de grupos con %i respuestas",
  (responses) => {
    const news = climateNews(survey, { ...group, responses }, period);
    expect(news.can_analyze).toBe(false);
    expect(news.summary).toBeNull();
  },
);
it("no suma respuestas y comentarios para alcanzar el mínimo", () => {
  expect(
    climateNews(
      survey,
      { ...group, responses: 3, feedback: ["a", "b"] },
      period,
    ).can_analyze,
  ).toBe(false);
});
it("permite cinco comentarios sin construir gráficas ni exportar los textos", () => {
  const news = climateNews(
    survey,
    {
      ...group,
      responses: 0,
      feedback: Array(5).fill("secreto"),
      summary: { ...analysis, response_count: 0 },
    },
    period,
  );
  expect(news.can_analyze).toBe(true);
  expect(news.summary?.charts).toEqual([]);
  expect(JSON.stringify(news)).not.toContain("secreto");
});
it.each(["OPEN", "DRAFT"])(
  "no revela análisis mientras la encuesta está %s",
  (status) => {
    const news = climateNews(
      { ...survey, status },
      { ...group, status },
      period,
    );
    expect(news.summary).toBeNull();
    expect(news.can_analyze).toBe(false);
  },
);
it("no presenta un análisis que corresponde a otro total de respuestas", () => {
  expect(
    climateNews(survey, { ...group, responses: 6 }, period).summary,
  ).toBeNull();
});
it("no presenta un análisis malformado como un resultado válido", () => {
  expect(
    climateNews(
      survey,
      { ...group, summary: { ...analysis, recommendations: [] } },
      period,
    ).summary,
  ).toBeNull();
});
it("acota novedades a lunes-domingo en Ciudad de México", () => {
  expect(withinClimateWeek("2026-10-05T05:59:59Z", period)).toBe(false);
  expect(withinClimateWeek("2026-10-05T06:00:00Z", period)).toBe(true);
  expect(withinClimateWeek("2026-10-12T05:59:59Z", period)).toBe(true);
  expect(withinClimateWeek("2026-10-12T06:00:00Z", period)).toBe(false);
  expect(withinClimateWeek(undefined, period)).toBe(false);
});
