import { AppError } from "../../shared/errors/index.js";
import type { IPromptProvider, PromptConfig, PromptMessage, PromptResult } from "./IPromptProvider.js";

interface OpenAIChatResponse {
  model: string;
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}

export class OpenAIPromptProvider implements IPromptProvider {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = "https://api.openai.com"
  ) {}

  async complete(
    systemPrompt: string | undefined,
    messages: PromptMessage[],
    config: PromptConfig
  ): Promise<PromptResult> {
    const apiMessages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      apiMessages.push({ role: "system", content: systemPrompt });
    }

    for (const m of messages) {
      apiMessages.push({ role: m.role, content: m.content });
    }

    const body: Record<string, unknown> = {
      model: config.model,
      messages: apiMessages,
      max_tokens: config.maxTokens ?? 1024,
      ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
    };

    if (config.responseFormat === "json" || config.responseFormat === "structured") {
      body["response_format"] = { type: "json_object" };
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429) throw new AppError("OpenAI rate limit exceeded", 429, "AI_RATE_LIMITED");
    if (response.status === 401) throw new AppError("OpenAI authentication failed", 401, "AI_AUTH_FAILED");
    if (!response.ok) {
      throw new AppError(`OpenAI API error: ${response.status}`, response.status, "AI_PROVIDER_ERROR");
    }

    const data = (await response.json()) as OpenAIChatResponse;

    return {
      content: data.choices[0]?.message.content ?? "",
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens,
      },
    };
  }
}
