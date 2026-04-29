export interface AiRequest {
  readonly model: string;
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export interface AiResponse {
  readonly result: string;
  readonly tokensUsed: number;
  readonly model: string;
}

export interface IAiProvider {
  readonly name: string;
  complete(request: AiRequest): Promise<AiResponse>;
}
