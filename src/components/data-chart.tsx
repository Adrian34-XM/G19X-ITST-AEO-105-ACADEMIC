"use client";

import {
  Component,
  createElement,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { DataChartProps } from "@/lib/charts/data";
import { createChartModuleLoader } from "@/lib/charts/module-loader";
import { LoadingStatus } from "./loading-skeleton";

// amCharts se descarga al mostrar una gráfica y nunca se ejecuta durante SSR.
const chartModule = createChartModuleLoader(() => import("./am-chart"));

function AmChart(props: DataChartProps) {
  const state = useSyncExternalStore(
    chartModule.subscribe,
    chartModule.getSnapshot,
    chartModule.getServerSnapshot,
  );
  useEffect(() => {
    chartModule.load();
  }, []);
  if (state.status === "ready") return createElement(state.component, props);
  if (state.status === "error")
    return (
      <div role="status">
        <p>
          No se pudo cargar la gráfica a tiempo. Tus datos y el análisis se
          conservan.
        </p>
        <button
          type="button"
          className="secondary"
          onClick={() => chartModule.load()}
        >
          Reintentar gráfica
        </button>
      </div>
    );
  return <LoadingStatus label="Cargando gráfica interactiva" />;
}

class ChartBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="status">
        <p>
          No se pudo dibujar la gráfica. Puedes consultar las cifras debajo.
        </p>
        <button
          type="button"
          className="secondary"
          onClick={() => this.setState({ failed: false })}
        >
          Reintentar gráfica
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Conserva una alternativa HTML legible, incluso si canvas o la descarga fallan. */
export function DataChart(props: DataChartProps) {
  const { title, values, unit = "registros", decimals = 0 } = props;
  const format = (value: number) =>
    value.toLocaleString("es-MX", {
      maximumFractionDigits: decimals,
    });
  return (
    <div className="data-chart">
      {values.length && values.some((v) => v.count > 0) ? (
        <ChartBoundary key={JSON.stringify([props.kind, values])}>
          <AmChart {...props} />
        </ChartBoundary>
      ) : (
        <p>Sin datos con estos filtros.</p>
      )}
      {!!values.length && (
        <details className="data-chart-table">
          <summary>Ver datos de la gráfica</summary>
          <div className="table-scroll">
            <table>
              <caption>{title}</caption>
              <thead>
                <tr>
                  <th scope="col">Categoría</th>
                  <th scope="col">{unit}</th>
                </tr>
              </thead>
              <tbody>
                {values.map((v, i) => (
                  <tr key={i}>
                    <th scope="row">{v.label}</th>
                    <td>{format(v.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
