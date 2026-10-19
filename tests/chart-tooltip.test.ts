import { describe, expect, it } from "vitest";
import { populateString } from "@amcharts/amcharts5/.internal/core/util/PopulateString";
import type { Sprite } from "@amcharts/amcharts5";
import {
  chartRows,
  chartTooltip,
  type ChartKind,
} from "../src/lib/charts/data";

/** Reproduce la resolución real de placeholders con el label interno de PieSeries. */
function sliceTarget(label: string, value = 15) {
  const row = chartRows([{ label, count: value }])[0];
  const settings = {
    label: {},
    category: row.categoryLabel,
    value,
    valuePercentTotal: 65.2,
  };
  const formatter = {
    get: () => [],
    format: (n: number) =>
      n.toLocaleString("es-MX", { maximumFractionDigits: 2 }),
  };
  return {
    dataItem: {
      _settings: settings,
      get: (key: keyof typeof settings) => settings[key],
      dataContext: row,
    },
    getDateFormatter: () => formatter,
    getNumberFormatter: () => formatter,
    getDurationFormatter: () => formatter,
  } as unknown as Sprite;
}

describe("tooltips de amCharts", () => {
  it("reproduce el objeto interno que causaba el texto incorrecto", () => {
    expect(populateString(sliceTarget("Asignados"), "{label}: {value}")).toBe(
      "[object Object]: 15",
    );
  });
  it.each<ChartKind>(["pie", "donut", "bars", "columns", "line"])(
    "%s muestra categoría y cifra aunque exista un objeto label interno",
    (kind) => {
      const text = populateString(sliceTarget("Asignados"), chartTooltip(kind));
      expect(text).toContain("Asignados: 15 registros");
      expect(text).not.toContain("[object Object]");
      if (kind === "pie" || kind === "donut") expect(text).toContain("65.2%");
    },
  );
  it("conserva los promedios decimales de preguntas", () => {
    expect(
      populateString(
        sliceTarget("Comunicación", 3.45),
        chartTooltip("columns", "puntos", 2),
      ),
    ).toBe("Comunicación: 3.45 puntos");
  });
});
