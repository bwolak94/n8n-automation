import { z } from "zod";
import { WorkflowStatus, NodeCategory, BackoffStrategy } from "../constants/index.js";

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().int().min(1).max(10),
  backoffStrategy: z.nativeEnum(BackoffStrategy),
  initialDelayMs: z.number().int().min(0).default(1000),
  maxDelayMs: z.number().int().min(0).default(30000),
});

export const NodeConfigSchema = z.record(z.unknown());

export const WorkflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  category: z.nativeEnum(NodeCategory),
  label: z.string().min(1).max(255),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  config: NodeConfigSchema,
  retryPolicy: RetryPolicySchema.optional(),
});

export const WorkflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

export const WorkflowSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  status: z.nativeEnum(WorkflowStatus),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  tags: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateWorkflowSchema = WorkflowSchema.omit({
  id: true,
  tenantId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.nativeEnum(WorkflowStatus).default(WorkflowStatus.DRAFT),
});

export const UpdateWorkflowSchema = CreateWorkflowSchema.partial();
