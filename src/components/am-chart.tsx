"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import * as am5percent from "@amcharts/amcharts5/percent";
import Animated from "@amcharts/amcharts5/themes/Animated";
import Dark from "@amcharts/amcharts5/themes/Dark";
import esES from "@amcharts/amcharts5/locales/es_ES";
import {
  chartRows,
  type DataChartProps,
  type ChartValue,
} from "@/lib/charts/data";
import { useDarkTheme } from "./theme-toggle";

function subscribeMotion(notify: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
function reducedSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Cada instancia posee su Root y lo libera al cambiar datos, tema o módulo. */
export default function AmChart({
  title,
  kind,
  values,
  unit = "registros",
  maximum,
  decimals = 0,
}: DataChartProps) {
  const element = useRef<HTMLDivElement>(null);
  const dark = useDarkTheme();
  // Los padres reconstruyen arrays al renderizar. Su identidad no implica datos
  // nuevos: evita destruir canvas y reiniciar animaciones por cambios ajenos.
  const valuesKey = JSON.stringify(values);
  const reduced = useSyncExternalStore(
    subscribeMotion,
    reducedSnapshot,
    () => true,
  );

  useLayoutEffect(() => {
    if (!element.current) return;
    const root = am5.Root.new(element.current, {
      ariaLabel: title,
      focusable: true,
    });
    try {
      root.locale = esES;
      root.setThemes([
        ...(!reduced ? [Animated.new(root)] : []),
        ...(dark ? [Dark.new(root)] : []),
      ]);
      root.numberFormatter.set("numberFormat", decimals ? "#,###.##" : "#,###");
      root.container.set("layout", root.verticalLayout);
      root.container.children.push(
        am5.Label.new(root, {
          text: title,
          fontSize: 14,
          fontWeight: "600",
          width: am5.p100,
          oversizedBehavior: "wrap",
          textAlign: "center",
          ignoreFormatting: true,
        }),
      );
      const rows = chartRows(JSON.parse(valuesKey) as ChartValue[]);
      const numberFormat = decimals ? "#,###.##" : "#,###";
      const text = `{label}: {value.formatNumber('${numberFormat}')} ${unit}`;

      if (kind === "pie" || kind === "donut") {
        const chart = root.container.children.push(
          am5percent.PieChart.new(root, {
            layout: root.verticalLayout,
            innerRadius: kind === "donut" ? am5.percent(55) : 0,
          }),
        );
        const series = chart.series.push(
          am5percent.PieSeries.new(root, {
            valueField: "value",
            categoryField: "label",
            alignLabels: false,
          }),
        );
        series.labels.template.set("forceHidden", true);
        series.ticks.template.set("forceHidden", true);
        series.slices.template.setAll({
          tooltipText: text + " ({valuePercentTotal.formatNumber('0.0')}%)",
          focusable: true,
          ariaLabel: text,
          toggleKey: "none",
        });
        series.getTooltip()?.label.setAll({
          ignoreFormatting: true,
          maxWidth: 280,
          oversizedBehavior: "wrap",
        });
        const legend = chart.children.push(
          am5.Legend.new(root, {
            width: am5.p100,
            maxHeight: 110,
            verticalScrollbar: am5.Scrollbar.new(root, {
              orientation: "vertical",
            }),
            layout: am5.GridLayout.new(root, {
              maxColumns: 2,
              fixedWidthGrid: true,
            }),
            clickTarget: "none",
          }),
        );
        legend.labels.template.setAll({
          fontSize: 12,
          oversizedBehavior: "wrap",
          ignoreFormatting: true,
        });
        legend.valueLabels.template.set("forceHidden", true);
        series.data.setAll(rows);
        legend.data.setAll(series.dataItems);
        if (!reduced) series.appear(400);
      } else {
        const horizontal = kind === "bars";
        const chart = root.container.children.push(
          am5xy.XYChart.new(root, {
            panX: false,
            panY: false,
            wheelX: "none",
            wheelY: "none",
            paddingLeft: 0,
          }),
        );
        const categoryRenderer = horizontal
          ? am5xy.AxisRendererY.new(root, {
              inversed: true,
              minGridDistance: 25,
            })
          : am5xy.AxisRendererX.new(root, { minGridDistance: 65 });
        categoryRenderer.labels.template.setAll({
          text: "{axisLabel}",
          fontSize: 12,
          maxWidth: horizontal ? 155 : 100,
          oversizedBehavior: "truncate",
          ignoreFormatting: true,
        });
        const categoryAxis = am5xy.CategoryAxis.new(root, {
          categoryField: "category",
          renderer: categoryRenderer,
        });
        const valueAxis = am5xy.ValueAxis.new(root, {
          min: 0,
          ...(maximum !== undefined
            ? { max: maximum, strictMinMax: true }
            : {}),
          maxPrecision: decimals,
          numberFormat,
          renderer: horizontal
            ? am5xy.AxisRendererX.new(root, {})
            : am5xy.AxisRendererY.new(root, {}),
        });
        if (horizontal) {
          chart.yAxes.push(categoryAxis);
          chart.xAxes.push(valueAxis);
        } else {
          chart.xAxes.push(categoryAxis);
          chart.yAxes.push(valueAxis);
        }
        const tooltip = am5.Tooltip.new(root, { labelText: text });
        tooltip.label.setAll({
          ignoreFormatting: true,
          maxWidth: 280,
          oversizedBehavior: "wrap",
        });
        const settings = {
          name: unit,
          xAxis: horizontal ? valueAxis : categoryAxis,
          yAxis: horizontal ? categoryAxis : valueAxis,
          tooltip,
          ...(horizontal
            ? { valueXField: "value", categoryYField: "category" }
            : { valueYField: "value", categoryXField: "category" }),
        };
        const series =
          kind === "line"
            ? chart.series.push(am5xy.LineSeries.new(root, settings))
            : chart.series.push(
                am5xy.ColumnSeries.new(root, {
                  ...settings,
                  colorByDataItem: true,
                }),
              );
        if (series instanceof am5xy.ColumnSeries) {
          series.columns.template.setAll({
            tooltipText: text,
            focusable: true,
            ariaLabel: text,
            strokeOpacity: 0,
          });
        } else {
          series.strokes.template.set("strokeWidth", 3);
          series.bullets.push(() =>
            am5.Bullet.new(root, {
              sprite: am5.Circle.new(root, {
                radius: 4,
                fill: series.get("stroke"),
                focusable: true,
                ariaLabel: text,
              }),
            }),
          );
        }
        const cursor = chart.set(
          "cursor",
          am5xy.XYCursor.new(root, {
            behavior: horizontal ? "zoomY" : "zoomX",
          }),
        );
        (horizontal ? cursor.lineX : cursor.lineY).set("visible", false);
        if (rows.length > 8) {
          chart.set(
            horizontal ? "scrollbarY" : "scrollbarX",
            am5.Scrollbar.new(root, {
              orientation: horizontal ? "vertical" : "horizontal",
            }),
          );
        }
        categoryAxis.data.setAll(rows);
        series.data.setAll(rows);
        if (!reduced) series.appear(400);
      }
    } catch (error) {
      root.dispose();
      throw error;
    }
    return () => root.dispose();
  }, [title, kind, valuesKey, unit, maximum, decimals, dark, reduced]);

  const height =
    kind === "bars"
      ? Math.min(720, Math.max(340, values.length * 42 + 90))
      : 400;
  return (
    <div
      ref={element}
      className="am-chart"
      style={{ height }}
      data-chart-kind={kind}
    />
  );
}
