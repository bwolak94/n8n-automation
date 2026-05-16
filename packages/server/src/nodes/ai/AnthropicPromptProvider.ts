import Anthropic from "@anthropic-ai/sdk";
import { AppError } from "../../shared/errors/index.js";
import type { IPromptProvider, PromptConfig, PromptMessage, PromptResult } from "./IPromptProvider.js";

export class AnthropicPromptProvider implements IPromptProvider {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(
    systemPrompt: string | undefined,
    messages: PromptMessage[],
    config: PromptConfig
  ): Promise<PromptResult> {
    const effectiveSystem =
      config.responseFormat !== "text"
        ? `${systemPrompt ? systemPrompt + "\n\n" : ""}Respond with valid JSON only. No markdown, no code fences.`
        : systemPrompt;

    try {
      const response = await this.client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens ?? 1024,
        ...(effectiveSystem ? { system: effectiveSystem } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
      });

      const first = response.content[0];
      const content = first?.type === "text" ? first.text : "";

      return {
        content,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    } catch (err) {
      const e = err as { status?: number; message?: string };
      if (e.status === 429) throw new AppError("Anthropic rate limit exceeded", 429, "AI_RATE_LIMITED");
      if (e.status === 401) throw new AppError("Anthropic authentication failed", 401, "AI_AUTH_FAILED");
      throw new AppError(e.message ?? "Anthropic API error", 500, "AI_PROVIDER_ERROR");
    }
  }
}
