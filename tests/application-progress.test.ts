import { expect, it } from "vitest";
import {
  ownApplicationUpdates,
  progressStages,
} from "@/modules/workspace/application-progress";

const log = {
  id: "change",
  resource_id: "own",
  resource_type: "applications",
  action: "UPDATE",
  metadata: {
    previous_status: "POSTULADO",
    new_status: "EN_REVISION",
    reviewer: "private",
    ai_result: { score: 90 },
  },
  created_at: "2026-10-12T12:00:00Z",
};
it("proyecta solo cambios propios sin actores, comentarios ni evaluación interna", () => {
  const result = ownApplicationUpdates(
    [log, { ...log, id: "foreign", resource_id: "other" }],
    new Set(["own"]),
  );
  expect(result).toEqual([
    {
      id: "change",
      application_id: "own",
      previous_status: "POSTULADO",
      status: "EN_REVISION",
      created_at: log.created_at,
      initial: false,
    },
  ]);
  expect(JSON.stringify(result)).not.toMatch(
    /reviewer|private|score|ai_result/,
  );
});
it.each([
  { ...log, action: "DELETE" },
  { ...log, resource_type: "employees" },
  {
    ...log,
    metadata: { new_status: "EN_REVISION", previous_status: "EN_REVISION" },
  },
  { ...log, metadata: { new_status: "INVALID", previous_status: "POSTULADO" } },
  { ...log, metadata: null },
  { ...log, created_at: "invalid" },
])("no crea un avance falso desde $action", (entry) => {
  expect(ownApplicationUpdates([entry], new Set(["own"]))).toEqual([]);
});
it("distingue el registro inicial de un aviso de cambio de etapa", () => {
  const result = ownApplicationUpdates(
    [{ ...log, action: "INSERT", metadata: { new_status: "POSTULADO" } }],
    new Set(["own"]),
  );
  expect(result[0]).toMatchObject({ initial: true, previous_status: null });
});
it("no da por realizadas etapas anteriores sin estados registrados", () => {
  const stages = progressStages("ENTREVISTA", []);
  expect(stages.find((s) => s.status === "ENTREVISTA")?.current).toBe(true);
  expect(stages.filter((s) => s.recorded)).toEqual([]);
  expect(stages.find((s) => s.status === "CONTRATADO")?.current).toBe(false);
});
it("un retiro no se presenta como contratación ni vuelve a activar el recorrido", () => {
  expect(
    progressStages(
      "RETIRADO",
      ownApplicationUpdates([log], new Set(["own"])),
    ).some((s) => s.current),
  ).toBe(false);
});
