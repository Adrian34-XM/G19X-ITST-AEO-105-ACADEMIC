import { it, expect, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { overviewContext } from "@/modules/workspace/overview";
import { overviewSummaryInput } from "@/lib/ai/overview-summary";
import { generate } from "@/lib/ai/provider";
import type { Snapshot } from "@/modules/workspace/types";
it.skipIf(process.env.NEXO_OVERVIEW_LIVE !== "1")(
  "genera y valida con Ollama un resumen de agregados actuales de RH sin escribir datos",
  async () => {
    process.loadEnvFile(".env.local");
    vi.stubEnv("AI_PROVIDER", "ollama");
    const c = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const data: Snapshot = {};
    const fields: Record<string, string> = {
      departments: "id,name",
      positions: "id,department_id",
      employees: "id,position_id,status",
      tasks: "id,employee_id,status,due_date",
      course_assignments: "id,employee_id,status",
      onboarding: "id,employee_id,status",
      vacancies: "id,position_id,status",
    };
    for (const [table, select] of Object.entries(fields)) {
      const r = await c.from(table).select(select).limit(200);
      if (r.error) throw Error("No se pudieron cargar agregados");
      data[table] = r.data as unknown as Snapshot[string];
    }
    const context = overviewContext(
      data,
      {
        id: "test-rh",
        role: "RH_ADMIN",
        full_name: "RH",
        email: "test@example.test",
      },
      new Date().toISOString().slice(0, 10),
    );
    try {
      const result = await generate(
        overviewSummaryInput(context, ""),
        z.object({ summary: z.string().min(1).max(1200) }).strict(),
        undefined,
        "analysis",
        true,
      );
      expect(
        (result.result as { summary: string }).summary.length,
      ).toBeGreaterThan(20);
      console.log("Resumen real generado y validado; modelo:", result.model);
    } finally {
      vi.unstubAllEnvs();
    }
  },
  240000,
);
