/** Pruebas opcionales contra modelos locales usando exclusivamente documentos ficticios. */
import { afterEach, expect, it, vi } from 'vitest';
import { generate, OllamaProvider } from '@/lib/ai/provider';
import { verification } from '@/lib/ai/schemas';
import { groundingContext, groundingReview } from '@/lib/ai/grounding';
afterEach(() => vi.unstubAllEnvs());
const enabled = process.env.NEXO_SYNTHETIC_LIVE === '1';
const source = { task: { description: 'Documenta tu configuración inicial y lo aprendido en la inducción.' }, evidence: 'Currículum ficticio: experiencia en desarrollo Java, React y SQL.' };
it.skipIf(!enabled)('genera un análisis de insuficiencia sin confundirlo con un fallo del analizador', async () => {
  vi.stubEnv('AI_PROVIDER', 'ollama');
  const answer = await generate({ ...source, writing_instructions: 'Si el archivo no demuestra la tarea, recomienda NEEDS_REVIEW y explica qué falta sin inventar requisitos.' }, verification, undefined, 'analysis', true);
  expect(verification.parse(answer.result).status).toBe('NEEDS_REVIEW');
}, 240000);
it.skipIf(!enabled).each([
  { reason: 'El currículum enumera experiencia profesional, pero no documenta la configuración inicial ni lo aprendido en la inducción.', status: 'NEEDS_REVIEW', supported: true },
  { reason: 'La evidencia demuestra que la instalación se realizó correctamente y que terminó la inducción.', status: 'APPROVED', supported: false },
  { reason: 'El documento demuestra diez años de experiencia y cinco cursos completados.', status: 'NEEDS_REVIEW', supported: false },
])('revisa afirmaciones, no el cumplimiento: $status / $supported', async ({ reason, status, supported }) => {
  const reviewer = new OllamaProvider(process.env.OLLAMA_REVIEW_MODEL || 'qwen2.5:3b');
  const review = await reviewer.generate(groundingContext(source, { reason, status, confidence: 0.9, observations: [] }, 'analysis', false), groundingReview);
  expect(groundingReview.parse(review.result).supported).toBe(supported);
}, 120000);
