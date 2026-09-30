import { expect, it } from "vitest";
import { profileRecords } from "@/modules/workspace/profile-records";
it("el expediente enlaza solo actividades y archivos de la persona solicitada", () => {
  const records = profileRecords(
    {
      tasks: [
        { id: "t", employee_id: "e", title: "Mi tarea", status: "APPROVED" },
        { id: "other", employee_id: "x" },
      ],
      task_evidence: [
        { id: "f", task_id: "t" },
        { id: "private", task_id: "other" },
      ],
      onboarding: [
        { id: "o", employee_id: "e" },
        { id: "ox", employee_id: "x" },
      ],
      onboarding_items: [
        { id: "i", onboarding_id: "o", status: "COMPLETED" },
        { id: "ix", onboarding_id: "ox" },
      ],
      onboarding_documents: [{ id: "d", item_id: "i" }],
      climate_comments: [{ id: "secret", comment: "privado" }],
    },
    "e",
    "/employee",
  );
  expect(records).toHaveLength(2);
  expect(records[0].files).toEqual([{ id: "f", bucket: "task-evidence" }]);
  expect(records[0].href).toBe("/employee/tasks/t");
  expect(records.every((r) => r.completed)).toBe(true);
  expect(JSON.stringify(records)).not.toMatch(/private|secret|privado/);
});
