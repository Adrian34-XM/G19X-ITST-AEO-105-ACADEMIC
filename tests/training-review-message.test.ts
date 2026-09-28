import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TrainingReviewMessage } from "@/components/training-evidence";
it("muestra el rechazo con las instrucciones literales y el responsable", () => {
  const html = renderToStaticMarkup(
    createElement(TrainingReviewMessage, {
      assignment: {
        id: "a",
        status: "IN_PROGRESS",
        reviewed_at: "2026-09-25T12:00:00Z",
        evidence_required_after: "2026-09-25T12:00:00Z",
        review_comments:
          "Adjunta el ejercicio resuelto.\nIncluye el resultado esperado.",
      },
      reviewer: "Diego Herrera",
    }),
  );
  expect(html).toContain("Evidencia rechazada");
  expect(html).toContain("Diego Herrera");
  expect(html).toContain(
    "Adjunta el ejercicio resuelto.\nIncluye el resultado esperado.",
  );
  expect(html).toContain("nueva evidencia corregida");
});
it("no confunde una aprobación posterior con el rechazo anterior", () => {
  const html = renderToStaticMarkup(
    createElement(TrainingReviewMessage, {
      assignment: {
        id: "a",
        status: "IN_PROGRESS",
        reviewed_at: "2026-09-26T12:00:00Z",
        evidence_required_after: "2026-09-25T12:00:00Z",
        review_comments: "Corrección aceptada",
      },
    }),
  );
  expect(html).not.toContain("Evidencia rechazada");
  expect(html).toContain("Corrección aceptada");
});
