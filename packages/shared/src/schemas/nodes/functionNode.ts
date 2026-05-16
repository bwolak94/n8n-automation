import { z } from "zod";

export const FunctionNodeConfigSchema = z.object({
  /** JavaScript source code. Use `return { ... }` to produce output. */
  code: z.string().min(1),
  /** Execution timeout in milliseconds (default 5000, max 30000). */
  timeoutMs: z.number().int().min(1).max(30_000).default(5_000),
  /** V8 heap memory limit in MB (default 32). */
  memoryMb: z.number().int().min(8).max(256).default(32),
});

export type FunctionNodeConfig = z.infer<typeof FunctionNodeConfigSchema>;
