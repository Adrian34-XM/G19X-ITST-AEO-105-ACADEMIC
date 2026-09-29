/** Indicadores calculados sobre datos autorizados. Personas únicas y actividades son unidades distintas. */
import { z } from "zod";
import { type Snapshot, type Row, value } from "./types";
import { stateLabel } from "./labels";

export const factSelection = z
  .object({
    facts: z.array(z.string()).max(8),
    insufficient: z.boolean(),
  })
  .strict();

/** No incluye nombres personales, documentos, descripciones ni comentarios privados. */
export function activityContext(
  data: Snapshot,
  onlyOnboarding = false,
  today = new Date().toISOString().slice(0, 10),
  tables?: string[],
) {
  const employees = new Map((data.employees ?? []).map((e) => [e.id, e]));
  const plans = new Map((data.onboarding ?? []).map((o) => [o.id, o]));
  const positions = new Map((data.positions ?? []).map((p) => [p.id, p]));
  const departments = new Map((data.departments ?? []).map((d) => [d.id, d]));
  const definitions = [
    {
      table: "onboarding_items",
      label: "Incorporación",
      completed: ["COMPLETED"],
    },
    ...(!onlyOnboarding
      ? [
          {
            table: "tasks",
            label: "Tareas",
            completed: ["APPROVED", "CANCELLED"],
          },
          {
            table: "course_assignments",
            label: "Capacitación",
            completed: ["COMPLETED", "CANCELLED"],
          },
        ]
      : []),
  ];
  const facts: { id: string; text: string }[] = [];
  const metrics = definitions
    .filter((d) => !tables || tables.includes(d.table))
    .map(({ table, label, completed }) => {
      const groups = new Map<
        string,
        {
          name: string;
          rows: Row[];
          people: Set<string>;
          pending: Set<string>;
          pendingCount: number;
          overdue: number;
        }
      >();
      let unresolved = 0;
      for (const row of data[table] ?? []) {
        const employeeId =
          table === "onboarding_items"
            ? plans.get(String(row.onboarding_id))?.employee_id
            : row.employee_id;
        const person = employees.get(String(employeeId));
        if (!person) {
          unresolved++;
          continue;
        }
        const department = departments.get(
          String(positions.get(String(person.position_id))?.department_id),
        );
        const key = department?.id ?? "unknown";
        if (!groups.has(key))
          groups.set(key, {
            name: department
              ? value(department, "name")
              : "Sin área identificable",
            rows: [],
            people: new Set(),
            pending: new Set(),
            pendingCount: 0,
            overdue: 0,
          });
        const group = groups.get(key)!;
        group.rows.push(row);
        group.people.add(person.id);
        if (!completed.includes(value(row, "status"))) {
          group.pending.add(person.id);
          group.pendingCount++;
          if (
            row.status !== "SUBMITTED" &&
            value(row, "due_date") &&
            value(row, "due_date") < today
          )
            group.overdue++;
        }
      }
      const areas = [...groups.values()]
        .map((g) => ({
          area: g.name,
          people: g.people.size,
          activities: g.rows.length,
          peopleWithOpenActivities: g.pending.size,
          openActivities: g.pendingCount,
          overdueActivities: g.overdue,
          states: Object.fromEntries(
            [...new Set(g.rows.map((r) => value(r, "status")))].map(
              (status) => [
                stateLabel(status),
                g.rows.filter((r) => r.status === status).length,
              ],
            ),
          ),
        }))
        .sort(
          (a, b) =>
            b.peopleWithOpenActivities - a.peopleWithOpenActivities ||
            a.area.localeCompare(b.area),
        );
      const totalPeople = new Set(
        [...groups.values()].flatMap((g) => [...g.people]),
      ).size;
      facts.push({
        id: `${table}:total`,
        text: `${label}: ${totalPeople} personas con ${areas.reduce((n, a) => n + a.activities, 0)} actividades en los datos consultados. Las actividades no equivalen al número de personas.`,
      });
      areas.forEach((a, index) => {
        facts.push({
          id: `${table}:area:${index}`,
          text: `${a.area}: ${a.peopleWithOpenActivities} personas con ${a.openActivities} actividades sin finalizar de ${label.toLowerCase()}; ${a.overdueActivities} actividades fuera de plazo. Estados de las actividades: ${Object.entries(
            a.states,
          )
            .map(([s, n]) => `${s}: ${n}`)
            .join(", ")}.`,
        });
      });
      const maximum = Math.max(
        0,
        ...areas
          .filter((a) => a.area !== "Sin área identificable")
          .map((a) => a.peopleWithOpenActivities),
      );
      const leaders = areas.filter(
        (a) =>
          a.area !== "Sin área identificable" &&
          a.peopleWithOpenActivities === maximum,
      );
      facts.push({
        id: `${table}:ranking`,
        text: maximum
          ? `${leaders.length > 1 ? "Hay empate entre las áreas" : "El área con más personas con actividades sin finalizar es"} ${leaders.map((a) => `${a.area} (${a.peopleWithOpenActivities} personas y ${a.openActivities} actividades)`).join(", ")} en ${label.toLowerCase()}. Se cuenta a cada persona una sola vez por área.`
          : `No hay personas con actividades sin finalizar de ${label.toLowerCase()} en las áreas identificables del conjunto consultado.`,
      });
      if (!Array.isArray(data[table])) {
        facts.splice(facts.findIndex((f) => f.id === `${table}:total`));
        facts.push({
          id: `${table}:unavailable`,
          text: `No hay datos disponibles para consultar ${label.toLowerCase()}; esto no significa que no existan actividades.`,
        });
      }
      return {
        process: label,
        available: Array.isArray(data[table]),
        unresolvedRecords: unresolved,
        areas,
      };
    });
  return {
    asOf: today,
    definitions:
      "Área = departamento del puesto. Personas = empleados únicos. Actividades sin finalizar incluyen pendientes, en progreso y entregadas a revisión. Los estados cuentan actividades. Una fecha de creación no describe un historial de cambios.",
    limitations:
      "Solo datos autorizados y filtrados, máximo 1000 registros cargados por tabla. No contiene causas, productividad histórica, contenido de documentos, encuestas ni información externa. Los registros sin empleado identificable se excluyen de conteos de personas y se reportan aparte.",
    metrics,
    facts,
  };
}

