import { z } from "zod";

export const WebhookMethod = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  PATCH: "PATCH",
  DELETE: "DELETE",
  ANY: "ANY",
} as const;

export type WebhookMethodValue = (typeof WebhookMethod)[keyof typeof WebhookMethod];

export const WebhookMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "ANY"]);

export const WebhookCreateSchema = z.object({
  workflowId: z.string().min(1),
  method: WebhookMethodSchema.default("ANY"),
  secret: z.string().min(8).optional(),
});

export const WebhookResponseSchema = z.object({
  id: z.string(),
  url: z.string(),
  webhookId: z.string(),
  workflowId: z.string(),
  method: WebhookMethodSchema,
  active: z.boolean(),
  createdAt: z.coerce.date(),
});

export type WebhookCreate = z.infer<typeof WebhookCreateSchema>;
export type WebhookResponse = z.infer<typeof WebhookResponseSchema>;
