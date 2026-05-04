import { z } from "zod";

export const SubWorkflowNodeConfigSchema = z.object({
  /** ID of the workflow to invoke as a sub-workflow. */
  subWorkflowId: z.string().min(1),
  /**
   * Maps sub-workflow trigger input fields to expressions resolved from the parent context.
   * Keys are the sub-workflow's expected trigger field names; values are expressions or
   * literal values (NodeExecutor evaluates top-level config keys before calling execute()).
   */
  inputMapping: z.record(z.unknown()).default({}),
  /** When true (default), block until sub-workflow finishes and return its output. */
  waitForResult: z.boolean().default(true),
  /** Timeout in ms for synchronous execution. Defaults to 30 000 ms. */
  timeout: z.number().int().min(100).default(30_000),
});

export type SubWorkflowNodeConfig = z.infer<typeof SubWorkflowNodeConfigSchema>;
