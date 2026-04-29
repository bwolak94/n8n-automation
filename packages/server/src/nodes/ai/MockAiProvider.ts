import type { AiRequest, AiResponse, IAiProvider } from "../contracts/IAiProvider.js";

export class MockAiProvider implements IAiProvider {
  readonly name = "mock";

  async complete(request: AiRequest): Promise<AiResponse> {
    return {
      result: `[Mock AI] Processed: ${request.prompt.slice(0, 100)}`,
      tokensUsed: 10,
      model: "mock-1.0",
    };
  }
}
