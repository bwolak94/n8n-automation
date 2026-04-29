import Anthropic from "@anthropic-ai/sdk";
import { AppError } from "../../shared/errors/index.js";
import type { AiRequest, AiResponse, IAiProvider } from "../contracts/IAiProvider.js";

export class ClaudeProvider implements IAiProvider {
  readonly name = "claude";
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: AiRequest): Promise<AiResponse> {
    try {
      const response = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens ?? 1024,
        ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
        messages: [{ role: "user", content: request.prompt }],
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
      });

      const first = response.content[0];
      const result = first?.type === "text" ? first.text : "";

      return {
        result,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        model: response.model,
      };
    } catch (err) {
      const error = err as { status?: number; message?: string };
      if (error.status === 429) {
        throw new AppError(
          "Claude API rate limit exceeded",
          429,
          "AI_RATE_LIMITED"
        );
      }
      if (error.status === 401) {
        throw new AppError(
          "Claude API authentication failed",
          401,
          "AI_AUTH_FAILED"
        );
      }
      throw new AppError(
        error.message ?? "Claude API error",
        500,
        "AI_PROVIDER_ERROR"
      );
    }
  }
}
