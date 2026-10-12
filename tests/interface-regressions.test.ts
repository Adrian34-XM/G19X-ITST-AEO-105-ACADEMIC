import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Workspace } from "../src/components/workspace";
import { StatusText } from "../src/components/status-text";
import { pendingTrainingReview } from "../src/modules/workspace/training-review";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, push() {} }),
  useSearchParams: () => new URLSearchParams(),
}));
it.each(["departments", "positions", "users"])(
  "renderiza %s sin pasar objetos a React",
  (view) => {
    const html = renderToStaticMarkup(
      createElement(Workspace, {
        path: ["admin", view],
        profile: {
          id: "u",
          full_name: "Admin",
          email: "demo@test.local",
          role: "SUPERUSER",
        },
        data: {
          profiles: [
            {
              id: "u",
              full_name: "Admin",
              email: "demo@test.local",
              role: "SUPERUSER",
            },
          ],
          departments: [{ id: "d", name: "Tecnología" }],
          positions: [{ id: "p", name: "Desarrollador", department_id: "d" }],
        },
      }),
    );
    expect(html).toContain("<table>");
  },
);
it("traduce estados de IA a etiquetas conservando el resto del texto", () => {
  const html = renderToStaticMarkup(
    createElement(StatusText, {
      text: "Tareas PENDING, IN_PROGRESS y APPROVED: 4.",
    }),
  );
  expect(html).toContain("badge");
  expect(html).toContain("Pendiente");
  expect(html).toContain("En progreso");
  expect(html).not.toContain("PENDING");
  expect(html).toContain(": 4.");
});
it("la vista general del candidato muestra una tarjeta de avance y su campana sin evaluaciones internas", () => {
  const html = renderToStaticMarkup(
    createElement(Workspace, {
      path: ["candidate"],
      profile: {
        id: "candidate-user",
        full_name: "Candidato de prueba",
        email: "fixture@test.invalid",
        role: "CANDIDATO",
      },
      data: {
        candidates: [
          { id: "c", profile_id: "candidate-user", cv_path: "private/cv.pdf" },
        ],
        applications: [
          {
            id: "a",
            candidate_id: "c",
            vacancy_id: "v",
            status: "EN_REVISION",
            applied_at: "2026-10-12T12:00:00Z",
          },
        ],
        vacancies: [
          { id: "v", title: "Vacante de prueba", status: "PUBLISHED" },
        ],
      },
    }),
  );
  expect(html).toContain("Avance de mi postulación");
  expect(html).toContain("Notificaciones de postulaciones");
  expect(html).toContain("Etapa actual");
  expect(html).toContain("Vacante de prueba");
  expect(html).not.toContain("Evaluar candidato");
});
it("un curso completado no es revisable aunque conserve una bandera antigua", () => {
  expect(
    pendingTrainingReview({
      id: "c",
      status: "COMPLETED",
      progress_review_pending: true,
    }),
  ).toBe(false);
  expect(
    pendingTrainingReview({
      id: "c",
      status: "IN_PROGRESS",
      progress_review_pending: true,
    }),
  ).toBe(true);
});
