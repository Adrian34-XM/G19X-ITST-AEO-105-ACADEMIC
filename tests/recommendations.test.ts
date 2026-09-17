/**
 * Comprueba el contenido renderizado de recomendaciones: orden, separación por vacante y exclusión de resultados inválidos o postulaciones descartadas.
 */
import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecruitmentRecommendations } from "../src/components/recruitment-recommendations";
const result = (score: number) => ({
  score,
  match_level: "HIGH",
  summary: "Evaluación ficticia",
  strengths: ["React"],
  gaps: ["SQL"],
});
describe("Recomendaciones por vacante", () => {
  it("ordena resultados válidos, deja pendientes y excluye otras vacantes y descartados", () => {
    const people = ["Menor", "Mayor", "Pendiente", "Descartado", "Otra"];
    const html = renderToStaticMarkup(
      createElement(RecruitmentRecommendations, {
        busy: false,
        analyze: async () => {},
        initialVacancy: "v1",
        data: {
          vacancies: [{ id: "v1", title: "Ingeniería" }],
          profiles: people.map((full_name, i) => ({ id: `p${i}`, full_name })),
          candidates: people.map((_, i) => ({
            id: `c${i}`,
            profile_id: `p${i}`,
          })),
          applications: people.map((_, i) => ({
            id: `a${i}`,
            candidate_id: `c${i}`,
            vacancy_id: i === 4 ? "v2" : "v1",
            status: i === 3 ? "RECHAZADO" : "POSTULADO",
            ai_result:
              i === 0
                ? result(60)
                : i === 1
                  ? result(90)
                  : i === 2
                    ? { score: 999 }
                    : null,
          })),
        },
      }),
    );
    expect(html.indexOf("Mayor")).toBeLessThan(html.indexOf("Menor"));
    expect(html.indexOf("Menor")).toBeLessThan(html.indexOf("Pendiente"));
    expect(html).not.toContain("Descartado");
    expect(html).not.toContain(">Otra<");
    expect(html).not.toContain("999/100");
    expect(html).toContain("Evaluar con IA");
  });
});
