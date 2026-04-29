import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

export interface EmailAttachment {
  readonly filename: string;
  readonly content: string | Buffer;
}

export interface SendMailOptions {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface SentInfo {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

/** Minimal transport interface — satisfied by nodemailer.Transporter */
export interface IEmailTransport {
  sendMail(options: SendMailOptions): Promise<SentInfo>;
}

export class EmailNode implements INode {
  readonly definition: NodeDefinition = {
    type: "email",
    name: "Email",
    description: "Send an email via SMTP using Nodemailer",
    configSchema: {
      type: "object",
      required: ["to", "subject"],
      properties: {
        to: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description: "Recipient address(es)",
        },
        subject: { type: "string" },
        from: { type: "string" },
        text: { type: "string", description: "Plain-text body" },
        html: { type: "string", description: "HTML body" },
        attachments: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filename: { type: "string" },
              content: { type: "string" },
            },
          },
        },
      },
    },
  };

  constructor(private readonly transport: IEmailTransport) {}

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    const to = config["to"] as string | string[] | undefined;
    const subject = config["subject"] as string | undefined;

    if (!to) {
      throw new AppError("EmailNode requires a 'to' address", 400, "EMAIL_MISSING_TO");
    }
    if (!subject) {
      throw new AppError("EmailNode requires a 'subject'", 400, "EMAIL_MISSING_SUBJECT");
    }

    const info = await this.transport.sendMail({
      from: config["from"] as string | undefined,
      to,
      subject,
      text: config["text"] as string | undefined,
      html: config["html"] as string | undefined,
      attachments: config["attachments"] as EmailAttachment[] | undefined,
    });

    return {
      data: {
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
      },
    };
  }
}
