import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

interface WebhookTriggerInput {
  readonly body?: unknown;
  readonly headers?: Record<string, unknown>;
  readonly query?: Record<string, unknown>;
  readonly method?: string;
  readonly webhookId?: string;
}

/**
 * WebhookTriggerNode — trigger-only node.
 * The engine does not call execute() on trigger nodes; it passes the trigger
 * payload directly as the input to downstream nodes.
 * execute() is implemented here to support manual test-runs and unit tests.
 */
export class WebhookTriggerNode implements INode {
  readonly definition: NodeDefinition = {
    type: "webhook_trigger",
    name: "Webhook Trigger",
    description:
      "Triggers a workflow when an HTTP request is received at a unique webhook URL. " +
      "Configure method, optional HMAC secret, and response mode in Settings → Credentials.",
    trigger: true,
    configSchema: {
      type: "object",
      properties: {
        webhookId: {
          type: "string",
          description: "UUID assigned when the webhook endpoint is registered",
        },
        method: {
          type: "string",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "ANY"],
          default: "ANY",
        },
        secret: {
          type: "string",
          description: "Optional HMAC-SHA256 secret for signature verification",
        },
      },
    },
  };

  async execute(
    input: unknown,
    _config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const trigger = (input ?? {}) as WebhookTriggerInput;
    return {
      data: {
        body: trigger.body ?? null,
        headers: trigger.headers ?? {},
        query: trigger.query ?? {},
        method: trigger.method ?? "POST",
        webhookId: trigger.webhookId ?? null,
      },
    };
  }
}
