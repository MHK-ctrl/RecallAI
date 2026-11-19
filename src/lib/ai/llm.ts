import { env, isLlmConfigured } from "@/lib/env";

export type LlmMessage = { role: "system" | "user" | "assistant"; content: string };

export class LlmError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Minimal OpenAI-compatible chat client: timeout, one retry, and no secrets in
 * error messages. Works with OpenAI, Groq, Together, OpenRouter, Ollama, vLLM…
 */
export async function chatComplete(
  messages: LlmMessage[],
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  if (!isLlmConfigured()) {
    throw new LlmError("No chat model is configured.");
  }

  const body = JSON.stringify({
    model: env.llm.model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 800,
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40_000);
    try {
      const response = await fetch(`${env.llm.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.llm.apiKey}`,
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new LlmError(
          `The AI provider returned ${response.status}. ${text.slice(0, 160)}`,
          response.status,
        );
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) throw new LlmError("The AI provider returned an empty answer.");
      return content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const retryable =
        !(error instanceof LlmError) || error.status === 429 || (error.status ?? 500) >= 500;
      if (!retryable || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 700));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new LlmError(
    lastError instanceof LlmError
      ? lastError.message
      : "The AI provider could not be reached. Please try again.",
    lastError instanceof LlmError ? lastError.status : undefined,
  );
}
