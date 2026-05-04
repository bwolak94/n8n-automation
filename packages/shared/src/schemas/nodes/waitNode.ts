import { z } from "zod";

export const WaitDurationSchema = z.object({
  value: z.number().min(0),
  unit: z.enum(["seconds", "minutes", "hours", "days"]),
});

export const WaitNodeConfigSchema = z.object({
  /** Pause mode. */
  mode: z.enum(["duration", "until", "webhook"]).default("duration"),
  /** For 'duration' mode: how long to wait. */
  duration: WaitDurationSchema.optional(),
  /** For 'until' mode: ISO datetime string (or expression) to wait until. */
  until: z.string().optional(),
  /** Maximum wait in days — execution auto-cancels at deadline. Default 30. */
  maxWaitDays: z.number().int().min(1).max(365).default(30),
});

export type WaitNodeConfig = z.infer<typeof WaitNodeConfigSchema>;
