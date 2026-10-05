/**
 * @file Valida y prepara la opinión de IA sobre evidencias de capacitación. Separa hallazgos,
 * faltantes y próximos pasos; el resultado orienta la revisión humana y no aprueba progreso.
 * @see docs/CODIGO.md para los flujos y docs/MAPA_CODIGO.md para el índice.
 */
import { z } from "zod";
import { readableOverview } from "@/modules/workspace/overview";
export const trainingOpinion = z
  .object({
    summary: z.string().min(1).max(2000),
    demonstrated: z.array(z.string().max(500)).max(6),
    missing: z
      .array(z.string().max(500))
      .max(6)
      .describe(
        "Copia literalmente un requisito de la descripción o contenido del curso que no se pueda comprobar. No agregues exigencias nuevas ni prefijos.",
      ),
    recommendation: z.enum(["SUFFICIENT", "MORE_EVIDENCE", "HUMAN_REVIEW"]),
  })
  .strict();

/** Una respuesta que enumera faltantes nunca se presenta como evidencia suficiente. */
export function reviewTrainingOpinion(result: unknown) {
  const parsed = trainingOpinion.parse(result);
  const clean = (text: string) => readableOverview(text, {}).trim();
  parsed.demonstrated = [
    ...new Set(parsed.demonstrated.map(clean).filter(Boolean)),
  ];
  parsed.missing = [...new Set(parsed.missing.map(clean).filter(Boolean))];
  if (parsed.missing.length && parsed.recommendation === "SUFFICIENT")
    parsed.recommendation = "MORE_EVIDENCE";
  // Conserva frases completas: no muestra un final como «Se requiere» ni corta por caracteres.
  const sentences = [
    ...new Intl.Segmenter("es", { granularity: "sentence" }).segment(
      clean(parsed.summary),
    ),
  ].map((s) => s.segment.trim());
  const complete = sentences.filter((s) => /[.!?]["’”)]?$/.test(s));
  let summary = "";
  for (const sentence of complete.slice(0, 3)) {
    if ((summary + sentence).length > 700) break;
    summary += (summary ? " " : "") + sentence;
  }
  parsed.summary =
    summary ||
    {
      SUFFICIENT:
        "La evidencia parece respaldar lo solicitado. Revisa los archivos antes de validar el avance.",
      MORE_EVIDENCE:
        "Todavía falta información para comprobar el avance. Revisa los puntos pendientes antes de validarlo.",
      HUMAN_REVIEW:
        "La información disponible requiere una revisión del responsable antes de validar el avance.",
    }[parsed.recommendation];
  return parsed;
}

/** Solo presenta faltantes respaldados por el texto de la capacitación, sin crear obligaciones nuevas. */
export function verifiedTrainingOpinion(result: unknown, requirements: string) {
  const parsed = reviewTrainingOpinion(result);
  const normalize = (text: string) =>
    text
      .normalize("NFKC")
      .toLocaleLowerCase("es-MX")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  const available = normalize(requirements);
  parsed.missing = parsed.missing.filter((item) => {
    const quote = normalize(item);
    return quote.length >= 6 && available.includes(quote);
  });
  return parsed;
}
