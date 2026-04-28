import { z } from "zod";

const CRON_REGEX =
  /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;

export const ScheduleSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  workflowId: z.string().min(1),
  cron: z.string().regex(CRON_REGEX, "Invalid cron expression"),
  timezone: z.string().min(1).default("UTC"),
  enabled: z.boolean().default(true),
  nextRunAt: z.coerce.date().optional(),
  lastRunAt: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const CreateScheduleSchema = ScheduleSchema.omit({
  id: true,
  tenantId: true,
  nextRunAt: true,
  lastRunAt: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateScheduleSchema = CreateScheduleSchema.partial();
