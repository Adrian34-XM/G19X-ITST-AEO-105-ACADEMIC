import { describe, expect, it } from "vitest";
import { chartKind, chartRows } from "../src/lib/charts/data";

describe("datos para amCharts", () => {
  it("conserva decimales, ceros y orden sin fusionar textos iguales", () => {
    const input = [
      { label: "Comunicación", count: 3.4, axisLabel: "P1" },
      { label: "Comunicación", count: 2.45, axisLabel: "P2" },
      { label: "Sin respuestas", count: 0 },
    ];
    const rows = chartRows(input);
    expect(rows.map((r) => r.value)).toEqual([3.4, 2.45, 0]);
    expect(rows.map((r) => r.category)).toEqual(["0", "1", "2"]);
    expect(rows.map((r) => r.axisLabel)).toEqual([
      "P1",
      "P2",
      "Sin respuestas",
    ]);
    expect(input[0]).toEqual({
      label: "Comunicación",
      count: 3.4,
      axisLabel: "P1",
    });
  });
  it.each([NaN, Infinity, -Infinity, -1])(
    "rechaza cifras inválidas: %s",
    (count) => {
      expect(() => chartRows([{ label: "Dato", count }])).toThrow();
    },
  );
  it("admite un resultado vacío sin fabricar categorías", () => {
    expect(chartRows([])).toEqual([]);
  });
  it.each(["bars", "columns", "line", "pie", "donut"])(
    "conserva el tipo %s",
    (kind) => {
      expect(chartKind(kind)).toBe(kind);
    },
  );
  it("mantiene compatibilidad con el anillo de analíticas y limita tipos desconocidos", () => {
    expect(chartKind("ring")).toBe("donut");
    expect(chartKind("javascript:alert(1)")).toBe("bars");
  });
});
