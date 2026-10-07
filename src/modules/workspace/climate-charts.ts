export type ClimateChart = {
  title: string;
  kind: "bars" | "pie";
  values: { label: string; count: number }[];
};
/** Cifras calculadas con agregados autorizados, nunca inventadas por el modelo. */
export function climateCharts(
  group: {
    status?: string;
    responses: number;
    invited: number;
    averages: { question_index: number; average: number }[];
  },
  questions: string[],
): ClimateChart[] {
  if (
    group.status !== "CLOSED" ||
    group.responses < 5 ||
    !group.averages.length
  )
    return [];
  return [
    {
      title: "Participación de la encuesta",
      kind: "pie",
      values: [
        { label: "Respondieron", count: group.responses },
        {
          label: "Pendientes",
          count: Math.max(0, group.invited - group.responses),
        },
      ],
    },
    {
      title: "Promedios por pregunta · escala de 1 a 5",
      kind: "bars",
      values: group.averages
        .filter(
          (a) =>
            Number.isInteger(a.question_index) &&
            !!questions[a.question_index - 1] &&
            Number.isFinite(Number(a.average)) &&
            Number(a.average) >= 1 &&
            Number(a.average) <= 5,
        )
        .map((a) => ({
          label: questions[a.question_index - 1],
          count: Number(a.average),
        })),
    },
  ];
}
