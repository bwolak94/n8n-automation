import { z } from "zod";

export const LoopNodeConfigSchema = z.object({
  /** Dot-path to the array within the input data (e.g. "rows" or "data.items"). */
  inputField: z.string().default(""),
  /** Number of items processed per batch (parallel within each batch). */
  batchSize: z.number().int().min(1).default(1),
  /** Collect all item results into an ordered output array. */
  collectResults: z.boolean().default(false),
  /** Continue processing remaining items when one item's sub-chain fails. */
  continueOnError: z.boolean().default(false),
  /** Hard cap on array size — throws LOOP_LIMIT_EXCEEDED if exceeded. */
  maxIterations: z.number().int().min(1).default(1000),
});

export type LoopNodeConfig = z.infer<typeof LoopNodeConfigSchema>;
