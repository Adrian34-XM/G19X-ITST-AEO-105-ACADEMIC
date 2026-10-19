import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DataChart } from "../src/components/data-chart";
import { ClimateQuestionChart } from "../src/components/climate-question-chart";
import { DataGraph } from "../src/components/workforce-tools";

describe("presentación accesible de las gráficas", () => {
  it("conserva ceros, decimales y textos escapados en la tabla sin cargar canvas en SSR", () => {
    const html = renderToStaticMarkup(
      createElement(DataChart, {
        title: "Resultados",
        kind: "bars",
        decimals: 2,
        values: [
          { label: "<script>no ejecutar</script>", count: 2.45 },
          { label: "Cero", count: 0 },
        ],
      }),
    );
    expect(html).toContain("2.45");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>no ejecutar");
    expect(html).toContain('<th scope="row">Cero</th><td>0</td>');
    expect(html).not.toContain("<canvas");
  });
  it("explica la ausencia de registros y no inventa datos", () => {
    const html = renderToStaticMarkup(
      createElement(DataChart, { title: "Vacío", kind: "pie", values: [] }),
    );
    expect(html).toContain("Sin datos con estos filtros.");
    expect(html).not.toContain("<table");
  });
  it("las preguntas de clima mantienen su escala y los promedios exactos", () => {
    const html = renderToStaticMarkup(
      createElement(ClimateQuestionChart, {
        values: [
          { label: "Comunicación", count: 3.4 },
          { label: "Carga", count: 2.45 },
        ],
      }),
    );
    expect(html).toContain("Promedio (1 a 5)");
    expect(html).toContain("3.4/5");
    expect(html).toContain("2.45/5");
    expect(html).toContain("no personas ni porcentajes");
  });
  it.each(["bars", "columns", "line", "pie", "donut"])(
    "%s usa las mismas cifras del informe y actualiza al recibir otros filtros",
    (kind) => {
      const render = (count: number) =>
        renderToStaticMarkup(
          createElement(DataGraph, {
            chart: {
              title: "Área autorizada",
              kind,
              dataset: "tasks",
              group: "status",
              values: [{ label: "PENDING", count }],
            },
          }),
        );
      expect(render(7)).toContain('<th scope="row">Pendiente</th><td>7</td>');
      expect(render(2)).toContain('<th scope="row">Pendiente</th><td>2</td>');
      expect(render(2)).not.toContain("<td>7</td>");
    },
  );
});
