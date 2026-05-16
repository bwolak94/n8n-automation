import { AppError } from "../../shared/errors/index.js";
import type { ExecutionContext, INode, NodeDefinition, NodeOutput } from "../contracts/INode.js";

export class SlackNode implements INode {
  readonly definition: NodeDefinition = {
    type: "slack",
    name: "Slack",
    description: "Send messages to Slack channels via Incoming Webhook or Bot token",
    configSchema: {
      type: "object",
      required: ["webhookUrl", "text"],
      properties: {
        webhookUrl: { type: "string", description: "Slack Incoming Webhook URL" },
        text:       { type: "string", description: "Message text (supports mrkdwn)" },
        channel:    { type: "string", description: "Override channel (e.g. #alerts)" },
        username:   { type: "string", description: "Override bot display name" },
        iconEmoji:  { type: "string", description: "Override bot icon (e.g. :robot_face:)" },
        attachments: { type: "array", description: "Slack attachment blocks" },
      },
    },
  };

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const webhookUrl = config["webhookUrl"] as string | undefined;
    if (!webhookUrl) throw new AppError("Slack: webhookUrl is required", 400, "SLACK_MISSING_WEBHOOK");

    const payload: Record<string, unknown> = {
      text: config["text"] ?? "",
    };
    if (config["channel"])     payload["channel"]    = config["channel"];
    if (config["username"])    payload["username"]   = config["username"];
    if (config["iconEmoji"])   payload["icon_emoji"] = config["iconEmoji"];
    if (config["attachments"]) payload["attachments"] = config["attachments"];

    const signal = context.signal ?? AbortSignal.timeout(15_000);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    const body = await response.text();
    if (!response.ok) {
      throw new AppError(`Slack API error ${response.status}: ${body}`, response.status, "SLACK_API_ERROR");
    }

    return { data: { ok: true, response: body } };
  }
}