/** La IA selecciona hechos existentes; el servidor redacta las cifras sin aceptar números inventados. */
export function selectedFactSummary(
  context: ReturnType<typeof activityContext>,
  selection: z.infer<typeof factSelection>,
) {
  const chosen = [...new Set(selection.facts)]
    .map((id) => context.facts.find((f) => f.id === id))
    .filter((f) => !!f);
  if (selection.insufficient) {
    return {
      summary:
        "No hay información suficiente en los datos disponibles para responder a esa solicitud. Puedo consultar cantidades, estados y distribución de actividades por áreas, pero no determinar causas personales, reconstruir cambios históricos ni consultar documentos o información fuera de este análisis.",
      recommendations: [] as string[],
    };
  }
  return {
    summary:
      chosen.map((f) => f.text).join("\n\n") +
      (selection.insufficient ||
      chosen.length !== new Set(selection.facts).size ||
      !chosen.length
        ? "\n\nNo hay información suficiente en los datos disponibles para responder completamente a esa solicitud. Puedes consultar cantidades, estados y distribución por áreas; para causas, nombres o detalles de documentos se necesita otra consulta autorizada."
        : "") +
      (context.metrics.some(
        (m) =>
          m.unresolvedRecords > 0 ||
          m.areas.some((a) => a.area === "Sin área identificable"),
      )
        ? "\n\nHay registros sin persona o área identificable. La comparación solo cubre los registros relacionados con áreas conocidas."
        : ""),
    recommendations: [] as string[],
  };
}
