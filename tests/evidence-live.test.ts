import { it, expect, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { generate, sanitize } from "@/lib/ai/provider";
import { verification } from "@/lib/ai/schemas";
it.skipIf(process.env.NEXO_EVIDENCE_LIVE !== "1")(
  "analiza la evidencia indicada con Ollama y valida su respuesta sin guardar cambios",
  async () => {
    process.loadEnvFile(".env.local");
    vi.stubEnv("AI_PROVIDER", "ollama");
    const c = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const id = "e023ba4a-7f60-49f0-9010-8ca4b6961fa1";
    const { data: t, error: te } = await c
      .from("tasks")
      .select("description")
      .eq("id", id)
      .single();
    const { data: e, error: ee } = await c
      .from("task_evidence")
      .select("evidence_text")
      .eq("task_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (te || ee || !e.evidence_text) throw Error("Contexto no disponible");
    const source = readFileSync("src/app/api/ai/[useCase]/route.ts", "utf8");
    const instruction = source.match(/writing_instructions:\s*"([^"]+)"/)?.[1];
    expect(instruction).toBeTruthy();
    try {
      const answer = await generate(
        {
          task: { description: sanitize(t.description) },
          evidence: sanitize(e.evidence_text),
          evidence_text_truncated: e.evidence_text.length > 14000,
          writing_instructions: instruction,
        },
        verification,
        undefined,
        "analysis",
        true,
      );
      const result = verification.parse(answer.result);
      expect(result.reason.length).toBeGreaterThan(20);
      expect(result.status).not.toBe("APPROVED");
      console.log(
        "Modelo real:",
        answer.model,
        "; recomendación:",
        result.status,
      );
    } finally {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    }
  },
  240000,
);
