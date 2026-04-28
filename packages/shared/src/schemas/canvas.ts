import { z } from "zod";

const CanvasOpTypeSchema = z.enum([
  "node:add",
  "node:update",
  "node:delete",
  "node:move",
  "edge:add",
  "edge:delete",
  "selection:change",
  "viewport:change",
]);

export const CanvasOpSchema = z.object({
  id: z.string().min(1),
  workflowId: z.string().min(1),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  type: CanvasOpTypeSchema,
  payload: z.record(z.unknown()),
  timestamp: z.coerce.date(),
  version: z.number().int().min(0),
});

export const CanvasOpBatchSchema = z.object({
  workflowId: z.string().min(1),
  ops: z.array(CanvasOpSchema).min(1).max(100),
});
