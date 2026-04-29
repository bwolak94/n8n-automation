import { AppError } from "../../shared/errors/index.js";
import type { AiRequest, AiResponse, IAiProvider } from "../contracts/IAiProvider.js";

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  model: string;
  choices: Array<{ message: { content: string } }>;
  usage: { total_tokens: number };
}

export class OpenAIProvider implements IAiProvider {
  readonly name = "openai";
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    baseUrl = "https://api.openai.com"
  ) {
    this.baseUrl = baseUrl;
  }

  async complete(request: AiRequest): Promise<AiResponse> {
    const messages: OpenAIMessage[] = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.prompt });

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: request.model,
        messages,
        max_tokens: request.maxTokens ?? 1024,
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
      }),
    });

    if (response.status === 429) {
      throw new AppError(
        "OpenAI API rate limit exceeded",
        429,
        "AI_RATE_LIMITED"
      );
    }

    if (response.status === 401) {
      throw new AppError(
        "OpenAI API authentication failed",
        401,
        "AI_AUTH_FAILED"
      );
    }

    if (!response.ok) {
      throw new AppError(
        `OpenAI API error: ${response.status}`,
        response.status,
        "AI_PROVIDER_ERROR"
      );
    }

    const data = (await response.json()) as OpenAIResponse;

    return {
      result: data.choices[0]?.message.content ?? "",
      tokensUsed: data.usage.total_tokens,
      model: data.model,
    };
  }
}
