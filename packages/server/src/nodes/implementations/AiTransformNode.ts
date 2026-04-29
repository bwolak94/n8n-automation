import { AppError } from "../../shared/errors/index.js";
import type { IAiProvider } from "../contracts/IAiProvider.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

export class AiTransformNode implements INode {
  readonly definition: NodeDefinition = {
    type: "ai_transform",
    name: "AI Transform",
    description:
      "Transform data using an AI language model via the configured provider",
    configSchema: {
      type: "object",
      required: ["prompt"],
      properties: {
        prompt: {
          type: "string",
          description:
            "Prompt template. Use {{input}} to interpolate the node input as JSON.",
        },
        systemPrompt: {
          type: "string",
          description: "Optional system-level instruction for the model",
        },
        model: {
          type: "string",
          description: "Model identifier (e.g. claude-sonnet-4-6, gpt-4o)",
        },
        maxTokens: { type: "number", default: 1024 },
        temperature: { type: "number", minimum: 0, maximum: 2, default: 0.7 },
      },
    },
  };

  constructor(private readonly provider: IAiProvider) {}

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const prompt = config["prompt"] as string | undefined;
    const systemPrompt = config["systemPrompt"] as string | undefined;
    const model = (config["model"] as string | undefined) ?? "claude-sonnet-4-6";
    const maxTokens = config["maxTokens"] as number | undefined;
    const temperature = config["temperature"] as number | undefined;

    if (!prompt) {
      throw new AppError(
        "AiTransformNode requires a prompt",
        400,
        "AI_MISSING_PROMPT"
      );
    }

    const formattedPrompt = prompt.replace(
      /\{\{input\}\}/g,
      JSON.stringify(input)
    );

    const response = await this.provider.complete({
      model,
      prompt: formattedPrompt,
      systemPrompt,
      maxTokens,
      temperature,
    });

    return {
      data: {
        result: response.result,
        tokensUsed: response.tokensUsed,
        model: response.model,
      },
    };
  }
}
