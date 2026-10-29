import { describe, expect, it } from "vitest";
import {
  asksAboutDocuments,
  asksAboutEvidence,
  emptyEvidenceAnswer,
  inventedTitles,
  onboardingFollowUpFacts,
  taskFollowUpFacts,
} from "@/modules/workspace/follow-up-facts";

const today = "2026-10-22";
const data = {
  tasks: [
    {
      id: "approved",
      employee_id: "e1",
      title: "Prueba de subida 2026-09-15T15:39:17.017Z",
      status: "APPROVED",
      priority: "LOW",
      due_date: "2026-09-22",
    },
    {
      id: "late",
      employee_id: "e1",
      title: "Documentar el entorno de desarrollo",
      status: "PENDING",
      priority: "HIGH",
      due_date: "2026-09-29",
    },
    {
      id: "review",
      employee_id: "e1",
      title: "Desarrollar modulo para calculo de nomina",
      status: "SUBMITTED",
      priority: "MEDIUM",
      due_date: "2026-10-02",
    },
    {
      id: "soon",
      employee_id: "e1",
      title: "Preparar demo",
      status: "IN_PROGRESS",
      priority: "MEDIUM",
      due_date: "2026-10-25",
    },
  ],
  task_evidence: [
    { id: "ev-old", task_id: "approved", created_at: "2026-09-15T16:20:00Z" },
    { id: "ev-new", task_id: "review", created_at: "2026-10-20T10:00:00Z" },
  ],
  onboarding: [{ id: "plan", employee_id: "e1", status: "IN_PROGRESS" }],
  onboarding_items: [
    {
      id: "i1",
      onboarding_id: "plan",
      title: "Firmar contrato",
      status: "COMPLETED",
      due_date: "2026-09-01",
    },
    {
      id: "i2",
      onboarding_id: "plan",
      title: "Curso de seguridad",
      status: "PENDING",
      due_date: "2026-10-10",
    },
  ],
  onboarding_documents: [
    { id: "d1", onboarding_id: "plan", created_at: "2026-08-01T00:00:00Z" },
  ],
};

describe("hechos de seguimiento de tareas", () => {
  const facts = taskFollowUpFacts(data, today, 7);
  it("cierra aprobadas, calcula días de atraso y antigüedad real de evidencias", () => {
    const byTitle = Object.fromEntries(facts.tasks.map((t) => [t.title, t]));
    expect(byTitle["Prueba de subida 2026-09-15T15:39:17.017Z"]).toMatchObject({
      closed: true,
      overdue_days: 0,
      follow_up: null,
    });
    expect(byTitle["Documentar el entorno de desarrollo"]).toMatchObject({
      closed: false,
      overdue_days: 23,
      follow_up: "vencida hace 23 días",
    });
    expect(byTitle["Desarrollar modulo para calculo de nomina"].follow_up).toBe(
      "entregada, pendiente de revisión",
    );
    expect(byTitle["Preparar demo"].follow_up).toBe("vence en 3 días");
    expect(facts.recent_evidence).toEqual([
      expect.objectContaining({
        task_title: "Desarrollar modulo para calculo de nomina",
        days_ago: 2,
        pending_review: true,
        content_read: false,
      }),
    ]);
    expect(facts.rules).toMatch(/NUNCA requiere seguimiento/);
  });
  it("sin evidencias en el periodo responde con una frase verdadera y sin modelo", () => {
    const empty = taskFollowUpFacts(
      { ...data, task_evidence: [data.task_evidence[0]] },
      today,
      7,
    );
    expect(empty.recent_evidence).toHaveLength(0);
    expect(emptyEvidenceAnswer("evidencias", 7, true, 1)).toBe(
      "No hay evidencias entregadas en los últimos 7 días con los filtros actuales, así que no hay nada reciente que requiera seguimiento. Sí hay 1 registro entregado pendiente de revisión de fechas anteriores.",
    );
    expect(emptyEvidenceAnswer("documentos", 30, false, 0)).toMatch(
      /No se dispone del listado de documentos/,
    );
  });
});

describe("hechos de seguimiento de incorporación", () => {
  it("marca completadas como cerradas y excluye documentos antiguos", () => {
    const facts = onboardingFollowUpFacts(data, today, 30);
    expect(
      facts.items.find((i) => i.title === "Firmar contrato"),
    ).toMatchObject({ closed: true, follow_up: null });
    expect(
      facts.items.find((i) => i.title === "Curso de seguridad"),
    ).toMatchObject({ overdue_days: 12, follow_up: "vencida hace 12 días" });
    expect(facts.recent_documents).toHaveLength(0);
    expect(facts.documents_available).toBe(true);
  });
});

describe("detección de preguntas y de títulos inventados", () => {
  it("reconoce preguntas sobre evidencias y documentos", () => {
    expect(
      asksAboutEvidence(
        "Resume las evidencias entregadas recientemente y señala cuáles requieren seguimiento.",
      ),
    ).toBe(true);
    expect(asksAboutEvidence("¿Qué tareas vencen esta semana?")).toBe(false);
    expect(
      asksAboutDocuments("¿Qué documentos faltan por entregar a los nuevos?"),
    ).toBe(true);
  });
  it("acepta títulos reales con otra ortografía y rechaza los inexistentes", () => {
    const known = data.tasks.map((t) => t.title);
    expect(
      inventedTitles(
        "Revisa «Documentar el entorno de desarrollo» y 'desarrollar módulo para cálculo de nómina'.",
        known,
      ),
    ).toEqual([]);
    expect(
      inventedTitles(
        "La tarea «Migrar la base de datos» sigue pendiente.",
        known,
      ),
    ).toEqual(["Migrar la base de datos"]);
  });
  it("no confunde una etiqueta de estado entrecomillada con un título inventado", () => {
    const known = data.tasks.map((t) => t.title);
    expect(
      inventedTitles(
        "Dos tareas siguen «En revisión» y una está «En progreso».",
        known,
      ),
    ).toEqual([]);
  });
});
