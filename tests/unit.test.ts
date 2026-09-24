/**
 * Pruebas de reglas puras, validación de archivos y contratos de datos sin depender del proveedor remoto.
 */
import { describe, it, expect } from "vitest";
import { performance } from "@/modules/performance/service";
import { roles, mayEnter, applicationTransitions } from "@/lib/permissions";
import {
  recommendation,
  verification,
  sanitize,
  systemPrompt,
} from "@/lib/ai/schemas";
import { schemas } from "@/modules/commands/schemas";
import { inspectFile } from "@/lib/storage/files";
describe("permisos y validaciones", () => {
  it.each(roles)("aislamiento de rutas para %s", (role) => {
    expect(mayEnter(role, "/admin/users")).toBe(role === "SUPERUSER");
    expect(mayEnter(role, "/rh")).toBe(
      ["RH_ADMIN", "SUPERUSER"].includes(role),
    );
  });
  it("contratación solo por operación transaccional", () => {
    expect(Object.values(applicationTransitions).flat()).not.toContain(
      "CONTRATADO",
    );
    expect(applicationTransitions.CONTRATADO).toEqual([]);
  });
  it("rechaza mass assignment y UUID manipulados", () => {
    expect(
      schemas["candidate.save"].safeParse({
        phone: "",
        skills: [],
        experience_years: 1,
        role: "SUPERUSER",
      }).success,
    ).toBe(false);
    expect(
      schemas["application.hire"].safeParse({ id: "1 or 1=1" }).success,
    ).toBe(false);
    expect(
      schemas["course.progress"].safeParse({
        id: crypto.randomUUID(),
        progress: 101,
      }).success,
    ).toBe(false);
  });
  it("calcula porcentajes y umbrales sin dividir entre cero", () => {
    expect(performance([], []).overall_score).toBe(0);
    expect(
      performance([{ status: "APPROVED" }], [{ status: "COMPLETED" }]),
    ).toMatchObject({ overall_score: 100, signal: "GREEN" });
    expect(
      performance([{ status: "APPROVED" }], [{ status: "ASSIGNED" }]),
    ).toMatchObject({ overall_score: 60, signal: "YELLOW" });
    expect(
      performance([{ status: "SUBMITTED" }], [{ status: "COMPLETED" }]),
    ).toMatchObject({ overall_score: 40, signal: "RED" });
  });
  it("valida resultados IA de forma estricta", () => {
    expect(recommendation.safeParse({ score: 101 }).success).toBe(false);
    expect(
      verification.safeParse({
        status: "APPROVED",
        confidence: 2,
        observations: [],
        reason: "ok",
      }).success,
    ).toBe(false);
    expect(
      recommendation.safeParse({
        score: 50,
        match_level: "MEDIUM",
        strengths: [],
        gaps: [],
        summary: "Brechas",
        role: "SUPERUSER",
      }).success,
    ).toBe(false);
  });
  it("limita contexto y establece frontera de datos no confiables", () => {
    expect(sanitize("a".repeat(20000)).length).toBe(14000);
    expect(sanitize("a\0b")).toBe("ab");
    expect(systemPrompt).toContain("DATOS NO CONFIABLES");
    expect(systemPrompt).toContain("No tienes herramientas");
  });
  it("valida contenido real del archivo y CV", async () => {
    await expect(
      inspectFile(
        new File(["fake"], "cv.pdf", { type: "application/pdf" }),
        "cvs",
      ),
    ).rejects.toThrow("PDF inválido");
    await expect(
      inspectFile(new File(["fake"], "cv.html", { type: "text/html" }), "cvs"),
    ).rejects.toThrow("Formato no permitido");
    expect(
      (
        await inspectFile(
          new File(["React y PostgreSQL"], "cv.txt", { type: "text/plain" }),
          "cvs",
        )
      ).text,
    ).toBe("React y PostgreSQL");
  });
});
