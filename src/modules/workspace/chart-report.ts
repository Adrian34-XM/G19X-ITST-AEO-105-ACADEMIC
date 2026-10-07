import { z } from "zod";
import { type Chart, chartValues, chartDepartment } from "./workforce-ai";
import { type Snapshot, type Row } from "./types";
import { stateLabel } from "./labels";

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const time = Date.parse(s + "T12:00:00Z");
    return (
      Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === s
    );
  }, "Fecha inválida");
export const chartOptionsSchema = z
  .object({
    period: z
      .enum(["module", "all", "7", "30", "90", "custom"])
      .default("module"),
    from: date.optional(),
    to: date.optional(),
    group: z
      .enum(["auto", "status", "department", "day", "week", "month"])
      .default("auto"),
    compare: z.boolean().default(true),
  })
  .strict()
  .superRefine((o, ctx) => {
    if (
      o.period === "custom" &&
      (!o.from ||
        !o.to ||
        o.from > o.to ||
        Date.parse(o.to) - Date.parse(o.from) > 365 * 86400000)
    )
      ctx.addIssue({
        code: "custom",
        message: "Selecciona un periodo válido de hasta 366 días.",
      });
  });
export type ChartOptions = z.infer<typeof chartOptionsSchema>;
export { chartNarrativeSchema } from "@/lib/ai/chart-narrative";
const unit = {
  tasks: "tareas",
  course_assignments: "capacitaciones",
  onboarding: "incorporaciones",
  applications: "postulaciones",
  vacancies: "vacantes",
  interviews: "entrevistas",
};
const shift = (d: string, days: number) =>
  new Date(Date.parse(d + "T12:00:00Z") + days * 86400000)
    .toISOString()
    .slice(0, 10);
