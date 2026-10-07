import { expect, it } from "vitest";
import { climateCharts } from "../src/modules/workspace/climate-charts";
it("conserva promedios decimales y participación sin inventar distribuciones", () => {
  const charts = climateCharts(
    {
      status: "CLOSED",
      responses: 5,
      invited: 7,
      averages: [
        { question_index: 1, average: 3.4 },
        { question_index: 2, average: 2.4 },
      ],
    },
    ["Comunicación", "Carga"],
  );
  expect(charts[0].values.map((v) => v.count)).toEqual([5, 2]);
  expect(charts[1].values).toEqual([
    { label: "Comunicación", count: 3.4 },
    { label: "Carga", count: 2.4 },
  ]);
});
it("no construye gráficas de grupos pequeños ni de encuestas abiertas", () => {
  const group = {
    status: "CLOSED",
    responses: 4,
    invited: 5,
    averages: [{ question_index: 1, average: 4 }],
  };
  expect(climateCharts(group, ["Apoyo"])).toEqual([]);
  expect(
    climateCharts({ ...group, status: "OPEN", responses: 5 }, ["Apoyo"]),
  ).toEqual([]);
});
