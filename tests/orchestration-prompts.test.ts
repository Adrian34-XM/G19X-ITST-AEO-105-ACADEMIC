/** Contratos de instrucciones sin servidor HTTP, base de datos ni proveedor de IA. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildOrchestrationRequest } from "@/lib/ai/orchestration/request";
import type { OrchestrationRequest } from "@/lib/ai/orchestration/types";
import {
  performanceAdvice,
  performanceInput,
} from "@/lib/ai/orchestration/performance";
import { analyticsNarrativeInput } from "@/lib/ai/orchestration/analytics";
import { taskWritingStyle } from "@/lib/ai/orchestration/tasks";
import { rolePermissionsInstruction } from "@/lib/ai/orchestration/shared";
import { overviewContext } from "@/modules/workspace/overview";
import { insightContext } from "@/modules/workspace/insights";
import { analyticsFacts } from "@/modules/workspace/analytics-summary";
import { currentWeek } from "@/modules/workspace/current-week";
import type { Snapshot } from "@/modules/workspace/types";

const selected: Snapshot = {
  departments: [{ id: "department", name: "Área permitida" }],
  positions: [{ id: "position", department_id: "department" }],
  employees: [
    {
      id: "employee",
      profile_id: "viewer",
      position_id: "position",
      department_id: "department",
    },
  ],
  tasks: [
    {
      id: "pending-task",
      employee_id: "employee",
      title: "TÍTULO_PRIVADO",
      status: "PENDING",
      due_date: "2026-10-01",
    },
    {
      id: "approved-task",
      employee_id: "employee",
      title: "TAREA_APROBADA",
      status: "APPROVED",
    },
  ],
  course_assignments: [
    {
      id: "assignment",
      employee_id: "employee",
      course_id: "course",
      status: "ASSIGNED",
      progress: 0,
    },
  ],
  courses: [{ id: "course", title: "CURSO_PRIVADO" }],
  onboarding: [],
  onboarding_items: [],
};
const areas = [
  "overview",
  "tasks",
  "onboarding",
  "courses",
  "performance",
  "analytics",
] as const;
const roles = ["SUPERUSER", "RH_ADMIN", "JEFE", "EMPLEADO"] as const;
function options(
  overrides: Partial<OrchestrationRequest> = {},
): OrchestrationRequest {
  const area = overrides.area ?? "tasks";
  const profile = overrides.profile ?? {
    id: "viewer",
    role: "RH_ADMIN",
    full_name: "NOMBRE_PRIVADO",
    email: "privado@nexo.test",
  };
  return {
    area,
    profile,
    mode: "analyze",
    prompt: "",
    filters: {},
    authorized: selected,
    selected,
    context:
      area === "overview"
        ? overviewContext(selected, profile, "2026-10-15")
        : insightContext(selected, profile, area, "2026-10-15"),
    week: area === "overview" ? currentWeek() : undefined,
    operationalMetrics: null,
    ...overrides,
  };
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe.each(areas)("contratos separados de %s", (area) => {
  it.each(roles)("conserva alcance, validación y modalidad para %s", (role) => {
    const profile = {
      id: "viewer",
      role,
      full_name: "NOMBRE_PRIVADO",
      email: "privado@nexo.test",
    };
    const analyze = buildOrchestrationRequest(options({ area, profile }));
    expect(analyze.input.request_scope).toEqual({ module: area, prompt: "" });
    expect(analyze.schema.safeParse({ summary: 123 }).success).toBe(false);
    expect(analyze.purpose).toBe(
      area === "analytics"
        ? "selection"
        : area === "performance"
          ? "analytics"
          : "analysis",
    );
    expect(analyze.repairOnce).toBe(area !== "analytics");
    const draft = buildOrchestrationRequest(
      options({ area, profile, mode: "prompt" }),
    );
    expect(draft.purpose).toBe("draft");
    expect(draft.repairOnce).toBe(false);
    expect(
      draft.schema.safeParse({
        prompt: "Revisa las actividades autorizadas y sus plazos.",
      }).success,
    ).toBe(true);
    expect(
      draft.schema.safeParse({
        summary: "Un resumen no es una propuesta de instrucciones.",
      }).success,
    ).toBe(false);
    expect(draft.input.request_scope).toEqual({ module: area, prompt: "" });
  });
});

it("el resumen personal omite finalizadas, identificadores y contexto del equipo", () => {
  const input = options({
    area: "overview",
    profile: {
      id: "viewer",
      role: "EMPLEADO",
      full_name: "Privado",
      email: "privado@nexo.test",
    },
  });
  const plan = buildOrchestrationRequest(input);
  expect(plan.input.personal_records).toMatchObject({
    tasks: [
      { title: "TÍTULO_PRIVADO", status: "Pendiente", due_date: "2026-10-01" },
    ],
  });
  expect(plan.input.data).toBeUndefined();
  expect(plan.input.areas).toBeUndefined();
  expect(plan.input.period).toEqual(currentWeek());
  expect(JSON.stringify(plan.input)).not.toMatch(
    /approved-task|TAREA_APROBADA|privado@nexo\.test|pending-task/,
  );
});

it("la vista general de RH transmite hechos verificados sin filas ni identidad privada", () => {
  const plan = buildOrchestrationRequest(options({ area: "overview" }));
  expect(plan.input.verified_facts).toBeInstanceOf(Array);
  expect(plan.input.data).toBeUndefined();
  expect(JSON.stringify(plan.input)).not.toMatch(
    /TÍTULO_PRIVADO|privado@nexo\.test|pending-task/,
  );
});

it.each(["tasks", "onboarding", "courses"] as const)(
  "el resumen automático de %s solo recibe los agregados filtrados",
  (area) => {
    const table =
      area === "tasks"
        ? "tasks"
        : area === "onboarding"
          ? "onboarding"
          : "course_assignments";
    const metrics = analyticsFacts({ [table]: [] }, [table], "status");
    const input = options({
      area,
      operationalMetrics: metrics,
      filters: { query: "BÚSQUEDA_PRIVADA" },
    });
    const plan = buildOrchestrationRequest(input);
    expect(plan.purpose).toBe("analytics");
    expect(plan.repairOnce).toBe(true);
    expect(plan.input.verified_metrics).toBeInstanceOf(Array);
    expect(plan.input.data).toBeUndefined();
    expect(plan.input.filters).toBeUndefined();
    expect(JSON.stringify(plan.input)).not.toMatch(
      /TÍTULO_PRIVADO|CURSO_PRIVADO|BÚSQUEDA_PRIVADA|privado@nexo\.test/,
    );
    expect(
      plan.schema.safeParse({
        summary: "No hay registros en el conjunto consultado.",
      }).success,
    ).toBe(true);
  },
);

it.each(["tasks", "courses"] as const)(
  "el análisis de %s conserva filtros autorizados sin mutarlos",
  (area) => {
    const filters = {
      department: "department",
      employee: "employee",
      query: "BÚSQUEDA_PRIVADA",
      from: "2026-10-01",
      to: "2026-10-15",
    };
    const input = options({ area, filters });
    const before = structuredClone(input);
    const plan = buildOrchestrationRequest(input);
    expect(plan.input.filters).toEqual({ ...filters, query: undefined });
    expect(plan.input.data).toEqual(input.context.data);
    expect(input).toEqual(before);
    expect(
      plan.schema.safeParse({
        summary: "Revisa las entregas.",
        recommendations: [],
      }).success,
    ).toBe(true);
  },
);

it("desempeño rechaza cifras, diagnósticos y acciones fuera del catálogo permitido", () => {
  for (const result of [
    { summary: "Hay 2 tareas pendientes.", recommendations: [] },
    { summary: "Hay bajo desempeño.", recommendations: [] },
    { summary: "Revisa las entregas.", recommendations: ["DESPEDIR"] },
  ])
    expect(performanceAdvice.safeParse(result).success).toBe(false);
  expect(
    performanceAdvice.safeParse({
      summary: "Revisa las actividades pendientes.",
      recommendations: ["REVISAR_PENDIENTES"],
    }).success,
  ).toBe(true);
  const input = performanceInput(selected, "¿Hay deficiencias de desempeño?");
  expect(input.user_request).not.toContain("deficiencias");
  expect(input.verified_metrics.some((entry) => entry.hay_atrasos)).toBe(true);
  expect(JSON.stringify(input)).not.toContain("TÍTULO_PRIVADO");
});

it("analíticas separa selección sin narrativa y explicación de agregados", () => {
  const plan = buildOrchestrationRequest(
    options({
      area: "analytics",
      filters: { process: "courses" },
      prompt: "Cursos por área",
    }),
  );
  expect(plan.input.process).toBe("courses");
  expect(plan.input.request).toBe("Cursos por área");
  expect(
    plan.schema.safeParse({
      topics: ["course_assignments"],
      breakdown: "department",
    }).success,
  ).toBe(true);
  expect(plan.schema.safeParse({ topics: ["secrets"] }).success).toBe(false);
  const metrics = analyticsFacts(selected, ["course_assignments"], "status");
  const narrative = analyticsNarrativeInput(
    "Compara las capacitaciones",
    metrics,
  );
  expect(narrative.verified_metrics).toBeInstanceOf(Array);
  expect(JSON.stringify(narrative)).not.toMatch(
    /CURSO_PRIVADO|TÍTULO_PRIVADO|privado@nexo\.test/,
  );
});

it("las instrucciones propuestas para desempeño personal no amplían el alcance", () => {
  const plan = buildOrchestrationRequest(
    options({
      area: "performance",
      mode: "prompt",
      profile: {
        id: "viewer",
        role: "EMPLEADO",
        full_name: "Privado",
        email: "privado@nexo.test",
      },
      prompt: "Resume mis pendientes",
    }),
  );
  expect(plan.input.scope).toBe("Solo información propia");
  expect(plan.input.user_request).toBe("Resume mis pendientes");
  expect(JSON.stringify(plan.input)).not.toContain("privado@nexo.test");
});

it("el texto de tareas distingue entrega y aprobación y no promete leer archivos", () => {
  expect(taskWritingStyle).toContain("Distingue entrega de aprobación");
  expect(taskWritingStyle).toContain("este contexto solo incluye metadatos");
});

it.each(["tasks", "onboarding"] as const)(
  "el análisis de %s describe el alcance y las acciones del rol sin ampliar datos",
  (area) => {
    for (const role of roles) {
      const text = rolePermissionsInstruction(area, role);
      expect(text).toContain(`Rol de la sesión: ${role}`);
      if (role === "EMPLEADO") {
        expect(text).toMatch(/únicamente sus propios registros/);
        expect(text).not.toMatch(/Puede crear/);
      }
      if (role === "JEFE") expect(text).toMatch(/su equipo/);
    }
    const employee = {
      id: "viewer",
      role: "EMPLEADO" as const,
      full_name: "NOMBRE_PRIVADO",
      email: "privado@nexo.test",
    };
    const context = insightContext(selected, employee, area, "2026-10-15");
    const tables = Object.keys(context.data);
    if (area === "onboarding") {
      expect(tables).toEqual(
        expect.arrayContaining(["onboarding", "onboarding_items"]),
      );
      expect(tables).not.toContain("tasks");
    } else expect(tables).toContain("tasks");
    expect(context.data.employees.every((e) => e.id === "employee")).toBe(true);
  },
);
