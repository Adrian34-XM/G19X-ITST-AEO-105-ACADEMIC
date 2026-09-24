/** Verifica el umbral inclusivo, orden y enlaces hacia las tarjetas de postulantes. */
import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ApplicationSummary,
  recommendedApplications,
  rankApplications,
} from "../src/components/application-summary";
const result = (score: number) => ({
  score,
  match_level: "HIGH",
  summary: "Perfil de prueba",
  strengths: [],
  gaps: [],
});
const applications = [
  {
    id: "a",
    candidate_id: "c",
    vacancy_id: "v",
    status: "POSTULADO",
    ai_result: result(70),
  },
  {
    id: "b",
    candidate_id: "d",
    vacancy_id: "v",
    status: "POSTULADO",
    ai_result: result(95),
  },
  { id: "c", vacancy_id: "v", status: "RECHAZADO", ai_result: result(100) },
  { id: "d", vacancy_id: "v", status: "POSTULADO", ai_result: null },
];
it("incluye varios candidatos desde el mínimo y excluye descartados y pendientes", () => {
  expect(
    recommendedApplications(applications, 70).map((r) => r.application.id),
  ).toEqual(["b", "a"]);
  expect(
    recommendedApplications(applications, 71).map((r) => r.application.id),
  ).toEqual(["b"]);
  expect(recommendedApplications(applications, 100)).toEqual([]);
});
it("muestra conteos por vacante y enlaces a cada tarjeta recomendada", () => {
  const html = renderToStaticMarkup(
    createElement(ApplicationSummary, {
      data: {
        applications,
        vacancies: [
          { id: "v", title: "Desarrollo" },
          { id: "v2", title: "Diseño" },
        ],
        candidates: [],
        profiles: [],
      },
      applications,
      selected: "",
      select: () => {},
      busy: false,
      openCv: async () => {},
    }),
  );
  expect(html).toContain("Desarrollo (3)");
  expect(html).toContain("Diseño (0)");
  expect(html).toContain('href="#postulacion-a"');
  expect(html).toContain('href="#postulacion-b"');
  expect(html).not.toContain('href="#postulacion-c"');
});

it("el historial de rechazados cuenta solo ese estado y oculta recomendaciones", () => {
  const html = renderToStaticMarkup(
    createElement(ApplicationSummary, {
      data: { applications, vacancies: [{ id: "v", title: "Desarrollo" }] },
      applications,
      status: "RECHAZADO",
      selected: "",
      select: () => {},
      busy: false,
      openCv: async () => {},
    }),
  );
  expect(html).toContain("Desarrollo (1)");
  expect(html).toContain("Historial de rechazados");
  expect(html).not.toContain("Candidatos recomendados");
});

it("ordena tarjetas por puntuación válida y deja pendientes al final sin modificar datos", () => {
  const original = applications.map((a) => a.id);
  expect(rankApplications(applications).map((a) => a.id)).toEqual([
    "c",
    "b",
    "a",
    "d",
  ]);
  expect(applications.map((a) => a.id)).toEqual(original);
});
