import { z } from "zod";
import { ExecutionStatus } from "../constants/index.js";

export const ExecutionStepSchema = z.object({
  id: z.string().min(1),
  executionId: z.string().min(1),
  nodeId: z.string().min(1),
  nodeType: z.string().min(1),
  status: z.nativeEnum(ExecutionStatus),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z
    .object({
      message: z.string(),
      code: z.string().optional(),
      stack: z.string().optional(),
    })
    .optional(),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().optional(),
  durationMs: z.number().int().min(0).optional(),
  attemptNumber: z.number().int().min(1).default(1),
});

export const ExecutionSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  workflowId: z.string().min(1),
  status: z.nativeEnum(ExecutionStatus),
  triggerData: z.unknown().optional(),
  steps: z.array(ExecutionStepSchema).default([]),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().optional(),
  durationMs: z.number().int().min(0).optional(),
  error: z
    .object({
      message: z.string(),
      code: z.string().optional(),
    })
    .optional(),
});

export const TriggerExecutionSchema = z.object({
  workflowId: z.string().min(1),
  triggerData: z.unknown().optional(),
});
