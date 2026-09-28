import { it, expect } from "vitest";
import { reviewTrainingOpinion } from "@/lib/ai/training-opinion";
it("ofrece un resumen breve y elimina la frase final inconclusa", () => {
  const result = reviewTrainingOpinion({
    summary:
      "La captura muestra un avance registrado. No permite comprobar el ejercicio realizado. Se requiere",
    demonstrated: ["PENDING", "PENDING"],
    missing: ["Objetivo y resultados"],
    recommendation: "SUFFICIENT",
  });
  expect(result.summary).toBe(
    "La captura muestra un avance registrado. No permite comprobar el ejercicio realizado.",
  );
  expect(result.recommendation).toBe("MORE_EVIDENCE");
  expect(result.demonstrated).toEqual(["pendiente"]);
});
it("usa una conclusión coherente cuando no hay ninguna frase completa", () => {
  const result = reviewTrainingOpinion({
    summary: "Se requiere",
    demonstrated: [],
    missing: ["Ejercicio resuelto"],
    recommendation: "HUMAN_REVIEW",
  });
  expect(result.summary).toContain("revisión del responsable");
  expect(result.summary.endsWith(".")).toBe(true);
});
