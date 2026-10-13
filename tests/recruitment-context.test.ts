import { expect, it } from "vitest";
import { recruitmentContext } from "@/lib/ai/recruitment-context";

it("separa los años generales declarados de experiencia tecnológica acreditada", () => {
  const context = recruitmentContext(
    {
      skills: ["TypeScript"],
      experience_years: 2,
      cv_text: "Currículum sin detalle por tecnología.",
    },
    {
      skills: ["TypeScript"],
      experience_required: 1,
      requirements: "Un año de experiencia general.",
    },
  );
  expect(context.candidate.declared_general_experience_years).toBe(2);
  expect(context.vacancy.minimum_general_experience_years).toBe(1);
  expect(context.declared_experience_comparison.meets_general_minimum).toBe(
    true,
  );
  expect(context.candidate.cv_text).toBe(
    "Currículum sin detalle por tecnología.",
  );
  expect(context.declared_experience_comparison.limitation).toContain(
    "no verifica el CV",
  );
});

it("distingue experiencia general insuficiente sin inferir ausencia de una habilidad", () => {
  const context = recruitmentContext(
    {
      skills: ["SQL"],
      experience_years: 1,
      cv_text: "Práctica declarada con SQL.",
    },
    {
      skills: ["SQL"],
      experience_required: 3,
      requirements: "Tres años generales.",
    },
  );
  expect(context.declared_experience_comparison.meets_general_minimum).toBe(
    false,
  );
  expect(context.candidate.declared_skills).toEqual(["SQL"]);
});