export function reportingDay(raw: unknown): string {
  const s = String(raw ?? "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return date.safeParse(s).success ? s : "";
  const parsed = new Date(s);
  if (!s || !Number.isFinite(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}
export type ChartReport = ReturnType<typeof buildChartReport>;
/** Expande una configuración en una gráfica por área sin ampliar el alcance ni mezclar periodos. */
export function buildChartReports(
  data: Snapshot,
  charts: Chart[],
  options: ChartOptions,
  scope: { days?: string; description?: string } = {},
  today = reportingDay(new Date().toISOString()),
): ChartReport[] {
  const aliasAreas = (data.departments ?? [])
    .filter((d) => /\d/.test(String(d.name ?? "")))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
  const expanded = charts.flatMap((chart) => {
    if (chart.splitBy !== "department")
      return [buildChartReport(data, chart, options, scope, today)];
    const rows = data[chart.dataset] ?? [];
    const areaRows = new Map<string, Row[]>();
    for (const row of rows) {
      const id = chartDepartment(data, chart.dataset, row)?.id ?? "";
      areaRows.set(id, [...(areaRows.get(id) ?? []), row]);
    }
    const facets = (data.departments ?? []).map((d) => ({
      id: d.id,
      name: String(d.name ?? "Área sin nombre"),
    }));
    if (areaRows.has("")) facets.push({ id: "", name: "Sin área visible" });
    // Un catálogo vacío no impide comunicar que no hay datos disponibles.
    if (!facets.length) facets.push({ id: "", name: "Sin área visible" });
    return facets
      .sort((a, b) => a.name.localeCompare(b.name, "es"))
      .map((area) => {
        const selected = areaRows.get(area.id) ?? [];
        const commonScope = /^(Todas las áreas autorizadas|Área:)/.test(
          scope.description ?? "",
        )
          ? scope.description?.split(" · ").slice(1).join(" · ")
          : scope.description;
        const report = buildChartReport(
          {
            ...data,
            ...(Array.isArray(data[chart.dataset])
              ? { [chart.dataset]: selected }
              : {}),
          },
          {
            ...chart,
            group:
              chart.group === "department" && options.group === "auto"
                ? "status"
                : chart.group,
          },
          options,
          {
            ...scope,
            description: `Área: ${area.name} · ${commonScope || "Filtros seleccionados"}`,
          },
          today,
        );
        const aliasIndex = aliasAreas.findIndex((d) => d.id === area.id);
        return {
          ...report,
          title: `${report.title} · ${area.name}`,
          report: {
            ...report.report,
            area: area.name,
            areaAlias:
              aliasIndex >= 0
                ? `Área${/prueba|test|simulad/i.test(area.name) ? " de prueba" : ""} ${String.fromCharCode(65 + aliasIndex)}`
                : null,
          },
        };
      })
      .sort(
        (a, b) =>
          b.report.total - a.report.total ||
          a.title.localeCompare(b.title, "es"),
      );
  });
  return expanded;
}

/** Solo se envían cifras verificadas del resultado final: sin identidades, archivos ni textos privados. */
export function chartNarrativeContext(charts: ChartReport[]) {
  return charts
    .map((c) => {
      const area = c.report.area ?? null;
      const maximum = Math.max(0, ...c.values.map((v) => v.count));
      return {
        total: c.report.total,
        facts: [
          `La fecha utilizada en esta vista es la ${c.report.period.dateDescription}. Se muestran estados actuales; no es un historial de cambios de estado ni una evaluación de personas.`,
          `${c.report.available ? (c.report.total ? `sí hay registros: ${c.report.total} ${unit[c.dataset]}. Distribución: ${c.values.map((v) => `${v.label}: ${v.count}`).join("; ")}.` : `no hay ${unit[c.dataset]} con los filtros y el periodo de esta gráfica.`) : "no se dispone de esta tabla, no equivale a ausencia de actividad."}`,
          ...(maximum > 0
            ? [
                `${c.values.filter((v) => v.count === maximum).length > 1 ? "Hay empate en el mayor conteo entre" : "El único estado o intervalo con mayor conteo es"}: ${c.values
                  .filter((v) => v.count === maximum)
                  .map((v) => v.label)
                  .join(" y ")}. Los demás estados no predominan.`,
              ]
            : []),
          ...(c.report.comparison
            ? [
                `El volumen TOTAL de registros ${c.report.comparison.difference > 0 ? "aumentó" : c.report.comparison.difference < 0 ? "disminuyó" : "no cambió"} frente al periodo anterior de igual duración. No conocemos cambios por estado dentro del periodo anterior.`,
              ]
            : []),
        ].map(
          (fact) =>
            `${c.report.areaAlias ?? area ?? "Ámbito filtrado"} (${unit[c.dataset]}): ${fact}`,
        ),
        process: unit[c.dataset],
        area: c.report.areaAlias ?? area,
        grouping: c.group,
        date_meaning: c.report.period.dateDescription,
        available: c.report.available,
        has_records_in_period: c.report.total > 0,
        groups: c.values.map((v) => ({
          label: v.label.replace(/\d{6,}/g, "(registro de prueba)"),
          has_records: v.count > 0,
          tied_for_largest: v.count > 0 && v.count === maximum,
          more_than_half: v.count > c.report.total / 2,
        })),
        comparison: c.report.comparison
          ? {
              direction:
                c.report.comparison.difference > 0
                  ? "mayor volumen que en el periodo anterior"
                  : c.report.comparison.difference < 0
                    ? "menor volumen que en el periodo anterior"
                    : "mismo volumen que en el periodo anterior",
              previous_had_records: c.report.comparison.total > 0,
            }
          : null,
        has_records_missing_dates: c.report.missingDates > 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}
/** Las descripciones y comparaciones se calculan con el mismo conjunto autorizado que las gráficas. */
export function buildChartReport(
  data: Snapshot,
  proposed: Chart,
  options: ChartOptions,
  scope: { days?: string; description?: string } = {},
  today = reportingDay(new Date().toISOString()),
) {
  const chart = {
    ...proposed,
    ...(options.group !== "auto" ? { group: options.group } : {}),
  };
  // Solo los cursos cuentan con fecha de finalización verificada en estas tablas.
  const field =
    chart.dataset === "applications"
      ? "applied_at"
      : chart.dataset === "course_assignments" &&
          chart.dateField === "completed_at"
        ? "completed_at"
        : "created_at";
  const dateDescription =
    field === "completed_at"
      ? "fecha de finalización validada"
      : field === "applied_at"
        ? "fecha de postulación o reactivación"
        : "fecha de creación";
  const periodDays = ["7", "30", "90"].includes(options.period)
    ? Number(options.period)
    : options.period === "module"
      ? (chart.days ??
        (scope.days && scope.days !== "all" ? Number(scope.days) : 0))
      : 0;
  let from =
    options.period === "custom"
      ? options.from
      : periodDays
        ? shift(today, 1 - periodDays)
        : undefined;
  const to =
    options.period === "custom" && options.to! < today ? options.to! : today;
  // La selección explícita de fechas nunca amplía el periodo del filtro del módulo.
  if (scope.days && scope.days !== "all") {
    const boundary = shift(today, 1 - Number(scope.days));
    from = from && from > boundary ? from : boundary;
  }
  const rows = data[chart.dataset] ?? [];
  const normalized = rows.map((r) => ({
    ...r,
    [field]: reportingDay(r[field]),
  }));
  const relevant = normalized.filter(
    (r) => !chart.status || r.status === chart.status,
  );
  const bounded = !!from || ["day", "week", "month"].includes(chart.group);
  const select = (start: string | undefined, end: string): Row[] =>
    normalized.filter((r) => {
      const d = String(r[field]);
      return bounded
        ? !!d && (!start || d >= start) && d <= end
        : !d || d <= end;
    });
  const currentRows = select(from, to);
  const current = { ...data, [chart.dataset]: currentRows };
  const computed = {
    ...chart,
    days: undefined,
    dateField: field as Chart["dateField"],
  };
  const values = chartValues(current, computed, to);
  if (from && from <= to && ["day", "week", "month"].includes(chart.group)) {
    const existing = new Map(values.map((v) => [v.label, v.count]));
    for (let d = from; d <= to; d = shift(d, 1)) {
      const monday = new Date(d + "T12:00:00Z");
      const key =
        chart.group === "month"
          ? d.slice(0, 7)
          : chart.group === "week"
            ? shift(d, -(monday.getUTCDay() + 6) % 7)
            : d;
      if (!existing.has(key)) existing.set(key, 0);
    }
    values.splice(
      0,
      values.length,
      ...[...existing]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, count]) => ({ label, count })),
    );
  }
  const total = values.reduce((s, v) => s + v.count, 0);
  const n =
    from && from <= to
      ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1
      : 0;
  const previousFrom = n ? shift(from!, -n) : undefined;
  const previousTo = n ? shift(from!, -1) : undefined;
  const previousValues =
    options.compare && n
      ? chartValues(
          { ...data, [chart.dataset]: select(previousFrom, previousTo!) },
          computed,
          previousTo,
        )
      : [];
  const previousTotal = previousValues.reduce((s, v) => s + v.count, 0);
  const comparison =
    options.compare && n
      ? {
          from: previousFrom!,
          to: previousTo!,
          total: previousTotal,
          difference: total - previousTotal,
          percent: previousTotal
            ? Math.round(((total - previousTotal) / previousTotal) * 1000) / 10
            : null,
        }
      : null;
  const dominant = [...values].sort((a, b) => b.count - a.count)[0];
  const missingDates = relevant.filter((r) => !r[field]).length;
  const excludedFuture = relevant.filter(
    (r) => String(r[field]) > today,
  ).length;
  const completedState =
    chart.dataset === "tasks"
      ? "APPROVED"
      : chart.dataset === "applications"
        ? "CONTRATADO"
        : "COMPLETED";
  const completed = currentRows.filter(
    (r) => r.status === completedState,
  ).length;
  const pendingReview =
    chart.dataset === "tasks" || chart.dataset === "course_assignments"
      ? currentRows.filter((r) => r.status === "SUBMITTED").length
      : null;
  const observations = [
    `Se cuentan ${total} ${unit[chart.dataset]}${chart.status ? ` con estado actual «${stateLabel(chart.status)}»` : " con su estado actual"}.`,
  ];
  if (dominant?.count)
    observations.push(
      `${["day", "week", "month"].includes(chart.group) ? "El intervalo con mayor volumen" : "La categoría con mayor volumen"} es «${dominant.label}»: ${dominant.count} (${Math.round((dominant.count / total) * 1000) / 10}% del total).`,
    );
  const tied = dominant?.count
    ? values.filter((v) => v.count === dominant.count)
    : [];
  if (tied.length > 1)
    observations.push(
      `Hay ${tied.length} categorías empatadas en ese máximo; no existe una categoría única con mayor volumen.`,
    );
  if (comparison)
    observations.push(
      `Periodo anterior: ${previousTotal}. Diferencia: ${comparison.difference > 0 ? "+" : ""}${comparison.difference}${comparison.percent === null ? "; sin base para calcular variación porcentual" : ` (${comparison.percent > 0 ? "+" : ""}${comparison.percent}%)`}.`,
    );
  if (
    !chart.status &&
    field !== "completed_at" &&
    ["tasks", "course_assignments", "onboarding", "applications"].includes(
      chart.dataset,
    )
  )
    observations.push(
      `${completed} de ${currentRows.length} registros del periodo tienen el estado actual «${stateLabel(completedState)}»${currentRows.length ? ` (${Math.round((completed / currentRows.length) * 1000) / 10}%)` : ""}. Es el estado actual de esa cohorte, no finalizaciones ocurridas durante el periodo.`,
    );
  if (pendingReview !== null && !chart.status)
    observations.push(
      `${pendingReview} entregas de esta cohorte están pendientes de revisión.`,
    );
  if (
    ["tasks", "course_assignments"].includes(chart.dataset) &&
    !chart.status
  ) {
    const overdue = currentRows.filter((r) => {
      const deadline = reportingDay(r.due_date);
      return (
        deadline &&
        deadline < today &&
        !["APPROVED", "COMPLETED", "SUBMITTED"].includes(String(r.status))
      );
    }).length;
    observations.push(
      `${overdue} actividades de esta cohorte tienen plazo vencido y aún no están finalizadas ni entregadas para revisión, al ${today}.`,
    );
  }
  const decisionSupport = !total
    ? [
        "Revisa el periodo, los filtros y las fechas registradas antes de concluir que no existe actividad.",
      ]
    : chart.dataset === "tasks"
      ? [
          "Usa las entregas por revisar para organizar la capacidad de revisión. Antes de redistribuir trabajo, contrasta plazos, prioridad y complejidad de las tareas.",
        ]
      : chart.dataset === "course_assignments"
        ? [
            "Contrasta las capacitaciones pendientes con sus plazos y evidencias para planear seguimiento. El número de cursos no acredita aprendizaje ni calidad.",
          ]
        : [
            "Usa el volumen y su distribución para planear seguimiento y capacidad del proceso. Contrasta plazos y recursos antes de atribuir causas a un aumento o una disminución.",
          ];
  const limitations = [
    "Datos cargados y autorizados, hasta 1000 registros por tabla. Un reporte que alcance ese límite puede estar incompleto, incluido el periodo anterior.",
    "Las comparaciones muestran volúmenes por la fecha indicada y estados actuales; no reconstruyen cambios históricos de estado ni evalúan el desempeño integral de una persona.",
    ...(chart.group === "department"
      ? [
          "Las áreas pueden tener tamaños y cargas distintos. Este conteo no normaliza por personal, horas trabajadas ni complejidad.",
        ]
      : []),
    ...(chart.group === "week" || chart.group === "month"
      ? [
          "El primer y último intervalo pueden ser parciales; compara ventanas completas antes de interpretar tendencias.",
        ]
      : []),
    ...(bounded && missingDates
      ? [
          `Se excluyeron ${missingDates} registros del estado solicitado sin ${dateDescription} válida.`,
        ]
      : []),
    ...(excludedFuture
      ? [
          `Se excluyeron ${excludedFuture} registros con fecha posterior al día de corte.`,
        ]
      : []),
    ...(!n && options.compare
      ? [
          "Selecciona un periodo acotado para compararlo con una ventana anterior de igual duración.",
        ]
      : []),
  ];
  const groupName = {
    status: "estado actual",
    department: "área",
    day: "día",
    week: "semana (lunes a domingo)",
    month: "mes",
  }[chart.group];
  return {
    ...computed,
    title: `${unit[chart.dataset][0].toUpperCase()}${unit[chart.dataset].slice(1)}${chart.status ? ` · ${stateLabel(chart.status)}` : ""} por ${groupName}`,
    values,
    report: {
      area: null as string | null,
      areaAlias: null as string | null,
      description: `Cantidad de ${unit[chart.dataset]}, agrupada por ${groupName}. Cada registro se cuenta una vez; no equivale a personas únicas.`,
      period: {
        from: from ?? null,
        to,
        dateField: field,
        dateDescription,
        timeZone: "America/Mexico_City",
      },
      scope: scope.description ?? "Ámbito autorizado y filtros seleccionados",
      total,
      available: Array.isArray(data[chart.dataset]),
      missingDates,
      comparison,
      observations,
      decisionSupport,
      limitations,
    },
  };
}
