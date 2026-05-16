export interface PromptMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface PromptConfig {
  readonly model: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly responseFormat: "text" | "json" | "structured";
  readonly jsonSchema?: Record<string, unknown>;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface PromptResult {
  readonly content: string;
  readonly usage: TokenUsage;
}

export interface IPromptProvider {
  complete(
    systemPrompt: string | undefined,
    messages: PromptMessage[],
    config: PromptConfig
  ): Promise<PromptResult>;
}
