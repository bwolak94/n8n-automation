import { z } from "zod";

export const ApprovalNotificationChannelSchema = z.enum(["email", "slack", "both"]);
export const ApprovalTimeoutActionSchema       = z.enum(["reject", "approve"]);

export const ApprovalNodeConfigSchema = z.object({
  /** Reviewer email addresses (may contain template expressions). */
  reviewers: z.array(z.string().min(1)).min(1),

  /** How to notify reviewers. */
  notificationChannel: ApprovalNotificationChannelSchema.default("email"),

  /** Custom message shown on the approval page and in the notification. */
  message: z.string().optional(),

  /** How long (hours) to wait before triggering timeoutAction. */
  timeoutHours: z.number().int().min(1).max(720).default(24),

  /** What to do when the deadline passes without a decision. */
  timeoutAction: ApprovalTimeoutActionSchema.default("reject"),

  /**
   * AND vs OR mode.
   * true  = all reviewers must approve; any rejection → rejected.
   * false = first decision wins.
   */
  requireAll: z.boolean().default(false),

  /** Slack credential ID (required when notificationChannel includes 'slack'). */
  credentialId: z.string().optional(),
});

export type ApprovalNodeConfig = z.infer<typeof ApprovalNodeConfigSchema>;
