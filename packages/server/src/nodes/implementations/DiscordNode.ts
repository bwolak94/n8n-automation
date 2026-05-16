import { AppError } from "../../shared/errors/index.js";
import type { ExecutionContext, INode, NodeDefinition, NodeOutput } from "../contracts/INode.js";

export class DiscordNode implements INode {
  readonly definition: NodeDefinition = {
    type: "discord",
    name: "Discord",
    description: "Send messages and embeds to Discord channels via Webhook",
    configSchema: {
      type: "object",
      required: ["webhookUrl"],
      properties: {
        webhookUrl: { type: "string", description: "Discord Webhook URL" },
        content:    { type: "string", description: "Plain text message content" },
        username:   { type: "string", description: "Override webhook display name" },
        avatarUrl:  { type: "string", description: "Override webhook avatar URL" },
        embeds:     {
          type: "array",
          description: "Discord embed objects",
          items: {
            type: "object",
            properties: {
              title:       { type: "string" },
              description: { type: "string" },
              color:       { type: "number", description: "Decimal colour value" },
              url:         { type: "string" },
              timestamp:   { type: "string" },
            },
          },
        },
      },
    },
  };

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const webhookUrl = config["webhookUrl"] as string | undefined;
    if (!webhookUrl) throw new AppError("Discord: webhookUrl is required", 400, "DISCORD_MISSING_WEBHOOK");

    if (!config["content"] && !config["embeds"]) {
      throw new AppError("Discord: provide at least content or embeds", 400, "DISCORD_MISSING_PAYLOAD");
    }

    const payload: Record<string, unknown> = {};
    if (config["content"])   payload["content"]    = config["content"];
    if (config["username"])  payload["username"]   = config["username"];
    if (config["avatarUrl"]) payload["avatar_url"] = config["avatarUrl"];
    if (config["embeds"])    payload["embeds"]     = config["embeds"];

    const signal = context.signal ?? AbortSignal.timeout(15_000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    // Discord returns 204 No Content on success
    if (!response.ok) {
      const body = await response.text();
      throw new AppError(`Discord API error ${response.status}: ${body}`, response.status, "DISCORD_API_ERROR");
    }

    return { data: { ok: true, status: response.status } };
  }
}
