import { AppError } from "../../shared/errors/index.js";
import type { IPromptProvider, PromptConfig, PromptMessage, PromptResult } from "./IPromptProvider.js";

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }>; role: string };
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
  };
}

export class GoogleAIProvider implements IPromptProvider {
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(private readonly apiKey: string) {}

  async complete(
    systemPrompt: string | undefined,
    messages: PromptMessage[],
    config: PromptConfig
  ): Promise<PromptResult> {
    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: config.maxTokens ?? 1024,
        ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
        ...(config.responseFormat !== "text"
          ? { responseMimeType: "application/json" }
          : {}),
      },
      ...(systemPrompt
        ? { systemInstruction: { parts: [{ text: systemPrompt }] } }
        : {}),
    };

    const url = `${this.baseUrl}/models/${config.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.status === 429) throw new AppError("Google AI rate limit exceeded", 429, "AI_RATE_LIMITED");
    if (response.status === 401) throw new AppError("Google AI authentication failed", 401, "AI_AUTH_FAILED");
    if (!response.ok) {
      throw new AppError(`Google AI error: ${response.status}`, response.status, "AI_PROVIDER_ERROR");
    }

    const data = (await response.json()) as GeminiResponse;
    const content = data.candidates[0]?.content.parts[0]?.text ?? "";

    return {
      content,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      },
    };
  }
}
