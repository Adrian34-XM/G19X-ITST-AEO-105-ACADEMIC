/** Datos de presentación: no filtra registros ni calcula métricas de negocio. */
export type ChartKind = "bars" | "columns" | "line" | "pie" | "donut";
export type ChartValue = { label: string; count: number; axisLabel?: string };
export type DataChartProps = {
  title: string;
  kind: ChartKind;
  values: ChartValue[];
  unit?: string;
  maximum?: number;
  decimals?: number;
};

/** Identificadores distintos preservan incluso categorías con el mismo texto. */
export function chartRows(values: ChartValue[]) {
  return values.map((item, index) => {
    if (!Number.isFinite(item.count) || item.count < 0)
      throw new Error("La gráfica requiere cifras finitas y no negativas.");
    return {
      category: String(index),
      // `label` es un objeto interno en PieSeries. No usarlo como placeholder.
      categoryLabel: item.label,
      axisLabel: item.axisLabel ?? item.label,
      value: item.count,
    };
  });
}

export function chartKind(value: string): ChartKind {
  if (value === "ring") return "donut";
  return ["bars", "columns", "line", "pie", "donut"].includes(value)
    ? (value as ChartKind)
    : "bars";
}

/** Usa las propiedades de datos, no el objeto `label` interno de amCharts. */
export function chartTooltip(
  kind: ChartKind,
  unit = "registros",
  decimals = 0,
) {
  const circular = kind === "pie" || kind === "donut";
  const category = circular ? "category" : "categoryLabel";
  const format = decimals ? "#,###.##" : "#,###";
  return `{${category}}: {value.formatNumber('${format}')} ${unit}${circular ? " ({valuePercentTotal.formatNumber('0.0')}%)" : ""}`;
}
