import { z } from "zod";

export const AuditEventType = {
  WORKFLOW_CREATED:    "workflow.created",
  WORKFLOW_UPDATED:    "workflow.updated",
  WORKFLOW_DELETED:    "workflow.deleted",
  CREDENTIAL_CREATED:  "credential.created",
  CREDENTIAL_DELETED:  "credential.deleted",
  MEMBER_INVITED:      "member.invited",
  MEMBER_REMOVED:      "member.removed",
  EXECUTION_TRIGGERED: "execution.triggered",
  EXECUTION_CANCELLED: "execution.cancelled",
  BILLING_SUBSCRIBED:  "billing.subscribed",
  BILLING_CANCELLED:   "billing.cancelled",
} as const;

export type AuditEventType = (typeof AuditEventType)[keyof typeof AuditEventType];

export const AuditLogSchema = z.object({
  id:         z.string().uuid(),
  tenantId:   z.string().min(1),
  actorId:    z.string().min(1),
  actorEmail: z.string().optional(),
  ipAddress:  z.string().optional(),
  userAgent:  z.string().optional(),
  eventType:  z.string().min(1),
  entityType: z.string().optional(),
  entityId:   z.string().optional(),
  metadata:   z.record(z.unknown()).optional(),
  createdAt:  z.coerce.date(),
});

export const AuditLogQuerySchema = z.object({
  eventType:  z.string().optional(),
  actorId:    z.string().optional(),
  entityType: z.string().optional(),
  entityId:   z.string().optional(),
  from:       z.coerce.date().optional(),
  to:         z.coerce.date().optional(),
  limit:      z.coerce.number().int().min(1).max(100).default(50),
  offset:     z.coerce.number().int().min(0).default(0),
});

export type AuditLog      = z.infer<typeof AuditLogSchema>;
export type AuditLogQuery = z.infer<typeof AuditLogQuerySchema>;
