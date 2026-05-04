import { z } from "zod";

export const EmailTransportSchema = z.enum(["smtp", "sendgrid"]);
export type EmailTransport = z.infer<typeof EmailTransportSchema>;

export const EmailAttachmentSchema = z.object({
  filename: z.string().min(1),
  content: z.string(), // base64 or plain text
});

export const EmailNodeConfigSchema = z.object({
  transport: EmailTransportSchema.default("smtp"),

  // Credential reference (name used in {{ $credentials.<name>.field }} expressions)
  // SMTP: expects fields { host, port, user, password, secure? }
  // SendGrid: expects fields { apiKey }
  smtpHost:     z.string().optional(),
  smtpPort:     z.coerce.number().int().min(1).max(65535).default(587),
  smtpUser:     z.string().optional(),
  smtpPassword: z.string().optional(),
  smtpSecure:   z.boolean().default(false),
  apiKey:       z.string().optional(), // SendGrid API key

  // Email fields (support expression syntax in string fields)
  from:    z.string().email().or(z.string().startsWith("{{")).optional(),
  to:      z.string().min(1),
  subject: z.string().min(1),
  html:    z.string().optional(),
  text:    z.string().optional(),
  cc:      z.string().optional(),
  bcc:     z.string().optional(),
  replyTo: z.string().optional(),

  attachments: z.array(EmailAttachmentSchema).optional(),

  /** When true, log the payload without actually sending. */
  dryRun: z.boolean().default(false),

  /** Max attachment size in bytes (default 10 MB). */
  maxAttachmentBytes: z.number().int().positive().default(10 * 1024 * 1024),
});

export type EmailNodeConfig = z.infer<typeof EmailNodeConfigSchema>;
