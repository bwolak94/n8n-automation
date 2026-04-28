import { expectTypeOf } from "expect-type";
import { ScheduleSchema, CreateScheduleSchema, UpdateScheduleSchema } from "../schemas/schedule.js";
import type { Schedule } from "../types/index.js";

const validSchedule = {
  id: "sched-1",
  tenantId: "tenant-1",
  workflowId: "wf-1",
  cron: "0 9 * * 1",
  timezone: "UTC",
  enabled: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ScheduleSchema", () => {
  it("parses valid schedule", () => {
    expect(ScheduleSchema.safeParse(validSchedule).success).toBe(true);
  });

  it("accepts common cron expressions", () => {
    const validCrons = [
      "* * * * *",
      "0 9 * * 1",
      "30 18 * * *",
      "0 0 1 * *",
      "*/5 * * * *",
    ];
    for (const cron of validCrons) {
      const result = ScheduleSchema.safeParse({ ...validSchedule, cron });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid cron expression", () => {
    const result = ScheduleSchema.safeParse({ ...validSchedule, cron: "not a cron" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toContain("cron");
  });

  it("parses schedule with optional lastRunAt and nextRunAt", () => {
    const result = ScheduleSchema.safeParse({
      ...validSchedule,
      lastRunAt: new Date(),
      nextRunAt: new Date(),
    });
    expect(result.success).toBe(true);
  });

  it("inferred Schedule type has correct shape", () => {
    expectTypeOf<Schedule>().toHaveProperty("workflowId");
    expectTypeOf<Schedule>().toHaveProperty("cron");
    expectTypeOf<Schedule>().toHaveProperty("enabled");
  });
});

describe("CreateScheduleSchema", () => {
  it("parses valid create request", () => {
    const result = CreateScheduleSchema.safeParse({
      workflowId: "wf-1",
      cron: "0 9 * * 1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timezone).toBe("UTC");
      expect(result.data.enabled).toBe(true);
    }
  });

  it("rejects missing workflowId", () => {
    const result = CreateScheduleSchema.safeParse({ cron: "0 9 * * 1" });
    expect(result.success).toBe(false);
  });
});

describe("UpdateScheduleSchema", () => {
  it("allows partial update", () => {
    const result = UpdateScheduleSchema.safeParse({ enabled: false });
    expect(result.success).toBe(true);
  });

  it("allows empty update object", () => {
    const result = UpdateScheduleSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});
