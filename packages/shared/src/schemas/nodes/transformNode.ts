import { z } from "zod";
import { ConditionSchema } from "./conditionalNode.js";

// ─── Individual operation schemas ─────────────────────────────────────────────

export const PickOpSchema    = z.object({ op: z.literal("pick"),    fields: z.array(z.string()).min(1) });
export const OmitOpSchema    = z.object({ op: z.literal("omit"),    fields: z.array(z.string()).min(1) });
export const RenameOpSchema  = z.object({ op: z.literal("rename"),  mapping: z.record(z.string()) });
export const ComputeOpSchema = z.object({ op: z.literal("compute"), field: z.string().min(1), expression: z.string().min(1) });
export const FilterOpSchema  = z.object({ op: z.literal("filter"),  condition: ConditionSchema });
export const SortOpSchema    = z.object({ op: z.literal("sort"),    field: z.string().min(1), direction: z.enum(["asc", "desc"]).default("asc") });
export const GroupByOpSchema = z.object({ op: z.literal("groupBy"), field: z.string().min(1) });
export const FlattenOpSchema = z.object({ op: z.literal("flatten"), depth: z.number().int().min(1).optional() });
export const MergeOpSchema   = z.object({ op: z.literal("merge"),   data: z.record(z.unknown()) });

// ─── Discriminated union ───────────────────────────────────────────────────────

export const TransformOperationSchema = z.discriminatedUnion("op", [
  PickOpSchema,
  OmitOpSchema,
  RenameOpSchema,
  ComputeOpSchema,
  FilterOpSchema,
  SortOpSchema,
  GroupByOpSchema,
  FlattenOpSchema,
  MergeOpSchema,
]);

export type TransformOperation = z.infer<typeof TransformOperationSchema>;

// ─── Node config ──────────────────────────────────────────────────────────────

export const DataTransformNodeConfigSchema = z.object({
  /** Ordered list of transform operations to apply. */
  operations: z.array(TransformOperationSchema).default([]),
  /** Dot-path to a nested field to operate on (operates on whole input if absent). */
  inputField: z.string().optional(),
  /** Dot-path where the result is written (replaces root output if absent). */
  outputField: z.string().optional(),
});

export type DataTransformNodeConfig = z.infer<typeof DataTransformNodeConfigSchema>;
