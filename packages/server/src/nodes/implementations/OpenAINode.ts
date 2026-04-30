import { AppError } from "../../shared/errors/index.js";
import type { ExecutionContext, INode, NodeDefinition, NodeOutput } from "../contracts/INode.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message: string };
}

export class OpenAINode implements INode {
  readonly definition: NodeDefinition = {
    type: "openai",
    name: "OpenAI",
    description: "Generate text, analyse images, and run chat completions using OpenAI models",
    configSchema: {
      type: "object",
      required: ["apiKey", "prompt"],
      properties: {
        apiKey:      { type: "string", description: "OpenAI API key" },
        model:       { type: "string", default: "gpt-4o-mini", description: "Model name (e.g. gpt-4o, gpt-4o-mini)" },
        prompt:      { type: "string", description: "User message prompt" },
        systemPrompt:{ type: "string", description: "Optional system message" },
        maxTokens:   { type: "number", default: 1024, description: "Maximum tokens in response" },
        temperature: { type: "number", default: 0.7, minimum: 0, maximum: 2, description: "Sampling temperature" },
      },
    },
  };

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const apiKey = config["apiKey"] as string | undefined;
    const prompt = config["prompt"] as string | undefined;
    if (!apiKey) throw new AppError("OpenAI: apiKey is required", 400, "OPENAI_MISSING_KEY");
    if (!prompt) throw new AppError("OpenAI: prompt is required",  400, "OPENAI_MISSING_PROMPT");

    const messages: ChatMessage[] = [];
    if (config["systemPrompt"]) {
      messages.push({ role: "system", content: config["systemPrompt"] as string });
    }
    messages.push({ role: "user", content: prompt });

    const signal = context.signal ?? AbortSignal.timeout(60_000);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model:       config["model"]       ?? "gpt-4o-mini",
        messages,
        max_tokens:  config["maxTokens"]   ?? 1024,
        temperature: config["temperature"] ?? 0.7,
      }),
      signal,
    });

    const json = await response.json() as OpenAIResponse;
    if (!response.ok) {
      throw new AppError(
        `OpenAI API error ${response.status}: ${json.error?.message ?? "unknown"}`,
        response.status,
        "OPENAI_API_ERROR"
      );
    }

    const text = json.choices?.[0]?.message?.content ?? "";
    return { data: { text, model: config["model"] ?? "gpt-4o-mini" } };
  }
}
