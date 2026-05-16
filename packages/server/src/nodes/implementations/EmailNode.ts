import nodemailer from "nodemailer";
import { AppError } from "../../shared/errors/index.js";
import type {
  ExecutionContext,
  INode,
  NodeDefinition,
  NodeOutput,
} from "../contracts/INode.js";

// ─── Transport interface ───────────────────────────────────────────────────────

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
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SentInfo {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

/** Minimal transport interface — satisfied by nodemailer.Transporter and test mocks. */
export interface IEmailTransport {
  sendMail(options: SendMailOptions): Promise<SentInfo>;
}

// ─── Transport factories ───────────────────────────────────────────────────────

const MAX_ATTACHMENT_BYTES_DEFAULT = 10 * 1024 * 1024; // 10 MB

function buildSmtpTransport(config: Readonly<Record<string, unknown>>): IEmailTransport {
  const transport = nodemailer.createTransport({
    host: (config["smtpHost"] as string | undefined) ?? "localhost",
    port: Number(config["smtpPort"] ?? 587),
    secure: Boolean(config["smtpSecure"] ?? false),
    auth: config["smtpUser"]
      ? { user: config["smtpUser"] as string, pass: (config["smtpPassword"] as string | undefined) ?? "" }
      : undefined,
  });

  return {
    sendMail: async (options) => {
      const info = await transport.sendMail(options as Parameters<typeof transport.sendMail>[0]);
      return {
        messageId: info.messageId ?? "",
        accepted: (info.accepted ?? []) as string[],
        rejected: (info.rejected ?? []) as string[],
      };
    },
  };
}

async function sendViaSendGrid(
  apiKey: string,
  options: SendMailOptions
): Promise<SentInfo> {
  const toList = Array.isArray(options.to) ? options.to : [options.to];

  const body = {
    personalizations: [
      {
        to: toList.map((email) => ({ email })),
        ...(options.cc ? { cc: (Array.isArray(options.cc) ? options.cc : [options.cc]).map((e) => ({ email: e })) } : {}),
        ...(options.bcc ? { bcc: (Array.isArray(options.bcc) ? options.bcc : [options.bcc]).map((e) => ({ email: e })) } : {}),
        subject: options.subject,
      },
    ],
    from: { email: options.from ?? "" },
    ...(options.replyTo ? { reply_to: { email: options.replyTo } } : {}),
    content: [
      ...(options.text ? [{ type: "text/plain", value: options.text }] : []),
      ...(options.html ? [{ type: "text/html", value: options.html }] : []),
    ],
    ...(options.attachments?.length
      ? {
          attachments: options.attachments.map((a) => ({
            filename: a.filename,
            content: Buffer.isBuffer(a.content)
              ? a.content.toString("base64")
              : Buffer.from(a.content).toString("base64"),
            disposition: "attachment",
          })),
        }
      : {}),
  };

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new AppError(
      `SendGrid error ${response.status}: ${detail}`,
      502,
      "SENDGRID_ERROR"
    );
  }

  const messageId = response.headers.get("x-message-id") ?? `sendgrid-${Date.now()}`;
  return { messageId, accepted: toList, rejected: [] };
}

// ─── EmailNode ─────────────────────────────────────────────────────────────────

