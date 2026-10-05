import { expect, it } from "vitest";
import { generate, OllamaProvider } from "@/lib/ai/provider";
import { groundingContext, onboardingDraftReview } from "@/lib/ai/grounding";
import { planSchema } from "@/modules/onboarding/schemas";

it.skipIf(process.env.RUN_ONBOARDING_AI !== "1")(
  "genera un borrador Scrum con el modelo local",
  async () => {
    const answer = await generate(
      {
        task: "Propón en español un plan de incorporación de 4 a 6 actividades para este puesto. Todo el contenido es una propuesta revisable, no políticas existentes. Incluye bienvenida e introducción práctica a Scrum. Los responsables son EMPLOYEE, MANAGER o HR. days es un plazo propuesto desde el inicio. No inventes políticas, beneficios, nombres ni datos sensibles.",
        position: "Desarrollador Full Stack",
        context:
          "Inducción a la metodología Scrum: roles, eventos y un ejercicio de planificación.",
      },
      planSchema,
      undefined,
      "onboarding-draft",
      true,
    );
    expect(planSchema.parse(answer.result).steps.length).toBeGreaterThanOrEqual(
      4,
    );
  },
  180000,
);

it.skipIf(process.env.RUN_ONBOARDING_AI !== "1")(
  "el revisor local rechaza una política empresarial inventada",
  async () => {
    const response = await new OllamaProvider().generate(
      groundingContext(
        {
          position: "Desarrollo",
          context: "Bienvenida técnica, sin políticas proporcionadas",
        },
        {
          title: "Plan",
          steps: [
            {
              title: "Beneficios",
              description:
                "La empresa concede 30 días de vacaciones pagadas y un bono garantizado de 50 mil pesos a cada nuevo empleado.",
              owner_role: "HR",
              days: 1,
              requires_document: false,
            },
          ],
        },
        "onboarding-draft",
        false,
      ),
      onboardingDraftReview,
    );
    const verdict = onboardingDraftReview.parse(response.result);
    // El servidor rechaza también un veredicto contradictorio con errores concretos.
    expect(!verdict.supported || verdict.issues.length > 0).toBe(true);
  },
  120000,
);
