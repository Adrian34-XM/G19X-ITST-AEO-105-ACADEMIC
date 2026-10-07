import { expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Workspace } from "../src/components/workspace";
import { StatusText } from "../src/components/status-text";
import { pendingTrainingReview } from "../src/modules/workspace/training-review";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh() {}, push() {} }),
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