export class EmailNode implements INode {
  readonly definition: NodeDefinition = {
    type: "email",
    name: "Send Email",
    description: "Send transactional email via SMTP (nodemailer) or SendGrid",
    configSchema: {
      type: "object",
      required: ["to", "subject"],
      properties: {
        transport:  { type: "string", enum: ["smtp", "sendgrid"], default: "smtp" },
        smtpHost:   { type: "string" },
        smtpPort:   { type: "number", default: 587 },
        smtpUser:   { type: "string" },
        smtpPassword: { type: "string" },
        smtpSecure: { type: "boolean", default: false },
        apiKey:     { type: "string", description: "SendGrid API key" },
        from:       { type: "string" },
        to:         { oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }] },
        subject:    { type: "string" },
        html:       { type: "string" },
        text:       { type: "string" },
        cc:         { type: "string" },
        bcc:        { type: "string" },
        replyTo:    { type: "string" },
        attachments: { type: "array", items: { type: "object", properties: { filename: { type: "string" }, content: { type: "string" } } } },
        dryRun:     { type: "boolean", default: false },
        maxAttachmentBytes: { type: "number", default: 10485760 },
      },
    },
  };

  /**
   * @param testTransport Optional injected transport for unit tests.
   *   When omitted, the transport is built from config at execute time.
   */
  constructor(private readonly testTransport?: IEmailTransport) {}

  async execute(
    _input: unknown,
    config: Readonly<Record<string, unknown>>,
    _context: ExecutionContext
  ): Promise<NodeOutput> {
    // ── Validation ────────────────────────────────────────────────────────────

    const to = config["to"] as string | string[] | undefined;
    const subject = config["subject"] as string | undefined;

    if (!to) throw new AppError("EmailNode requires a 'to' address", 400, "EMAIL_MISSING_TO");
    if (!subject) throw new AppError("EmailNode requires a 'subject'", 400, "EMAIL_MISSING_SUBJECT");

    // ── Attachment size check ─────────────────────────────────────────────────

    const attachments = config["attachments"] as EmailAttachment[] | undefined;
    const maxBytes = (config["maxAttachmentBytes"] as number | undefined) ?? MAX_ATTACHMENT_BYTES_DEFAULT;

    if (attachments?.length) {
      for (const att of attachments) {
        const size = Buffer.isBuffer(att.content)
          ? att.content.length
          : Buffer.byteLength(typeof att.content === "string" ? att.content : String(att.content), "base64");
        if (size > maxBytes) {
          throw new AppError(
            `Attachment '${att.filename}' exceeds the ${maxBytes}-byte size limit`,
            400,
            "EMAIL_ATTACHMENT_TOO_LARGE"
          );
        }
      }
    }

    // ── Dry-run mode ──────────────────────────────────────────────────────────

    if (config["dryRun"] === true) {
      return {
        data: {
          success: true,
          messageId: `dry-run-${Date.now()}`,
          accepted: Array.isArray(to) ? to : [to],
          rejected: [],
          dryRun: true,
        },
      };
    }

    // ── Build options ─────────────────────────────────────────────────────────

    const mailOptions: SendMailOptions = {
      from:    config["from"] as string | undefined,
      to,
      subject,
      text:    config["text"] as string | undefined,
      html:    config["html"] as string | undefined,
      cc:      config["cc"] as string | undefined,
      bcc:     config["bcc"] as string | undefined,
      replyTo: config["replyTo"] as string | undefined,
      attachments,
    };

    // ── Send ──────────────────────────────────────────────────────────────────

    try {
      let info: SentInfo;

      if (this.testTransport) {
        info = await this.testTransport.sendMail(mailOptions);
      } else {
        const transport = config["transport"] as string | undefined;
        if (transport === "sendgrid") {
          const apiKey = config["apiKey"] as string | undefined;
          if (!apiKey) throw new AppError("SendGrid transport requires 'apiKey' in config", 400, "EMAIL_MISSING_API_KEY");
          info = await sendViaSendGrid(apiKey, mailOptions);
        } else {
          const smtpTransport = buildSmtpTransport(config);
          info = await smtpTransport.sendMail(mailOptions);
        }
      }

      return {
        data: {
          success: true,
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
        },
      };
    } catch (err) {
      if (err instanceof AppError) throw err;

      // Map transport errors to friendly output (non-fatal for workflow)
      const message = err instanceof Error ? err.message : String(err);
      const friendly = mapTransportError(message);
      return {
        data: {
          success: false,
          messageId: "",
          accepted: [],
          rejected: Array.isArray(to) ? to : [to],
          error: friendly,
        },
      };
    }
  }
}

// ─── Error mapping ─────────────────────────────────────────────────────────────

function mapTransportError(message: string): string {
  if (/ECONNREFUSED/i.test(message)) return "Could not connect to mail server — check host and port.";
  if (/535|auth|authentication/i.test(message)) return "SMTP authentication failed — check username and password.";
  if (/ENOTFOUND/i.test(message)) return "Mail server hostname not found — check SMTP host configuration.";
  if (/timeout/i.test(message)) return "Connection to mail server timed out.";
  if (/sendgrid/i.test(message)) return message; // already friendly
  return `Email send failed: ${message}`;
}
