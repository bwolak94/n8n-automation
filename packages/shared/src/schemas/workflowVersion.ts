import { z } from "zod";
import { WorkflowSchema } from "./workflow.js";

export const WorkflowVersionSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  tenantId: z.string().min(1),
  version: z.number().int().positive(),
  snapshot: WorkflowSchema,
  label: z.string().max(255).optional(),
  createdBy: z.string().min(1),
  createdAt: z.coerce.date(),
  autoSave: z.boolean(),
});

export const WorkflowVersionSummarySchema = WorkflowVersionSchema.omit({ snapshot: true });

export const TagVersionSchema = z.object({
  label: z.string().min(1).max(255),
});

export type WorkflowVersion = z.infer<typeof WorkflowVersionSchema>;
export type WorkflowVersionSummary = z.infer<typeof WorkflowVersionSummarySchema>;
export type TagVersion = z.infer<typeof TagVersionSchema>;
