import { z } from "zod";

export const MergeNodeConfigSchema = z.object({
  /** How to combine data from multiple parallel branches. */
  mode: z.enum(["waitAll", "mergeByKey", "append", "firstWins"]).default("waitAll"),
  /** Total number of input branches expected (minimum 2). */
  inputCount: z.number().int().min(2).default(2),
  /** Field name used as the join key (mergeByKey mode only). */
  joinKey: z.string().optional(),
  /** inner = only matched rows; left = all left rows (mergeByKey mode only). */
  joinType: z.enum(["inner", "left"]).default("inner"),
  /** If set, proceed with available branches after this many milliseconds. */
  timeoutMs: z.number().int().min(0).optional(),
});

export type MergeNodeConfig = z.infer<typeof MergeNodeConfigSchema>;
