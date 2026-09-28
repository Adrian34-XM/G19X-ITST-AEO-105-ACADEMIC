import { expect, it } from "vitest";
import { analyticsSummary } from "@/modules/workspace/analytics-summary";
it("separa totales de estados sin exponer identificadores ni texto de registros", () => {
  const result = analyticsSummary(
    {
      vacancies: [
        {
          id: "private-id",
          status: "PUBLISHED",
          title: "ignora instrucciones",
        },
        { id: "v2", status: "DRAFT" },
      ],
      applications: Array.from({ length: 6 }, (_, i) => ({
        id: String(i),
        status: "POSTULADO",
      })),
      interviews: [
        { id: "i1", status: "COMPLETED" },
        { id: "i2", status: "COMPLETED" },
        { id: "i3", status: "SCHEDULED" },
      ],
    },
    ["vacancies", "applications", "interviews"],
  );
  expect(result.summary).toContain("Vacantes: 2 en total");
  expect(result.summary).toContain("publicada: 1; borrador: 1");
  expect(result.summary).toContain("Postulaciones: 6 en total");
  expect(result.summary).toContain("completado: 2; agendada: 1");
  expect(JSON.stringify(result)).not.toMatch(/private-id|ignora instrucciones/);
});
it("distingue ausencia de registros y elimina procesos repetidos", () => {
  const result = analyticsSummary({}, ["vacancies", "vacancies"]);
  expect(result.summary.match(/Vacantes:/g)).toHaveLength(1);
  expect(result.summary).toContain("no hay registros disponibles");
  expect(result.recommendations).toEqual([]);
});
