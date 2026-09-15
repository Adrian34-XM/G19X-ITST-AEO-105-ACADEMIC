import "server-only";
import { z } from "zod";
import { systemPrompt, sanitize } from "./schemas";
export type Attachment = { mimeType: string; data: string };
export interface AIProvider {
  generate(
    context: unknown,
    schema: z.ZodType,
    attachment?: Attachment,
  ): Promise<{ result: unknown; model: string }>;
}
export class GeminiProvider implements AIProvider {
  async generate(context: unknown, schema: z.ZodType, attachment?: Attachment) {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    if (!process.env.GEMINI_API_KEY) throw new Error("AI_NOT_CONFIGURED");
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: "user",
              parts: [
                { text: JSON.stringify(context) },
                ...(attachment ? [{ inlineData: attachment }] : []),
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseJsonSchema: z.toJSONSchema(schema),
            temperature: 0.1,
            maxOutputTokens: 2000,
          },
        }),
      },
    );
    if (!response.ok) throw new Error("PROVIDER_FAILED");
    const data = await response.json();
    return {
      result: schema.parse(
        JSON.parse(
          data.candidates?.[0]?.content?.parts
            ?.map((p: { text?: string }) => p.text ?? "")
            .join("") ?? "",
        ),
      ),
      model,
    };
  }
}
export class OllamaProvider implements AIProvider {
  async generate(context: unknown, schema: z.ZodType, attachment?: Attachment) {
    if (
      attachment &&
      (!attachment.mimeType.startsWith("image/") ||
        !process.env.OLLAMA_VISION_MODEL)
    )
      throw new Error("VISION_NOT_CONFIGURED");
    const model = attachment
      ? process.env.OLLAMA_VISION_MODEL!
      : process.env.OLLAMA_MODEL || "qwen2.5:3b";
    const response = await fetch(
      `${process.env.OLLAMA_URL || "http://127.0.0.1:11434"}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model,
          stream: false,
          format: z.toJSONSchema(schema),
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: JSON.stringify(context),
              ...(attachment ? { images: [attachment.data] } : {}),
            },
          ],
          options: { temperature: 0.1, num_predict: 2000 },
        }),
      },
    );
    if (!response.ok) throw new Error("PROVIDER_FAILED");
    const data = await response.json();
    return { result: schema.parse(JSON.parse(data.message.content)), model };
  }
}
export async function generate(
  context: unknown,
  schema: z.ZodType,
  attachment?: Attachment,
) {
  const provider =
    process.env.AI_PROVIDER === "gemini"
      ? new GeminiProvider()
      : new OllamaProvider();
  try {
    return await provider.generate(context, schema, attachment);
  } catch (e) {
    if (
      process.env.AI_PROVIDER === "gemini" &&
      process.env.AI_FALLBACK === "true"
    )
      return new OllamaProvider().generate(context, schema, attachment);
    throw e;
  }
}
export { sanitize };
