import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";
import type { WebhookRegistry } from "../WebhookRegistry.js";

interface WebhookInput {
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
  readonly queryParams?: Record<string, string>;
  readonly method?: string;
}

export class WebhookNode implements INode {
  readonly definition: NodeDefinition = {
    type: "webhook",
    name: "Webhook",
    description: "Receive incoming HTTP requests as workflow triggers",
    configSchema: {
      type: "object",
      required: ["path"],
      properties: {
        path: {
          type: "string",
          description: "URL path to register (e.g. /my-webhook)",
        },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
          default: "POST",
        },
      },
    },
  };

  constructor(private readonly registry: WebhookRegistry) {}

  async execute(
    input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const path = config["path"] as string | undefined;
    const method = (
      (config["method"] as string | undefined) ?? "POST"
    ).toUpperCase();

    if (!path) {
      throw new Error("WebhookNode requires a path");
    }

    this.registry.register(path, method);

    const webhookInput = ((input ?? {}) as WebhookInput);

    return {
      data: {
        headers: webhookInput.headers ?? {},
        body: webhookInput.body ?? null,
        queryParams: webhookInput.queryParams ?? {},
        method: webhookInput.method ?? method,
      },
    };
  }
}
