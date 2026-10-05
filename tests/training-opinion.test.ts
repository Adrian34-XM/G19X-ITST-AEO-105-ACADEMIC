import { it, expect } from "vitest";
import {
  reviewTrainingOpinion,
  verifiedTrainingOpinion,
} from "@/lib/ai/training-opinion";
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

it("los faltantes no introducen requisitos inventados por el modelo", () => {
  const result = verifiedTrainingOpinion(
    {
      summary: "Falta evidencia para verificar el avance.",
      demonstrated: [],
      missing: [
        "Agenda una presentación con tu equipo.",
        "Obtén una certificación pagada de 5000 pesos.",
      ],
      recommendation: "SUFFICIENT",
    },
    "Agenda una presentación con tu equipo y revisa los objetivos de tu puesto.",
  );
  expect(result.missing).toEqual(["Agenda una presentación con tu equipo."]);
  expect(result.recommendation).toBe("MORE_EVIDENCE");
});
it("sin requisitos disponibles no atribuye obligaciones nuevas al curso", () => {
  const result = verifiedTrainingOpinion(
    {
      summary: "Hace falta comprobar el avance.",
      demonstrated: [],
      missing: ["Entrega tu identificación personal"],
      recommendation: "HUMAN_REVIEW",
    },
    "",
  );
  expect(result.missing).toEqual([]);
  expect(result.recommendation).toBe("HUMAN_REVIEW");
});
