import { AppError } from "../../shared/errors/index.js";
import type { ExecutionContext, INode, NodeDefinition, NodeOutput } from "../contracts/INode.js";

const BASE = "https://api.telegram.org";

export class TelegramNode implements INode {
  readonly definition: NodeDefinition = {
    type: "telegram",
    name: "Telegram",
    description: "Send messages, photos, or documents via a Telegram Bot",
    configSchema: {
      type: "object",
      required: ["botToken", "chatId", "text"],
      properties: {
        botToken:  { type: "string", description: "Telegram Bot API token" },
        chatId:    { type: "string", description: "Target chat ID or @username" },
        text:      { type: "string", description: "Message text" },
        parseMode: {
          type: "string",
          enum: ["Markdown", "MarkdownV2", "HTML"],
          description: "Text formatting mode",
        },
        disableNotification: { type: "boolean", description: "Send silently" },
      },
    },
  };

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    context: ExecutionContext
  ): Promise<NodeOutput> {
    const botToken = config["botToken"] as string | undefined;
    const chatId   = config["chatId"]   as string | undefined;
    if (!botToken) throw new AppError("Telegram: botToken is required", 400, "TELEGRAM_MISSING_TOKEN");
    if (!chatId)   throw new AppError("Telegram: chatId is required",   400, "TELEGRAM_MISSING_CHAT");

    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text:    config["text"] ?? "",
    };
    if (config["parseMode"])            payload["parse_mode"]             = config["parseMode"];
    if (config["disableNotification"])  payload["disable_notification"]   = true;

    const signal = context.signal ?? AbortSignal.timeout(15_000);

    const response = await fetch(`${BASE}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal,
    });

    const json = await response.json() as { ok: boolean; description?: string; result?: unknown };
    if (!json.ok) {
      throw new AppError(`Telegram API error: ${json.description ?? "unknown"}`, 400, "TELEGRAM_API_ERROR");
    }

    return { data: json.result ?? {} };
  }
}
